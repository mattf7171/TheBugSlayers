import React, { useState } from "react";
import "./home.css"; 

const TICKERS = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "BRK.B", "UNH", "JNJ",
  "JPM", "V", "PG", "MA", "HD", "XOM", "KO", "PEP", "PFE", "ABBV",
  "BAC", "NFLX", "INTC", "CSCO", "ADBE", "CRM", "ORCL", "NKE", "T", "WMT"
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
      const res = await fetch("http://localhost:5050/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to start game.");
      }
      
      const data = await res.json();
      onGameStarted?.(data);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // quick selection with popular stickers
  const popularTickers = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "NVDA"];

  return (
    <div className="home-page">
      <div className="home-card">
        {}
        <div className="header-section">
          <h1 className="game-title">Stock Market Simulator</h1>
          <p className="game-description">
            Start with $10,000 and test your investment skills
          </p>
        </div>

        {}
        <div className="ticker-section">
          <h2 className="section-title">Select a Ticker Symbol</h2>
          
          {/* quick select buttons */}
          <div className="quick-select">
            <p className="quick-select-label">Popular stocks:</p>
            <div className="ticker-buttons">
              {popularTickers.map((t) => (
                <button
                  key={t}
                  className={`ticker-btn ${ticker === t ? 'active' : ''}`}
                  onClick={() => setTicker(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* dropdown menu */}
          <div className="dropdown-section">
            <label htmlFor="ticker-select" className="dropdown-label">
              Or choose from full list:
            </label>
            <select
              id="ticker-select"
              className="ticker-dropdown"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            >
              <option value="">— Select a stock —</option>
              {TICKERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* selected option displayed */}
          {ticker && (
            <div className="selected-ticker">
              <span className="selected-label">Selected:</span>
              <span className="ticker-symbol">{ticker}</span>
            </div>
          )}
        </div>

        {}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* start button */}
        <div className="action-section">
          <button
            className="start-button"
            disabled={!ticker || loading}
            onClick={handleStart}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Starting Game...
              </>
            ) : (
              <>
                Click to Play
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}