import express from "express";
import cors from "cors";
import axios from "axios";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =============================
   In-memory cache (per ticker)
   ============================= */
const CACHE_DAYS_PAD = 900;          // ~2.5 years on each side
const TOPUP_THRESHOLD_BARS = 15;     // when < this many trading bars left, extend far
const EXTEND_FUTURE_DAYS = 900;      // how much to extend when near the end
const EXTEND_PAST_DAYS = 900;        // how much to extend when near the start

// cache: symbol -> { series: [{date, close}], fromISO, toISO }
const cache = new Map();

/* ------------------- helpers ------------------- */
function toISO(d) { return dayjs(d).format("YYYY-MM-DD"); }

function parsePolyTimestamp(t) {
  let ts = typeof t === "number" ? t : Number(t);
  if (!Number.isFinite(ts)) return null;
  if (ts < 1e11) ts *= 1000; // seconds -> ms
  const d = dayjs(ts);
  return d.isValid() ? d : null;
}

function normalizeBar(r) {
  const d = parsePolyTimestamp(r?.t);
  const c = Number(r?.c);
  if (!d || !Number.isFinite(c)) return null;
  return { date: d.format("YYYY-MM-DD"), close: c };
}

function mergeSeries(oldSeries, newSeries) {
  const map = new Map();
  for (const p of oldSeries) map.set(p.date, p);
  for (const p of newSeries) map.set(p.date, p);
  const merged = Array.from(map.values());
  merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return merged;
}

