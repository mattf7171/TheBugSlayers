import React, { useState } from "react";

const TICKERS = [
  "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","BRK.B","UNH","JNJ",
  "JPM","V","PG","MA","HD","XOM","KO","PEP","PFE","ABBV",
  "BAC","NFLX","INTC","CSCO","ADBE","CRM","ORCL","NKE","T","WMT"
];

export default function Home({ onGameStarted }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!ticker) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker })
      });
      if (!res.ok) throw new Error("Failed to start game.");
      const data = await res.json();
      onGameStarted?.(data); // parent can route to game view later
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1 className="title">Stock Price Game</h1>
        <p className="desc">Guess the stock price!</p>

        <div className="selectRow">
          <label htmlFor="ticker" className="label">
            Select a Ticker Symbol
          </label>
          <select
            id="ticker"
            className="select"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            size="5"
          >
            <option value="">— Choose one —</option>
            {TICKERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <button
          className="playBtn"
          disabled={!ticker || loading}
          onClick={handleStart}
        >
          {loading ? "Starting…" : "Click to Play"}
        </button>

        {error && <div className="error">{error}</div>}
      </div>

      
    </div>
  );
}
