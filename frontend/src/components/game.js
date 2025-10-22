// src/components/Game.js
import React, { useEffect, useMemo, useState } from "react";
import BuySellScreen from "./buySellScreen";
import GameSummary from "./gameSummary";
import axios from "axios";
import "./home.css"; // reuse the home styles

export default function Game({ gameState, onExit }) {
  const [state, setState] = useState({
    ...gameState,
    history: Array.isArray(gameState.history) ? gameState.history : []
  });
  const [mode, setMode] = useState(""); // "buy", "sell", or ""
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // Ensure the current price is in history at mount
  useEffect(() => {
    setState(prev => {
      if (!prev.price) return prev;
      if (!prev.history?.length) return { ...prev, history: [prev.price] };
      return prev;
    });
  }, []);

  const equity = useMemo(() => {
    const p = Number(state.price || 0);
    return Number(state.bank || 0) + Number(state.shares || 0) * p;
  }, [state.price, state.bank, state.shares]);

  const changePct = useMemo(() => {
    const h = state.history || [];
    if (h.length < 2) return 0;
    const first = h[0];
    const last = h[h.length - 1];
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [state.history]);

  // ---- Sparkline path (simple SVG)
  const spark = useMemo(() => {
    const w = 280, h = 60, padX = 6, padY = 6;
    const data = (state.history || []).slice(-30); // last 30 points
    if (data.length < 2) return { d: "", w, h, last: null };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const stepX = (w - padX * 2) / (data.length - 1);
    const scaleY = (v) => {
      const norm = (v - min) / range;         // 0..1
      return h - padY - norm * (h - padY * 2); // invert y
    };

    let d = "";
    data.forEach((v, i) => {
      const x = padX + i * stepX;
      const y = scaleY(v);
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    return { d, w, h, last: data[data.length - 1] };
  }, [state.history]);

  // Hold -> fetch next day
  const handleHold = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/stock-price", {
        params: {
          symbol: state.ticker,
          date: state.currentDate,
          direction: "next",
        },
      });

      const nextPrice = res.data.price;
      const nextDate = res.data.date;

      setState((prev) => ({
        ...prev,
        day: prev.day + 1,
        price: nextPrice,
        currentDate: nextDate,
        history: [...(prev.history || []), nextPrice],
      }));
    } catch (err) {
      setError("Failed to fetch next day price.");
      alert("Failed to fetch next day price.");
    } finally {
      setLoading(false);
    }
  };

  // Quit -> end summary
  const handleQuit = () => {
    const finalCash = state.shares * state.price;
    const totalBank = state.bank + finalCash;
    const gain = totalBank - 10000;
    setIsGameOver(true);
  };

  // Buy/Sell, then auto-advance a day
  const handleTransaction = (type, amount) => {
    try {
      const round2 = (n) => Math.round(n * 100) / 100;
      const floor4 = (n) => Math.floor(n * 10000) / 10000;
      const EPS = 1e-6;

      let newBank = Number(state.bank) || 0;
      let newShares = Number(state.shares) || 0;
      let newInvestment = Number(state.investment) || 0;
      const price = Number(state.price) || 0;
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return;

      if (type === "buy") {
        // clamp dollars to bank (tolerate tiny overage)
        const usd = Math.min(amt, newBank + 0.005);
        if (usd <= 0) return;
        // convert to shares (floor to 4dp so cost never exceeds bank)
        const sharesToBuy = floor4(usd / price);
        if (sharesToBuy <= 0) return;
        const cost = round2(sharesToBuy * price);
        if (cost > newBank + 0.005) return; // extra guard
        newBank = round2(newBank - cost);
        newShares = Number((newShares + sharesToBuy).toFixed(4));
        newInvestment = round2(newInvestment + cost);
      }

      if (type === "sell") {
        // clamp shares to holdings (tolerate tiny overage)
        const sharesToSell = Math.min(amt, newShares + EPS);
        if (sharesToSell <= 0) return;
        const sh = Math.min(sharesToSell, newShares); // final clamp
        const proceeds = round2(sh * price);
        newShares = Number((newShares - sh).toFixed(4));
        if (newShares < EPS) newShares = 0;
        newBank = round2(newBank + proceeds);
        newInvestment = round2(Math.max(0, newInvestment - proceeds)); // optional: track invested net
      }

      setState((prev) => ({
        ...prev,
        bank: newBank,
        shares: newShares,
        investment: newInvestment,
      }));

      setMode(""); // back to main view
      handleHold(); // advance a day
    } catch (err) {
      if (err.response?.status === 429) {
        alert("You're making requests too quickly. Please wait and try again.");
      } else {
        alert("Transaction failed. Please try again.");
      }
    }
  };

  // Subscreen for buy/sell
  if (mode) {
    return (
      <BuySellScreen
        mode={mode}
        max={mode === "buy" ? state.bank : state.shares}
        price={state.price}
        onSubmit={(amt) => handleTransaction(mode, amt)}
        onCancel={() => setMode("")}
      />
    );
  }

  if (isGameOver) {
    return <GameSummary state={state} onExit={onExit} />
  }

  // ----- Main Game Screen (matching home.css) -----
  const changeIsUp = changePct >= 0;
  return (
    <div className="home-page">
      <div className="home-card game-card">
        {/* Header */}
        <div className="header-section" style={{ marginBottom: 18 }}>
          <h1 className="game-title">Trading Day {state.day}</h1>
          <p className="game-description">
            Ticker: <strong>{state.ticker}</strong> — stay in the green!
          </p>
        </div>

        {/* Stats grid + sparkline */}
        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-label">Price</div>
            <div className="stat-value">${Number(state.price || 0).toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Bank</div>
            <div className="stat-value">${Number(state.bank || 0).toFixed(2)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Shares</div>
            <div className="stat-value">{Number(state.shares || 0).toFixed(4)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Total Equity</div>
            <div className="stat-value">${Number(equity || 0).toFixed(2)}</div>
          </div>
        </div>

        {/* Sparkline card */}
        <div className="sparkline-box">
          <div className="sparkline-head">
            <span className="sparkline-title">Recent Price Trend</span>
            <span className={`sparkline-change ${changeIsUp ? "up" : "down"}`}>
              {changeIsUp ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            </span>
          </div>
          <div className="sparkline-canvas">
            {spark.d ? (
              <svg width={spark.w} height={spark.h} aria-label="recent price sparkline">
                {/* background rail */}
                <rect x="0" y="0" width={spark.w} height={spark.h} fill="transparent" />
                {/* line */}
                <path d={spark.d} fill="none" stroke="#4caf50" strokeWidth="3" />
              </svg>
            ) : (
              <div className="sparkline-empty">Make a few moves to see a trend…</div>
            )}
          </div>
        </div>

        {/* Error (same style as home) */}
        {error && <div className="error-message">⚠️ {error}</div>}

        {/* Actions */}
        <div className="action-section" style={{ display: "grid", gap: 10 }}>
          <button
            className="start-button"
            onClick={() => setMode("buy")}
            disabled={loading}
          >
            Buy
          </button>

          <div className="button-row">
            <button
              className="btn-outline"
              onClick={() => setMode("sell")}
              disabled={loading || state.shares <= 0}
            >
              Sell
            </button>
            <button className="btn-outline" onClick={handleHold} disabled={loading}>
              {loading ? "Loading…" : "Hold"}
            </button>
            <button className="btn-danger" onClick={handleQuit} disabled={loading}>
              Quit
            </button>
          </div>
        </div>

        
      </div>
    </div>
  );
}