// Binary searches on date-ascending series
function lowerBound(series, targetISO) {
  // first index with date >= targetISO
  let lo = 0, hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date < targetISO) lo = mid + 1; else hi = mid;
  }
  return lo;
}
function upperBound(series, targetISO) {
  // first index with date > targetISO
  let lo = 0, hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= targetISO) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// Simple sleep for backoff
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// Fetch aggs with basic retry/backoff on 429
async function fetchAggsWithRetry(symbol, fromISO, toISO, apiKey, tries = 3) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${fromISO}/${toISO}`;
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await axios.get(url, {
        params: { adjusted: "true", sort: "asc", limit: 50000, apiKey }
      });
      const raw = resp.data?.results || [];
      return raw.map(normalizeBar).filter(Boolean);
    } catch (e) {
      if (e.response?.status === 429 && i < tries - 1) {
        const delay = 600 * (i + 1); // 0.6s, 1.2s, ...
        console.warn(`Polygon 429, retrying in ${delay}ms…`);
        await sleep(delay);
        continue;
      }
      throw e;
    }
  }
  return [];
}

/**
 * Ensure cache for symbol covers [needFromISO, needToISO].
 * If cache is missing/narrow, fetch a **wide** window and merge.
 */
async function ensureCache(symbol, needFromISO, needToISO, apiKey) {
  let entry = cache.get(symbol);
  const needFrom = dayjs(needFromISO);
  const needTo = dayjs(needToISO);

  if (!entry) {
    const fromISO = toISO(needFrom.subtract(CACHE_DAYS_PAD, "day"));
    const toISOV  = toISO(needTo.add(CACHE_DAYS_PAD, "day"));
    const series = await fetchAggsWithRetry(symbol, fromISO, toISOV, apiKey);
    if (series.length === 0) throw new Error("No trading data for symbol in requested window.");
    entry = { series, fromISO, toISO: toISOV };
    cache.set(symbol, entry);
    return entry;
  }

  // Extend left?
  if (dayjs(entry.fromISO).isAfter(needFrom)) {
    const extendFrom = toISO(needFrom.subtract(CACHE_DAYS_PAD, "day"));
    const more = await fetchAggsWithRetry(symbol, extendFrom, entry.fromISO, apiKey);
    entry.series = mergeSeries(more, entry.series);
    entry.fromISO = extendFrom;
  }

  // Extend right?
  if (dayjs(entry.toISO).isBefore(needTo)) {
    const extendTo = toISO(needTo.add(CACHE_DAYS_PAD, "day"));
    const more = await fetchAggsWithRetry(symbol, entry.toISO, extendTo, apiKey);
    entry.series = mergeSeries(entry.series, more);
    entry.toISO = extendTo;
  }
  return entry;
}

/* ===========================================
   /api/stock-price  (CACHED)
   Query: symbol, date (YYYY-MM-DD), direction ("next"|"previous")
   =========================================== */
app.get("/api/stock-price", async (req, res) => {
  try {
    const { symbol, date, direction } = req.query;
    const apiKey = process.env.POLYGON_API_KEY;

    if (!symbol || !date || !direction) {
      return res.status(400).json({ error: "symbol, date and direction are required" });
    }
    if (!apiKey) {
      return res.status(500).json({ error: "Server missing POLYGON_API_KEY" });
    }

    const reqISO = toISO(date);
    const dir = direction === "previous" ? "previous" : "next";

    // Ensure ample cache around request (± ~1y)
    const needFromISO = dir === "next" ? reqISO : toISO(dayjs(reqISO).subtract(370, "day"));
    const needToISO   = dir === "next" ? toISO(dayjs(reqISO).add(370, "day")) : reqISO;
    const entry = await ensureCache(symbol, needFromISO, needToISO, apiKey);
    let { series } = entry;

    // Find position of request in series
    const idxGE = lowerBound(series, reqISO);  // first >= reqISO
    const idxGT = upperBound(series, reqISO);  // first >  reqISO

    // If near edges by **bars**, extend more (prevents 45-day stall)
    const barsToStart = idxGE;                           // bars before (including)
    const barsToEnd   = series.length - 1 - idxGT + 1;   // bars strictly after
    if (dir === "next" && barsToEnd < TOPUP_THRESHOLD_BARS) {
      const lastISO = series[series.length - 1].date;
      const extendTo = toISO(dayjs(lastISO).add(EXTEND_FUTURE_DAYS, "day"));
      const more = await fetchAggsWithRetry(symbol, lastISO, extendTo, apiKey);
      entry.series = series = mergeSeries(series, more);
      entry.toISO = extendTo;
    }
    if (dir === "previous" && barsToStart < TOPUP_THRESHOLD_BARS) {
      const firstISO = series[0].date;
      const extendFrom = toISO(dayjs(firstISO).subtract(EXTEND_PAST_DAYS, "day"));
      const more = await fetchAggsWithRetry(symbol, extendFrom, firstISO, apiKey);
      entry.series = series = mergeSeries(series, more);
      entry.fromISO = extendFrom;
    }

    // Pick next/previous bar
    let pick;
    if (dir === "next") {
      const i = upperBound(series, reqISO);  // first > requested
      pick = series[i];
    } else {
      const i = lowerBound(series, reqISO) - 1; // last <= requested
      pick = i >= 0 ? series[i] : undefined;
    }

    // If still no bar (very edge case), try one more extend & retry pick
    if (!pick) {
      if (dir === "next") {
        const lastISO = series[series.length - 1].date;
        const extendTo = toISO(dayjs(lastISO).add(EXTEND_FUTURE_DAYS, "day"));
        const more = await fetchAggsWithRetry(symbol, lastISO, extendTo, apiKey);
        entry.series = series = mergeSeries(series, more);
        entry.toISO = extendTo;
        const i = upperBound(series, reqISO);
        pick = series[i];
      } else {
        const firstISO = series[0].date;
        const extendFrom = toISO(dayjs(firstISO).subtract(EXTEND_PAST_DAYS, "day"));
        const more = await fetchAggsWithRetry(symbol, extendFrom, firstISO, apiKey);
        entry.series = series = mergeSeries(series, more);
        entry.fromISO = extendFrom;
        const i = lowerBound(series, reqISO) - 1;
        pick = i >= 0 ? series[i] : undefined;
      }
    }

    if (!pick) {
      return res.status(404).json({ error: `No ${dir} trading day found near ${reqISO}.` });
    }

    console.log("Price fetch (cached):", {
      symbol,
      direction: dir,
      requested: reqISO,
      picked: pick.date,
      close: pick.close,
      cacheFrom: entry.fromISO,
      cacheTo: entry.toISO,
      cachedBars: series.length,
    });

    return res.json({ symbol, date: pick.date, price: pick.close });
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn("Polygon rate limit hit.");
      return res.status(429).json({ error: "Rate limit exceeded. Please wait and try again." });
    }
    console.error("Stock-price route error:", error.message);
    return res.status(500).json({ error: "Polygon API request failed." });
  }
});

/* ===========================================
   /api/start — pick a real trading day to begin
   =========================================== */
app.post("/api/start", async (req, res) => {
  try {
    const { ticker } = (req.body || {});
    const apiKey = process.env.POLYGON_API_KEY;
    if (!ticker) return res.status(400).json({ error: "Ticker is required" });
    if (!apiKey) return res.status(500).json({ error: "Server missing POLYGON_API_KEY" });

    // random calendar date in [now-12mo, now-6mo]
    const endDate = dayjs().subtract(6, "month");
    const startDate = dayjs().subtract(12, "month");
    const diffDays = endDate.diff(startDate, "day");
    const randomOffset = Math.floor(Math.random() * Math.max(1, diffDays));
    const randomDate = startDate.add(randomOffset, "day");

    // Build cache around the start and find first bar >= randomDate
    const needFromISO = toISO(randomDate);
    const needToISO = toISO(randomDate.add(30, "day"));
    const entry = await ensureCache(ticker, needFromISO, needToISO, apiKey);
    const { series } = entry;

    const idx = lowerBound(series, toISO(randomDate));
    const startBar = series[idx];
    if (!startBar) throw new Error("No trading day found near random start date.");

    return res.json({
      ticker,
      price: startBar.close,
      hiddenDate: startBar.date,
      bank: 10000,
      shares: 0,
      investment: 0,
      day: 1,
      history: [],
    });
  } catch (error) {
    if (error.response?.status === 429) {
      console.warn("Polygon rate limit hit on /api/start.");
      return res.status(429).json({ error: "Rate limit exceeded. Please wait and try again." });
    }
    console.error("Error starting game:", error.message);
    return res.status(500).json({ error: "Failed to start game." });
  }
});

const PORT = 5050;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
