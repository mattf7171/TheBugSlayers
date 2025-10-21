import express from "express";
import axios from "axios";
import dayjs from "dayjs";

export const router = express.Router();

/* ===========================
   Config / constants
   =========================== */
const START_BANK = 10000;
const PREFETCH_DAYS = 120;   // initial calendar window; returns ~80-90 trading bars
const TOPUP_DAYS = 120;      // how many more calendar days to fetch on top-up
const TOPUP_THRESHOLD = 5;   // when <= this many trading days left, top-up

/* ===========================
   In-memory game store
   =========================== */
const games = new Map();

function newId() {
  return Math.random().toString(36).slice(2);
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/* ===========================
   Polygon helpers (hardened)
   =========================== */

// Robust time parser for Polygon 't' (ms epoch usually; sometimes seconds)
function parsePolyTimestamp(t) {
  let ts = typeof t === "number" ? t : Number(t);
  if (!Number.isFinite(ts)) return null;
  // If looks like seconds (10 digits), convert to ms
  if (ts < 1e11) ts *= 1000;
  const d = dayjs(ts);
  return d.isValid() ? d : null;
}

// Normalize a single bar safely
function normalizeBar(r) {
  const d = parsePolyTimestamp(r?.t);
  const c = Number(r?.c);
  if (!d || !Number.isFinite(c)) return null;
  return { date: d.format("YYYY-MM-DD"), close: c };
}

/**
 * Fetch a continuous series of trading days from Polygon Aggs API.
 * Returns array of { date: 'YYYY-MM-DD', close: number } sorted ASC, deduped.
 */
async function fetchDailySeries(ticker, startISO, numDays, apiKey) {
  const start = dayjs(startISO);
  const end = start.add(numDays, "day");

  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(
    ticker
  )}/range/1/day/${start.format("YYYY-MM-DD")}/${end.format("YYYY-MM-DD")}`;

  let data;
  try {
    const resp = await axios.get(url, {
      params: { adjusted: "true", sort: "asc", limit: 50000, apiKey },
    });
    data = resp.data;
  } catch (e) {
    console.error(
      "Polygon aggs request failed:",
      e.response?.status,
      e.response?.data || e.message
    );
    throw new Error("Polygon aggs request failed");
  }

  if (!data || !Array.isArray(data.results)) {
    throw new Error("No results array returned from Polygon.");
  }

  const series = data.results.map(normalizeBar).filter(Boolean);

  if (series.length === 0) {
    console.warn("Polygon returned 0 usable trading days. Example:", data.results?.[0]);
    throw new Error("Polygon returned 0 usable trading days.");
  }

  // Dedup (by date) + sort ASC
  const deduped = [];
  const seen = new Set();
  for (const p of series) {
    if (!seen.has(p.date)) {
      seen.add(p.date);
      deduped.push(p);
    }
  }
  deduped.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return deduped;
}

/**
 * Top-up more trading bars starting the day after lastDateISO.
 */
async function topUpSeries(ticker, lastDateISO, apiKey, days = TOPUP_DAYS) {
  const nextStart = dayjs(lastDateISO).add(1, "day").format("YYYY-MM-DD");
  return await fetchDailySeries(ticker, nextStart, days, apiKey);
}

/* ===========================
   Game helpers
   =========================== */

function snapshot(state) {
  const bar = state.series[state.idx];
  if (!bar) {
    // Out-of-range guard
    return {
      gameId: state.gameId,
      ticker: state.ticker,
      day: state.idx + 1,
      price: null,
      bank: round2(state.bank),
      shares: state.shares,
      equity: round2(state.bank),
      done: true,
      warning: "No current price available (end of data).",
    };
  }
  const price = Number(bar.close) || 0;
  const equity = round2(state.bank + state.shares * price);
  return {
    gameId: state.gameId,
    ticker: state.ticker,
    day: state.idx + 1,
    price: round2(price),
    bank: round2(state.bank),
    shares: state.shares,
    equity,
  };
}

function daysLeft(state) {
  return state.series.length - 1 - state.idx;
}

/* ===========================
   Routes
   =========================== */

/**
 * POST /api/start
 * body: { ticker }
 * returns: snapshot
 */
router.post("/start", async (req, res) => {
  try {
    const { ticker } = req.body || {};
    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "Ticker is required" });
    }
    if (!process.env.POLYGON_API_KEY) {
      return res
        .status(500)
        .json({ error: "Server missing POLYGON_API_KEY configuration." });
    }

    const T = ticker.trim().toUpperCase();

    // pick random start between 12mo and 6mo ago (hidden during play)
    const endDate = dayjs().subtract(6, "month");
    const startDate = dayjs().subtract(12, "month");
    const diffDays = endDate.diff(startDate, "day");
    const randomOffset = Math.floor(Math.random() * Math.max(1, diffDays));
    const randomStart = startDate.add(randomOffset, "day").format("YYYY-MM-DD");

    // Prefetch trading days; Polygon returns only trading days within window
    const series = await fetchDailySeries(
      T,
      randomStart,
      PREFETCH_DAYS,
      process.env.POLYGON_API_KEY
    );

    const gameId = newId();
    const state = {
      gameId,
      ticker: T,
      series,          // [{date, close}, ...] only trading days
      idx: 0,          // pointer to current day in series
      bank: START_BANK,
      shares: 0,
      startEquity: START_BANK,
    };
    games.set(gameId, state);

    console.log(`[START] ${gameId} ${T} bars=${series.length} start=${series[0].date}`);
    return res.json(snapshot(state));
  } catch (err) {
    console.error("Error starting game:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Failed to start game." });
  }
});

/**
 * POST /api/action
 * body: { gameId, type: "buy"|"sell"|"hold"|"quit", amount?: number, mode?: "usd"|"shares" }
 * returns: snapshot OR {done, bank, gainLoss} on quit
 */
router.post("/action", async (req, res) => {
  try {
    const { gameId, type, amount, mode } = req.body || {};
    const state = games.get(gameId);
    if (!state) return res.status(404).json({ error: "Game not found" });

    if (!["buy", "sell", "hold", "quit"].includes(type)) {
      return res.status(400).json({ error: "Invalid action type" });
    }

    const currentBar = state.series[state.idx];
    if (!currentBar) {
      console.warn(`[ACTION] ${gameId} has no current bar at idx=${state.idx}`);
      return res.json({ ...snapshot(state), done: true, warning: "No current price." });
    }
    const price = Number(currentBar.close) || 0;

    if (type === "buy") {
      const amt = Number(amount) || 0;
      if (amt <= 0) return res.status(400).json({ error: "Amount must be > 0" });

      if (mode === "shares") {
        const sharesToBuy = Math.max(0, Math.floor(amt));
        const cost = round2(sharesToBuy * price);
        if (cost > state.bank) return res.status(400).json({ error: "Insufficient funds" });
        state.bank = round2(state.bank - cost);
        state.shares += sharesToBuy;
      } else {
        // default mode: "usd"
        const cappedUsd = Math.min(amt, state.bank);
        const sharesToBuy = Math.floor(cappedUsd / price);
        if (sharesToBuy > 0) {
          const cost = round2(sharesToBuy * price);
          state.bank = round2(state.bank - cost);
          state.shares += sharesToBuy;
        }
      }
    } else if (type === "sell") {
      const amt = Number(amount) || 0;
      if (amt <= 0) return res.status(400).json({ error: "Amount must be > 0" });

      let sharesToSell;
      if (mode === "usd") {
        sharesToSell = Math.min(state.shares, Math.floor(amt / price));
      } else {
        // default mode: "shares"
        sharesToSell = Math.min(state.shares, Math.floor(amt));
      }
      if (sharesToSell > 0) {
        const proceeds = round2(sharesToSell * price);
        state.shares -= sharesToSell;
        state.bank = round2(state.bank + proceeds);
      }
    } else if (type === "quit") {
      // Liquidate and finish
      if (state.shares > 0) {
        const proceeds = round2(state.shares * price);
        state.bank = round2(state.bank + proceeds);
        state.shares = 0;
      }
      const finalBank = round2(state.bank);
      const gainLoss = round2(finalBank - state.startEquity);
      console.log(`[QUIT] ${gameId} ${state.ticker} final=${finalBank} P/L=${gainLoss}`);
      games.delete(gameId);
      return res.json({ done: true, bank: finalBank, gainLoss });
    }
    // hold: no position change

    // ====== Advance day (top-up if running low) ======
    const remaining = state.series.length - 1 - state.idx;

    if (remaining <= 0) {
      // No next day available -> try a top-up before ending
      try {
        const lastDate = state.series[state.series.length - 1].date;
        const more = await topUpSeries(state.ticker, lastDate, process.env.POLYGON_API_KEY, TOPUP_DAYS);
        const merged = state.series.concat(more.filter(m => m.date > lastDate));
        state.series = merged;
        console.log(`[TOPUP] ${state.gameId} +${more.length} bars (now ${state.series.length})`);
      } catch (e) {
        console.warn(`[TOPUP FAIL] ${state.gameId}:`, e.message);
      }
    } else if (remaining <= TOPUP_THRESHOLD) {
      // Proactive top-up
      try {
        const lastDate = state.series[state.series.length - 1].date;
        const more = await topUpSeries(state.ticker, lastDate, process.env.POLYGON_API_KEY, TOPUP_DAYS);
        const merged = state.series.concat(more.filter(m => m.date > lastDate));
        state.series = merged;
        console.log(`[TOPUP] ${state.gameId} +${more.length} bars (now ${state.series.length})`);
      } catch (e) {
        console.warn(`[TOPUP WARN] ${state.gameId}:`, e.message);
      }
    }

    // Only advance if we truly have a next bar
    if (state.idx + 1 >= state.series.length) {
      const snap = snapshot(state);
      return res.json({ ...snap, done: true, warning: "End of available trading days." });
    }

    state.idx += 1;
    return res.json(snapshot(state));
  } catch (err) {
    console.error("Action error:", err?.response?.data || err.message);
    return res.status(500).json({ error: "Action failed" });
  }
});

/**
 * GET /api/state/:gameId  -- optional debugger
 */
router.get("/state/:gameId", (req, res) => {
  const { gameId } = req.params || {};
  const state = games.get(gameId);
  if (!state) return res.status(404).json({ error: "Game not found" });

  const current = state.series[state.idx] || null;
  const last = state.series[state.series.length - 1] || null;

  return res.json({
    ...snapshot(state),
    totalDays: state.series.length,
    currentDate: current?.date || null,
    lastDate: last?.date || null,
    daysRemaining: daysLeft(state),
  });
});
