// src/components/Game.js
import React, { useState } from "react";
import axios from "axios";
import BuySellScreen from "./buySellScreen"; // make sure the filename/casing matches

export default function Game({ gameState, onExit }) {
  // gameState should come from POST /api/start and include: gameId, ticker, day, price, bank, shares, equity
  const [state, setState] = useState(gameState);
  const [mode, setMode] = useState(""); // "buy" | "sell" | ""
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!state?.gameId) {
    return (
      <div className="page">
        <div className="card">
          <h2 className="title">Error</h2>
          <p>Missing gameId. Please restart the game from Home.</p>
          <button onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  async function postAction(payload) {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.post("/api/action", payload);
      // If server says we're done, show summary and exit
      if (res.data?.done) {
        if (typeof res.data.gainLoss === "number") {
          alert(
            `Game Over!\nTotal Gain/Loss: $${res.data.gainLoss.toFixed(2)}`
          );
        } else if (res.data?.warning) {
          alert(res.data.warning);
        }
        onExit();
        return;
      }
      // Update local state with authoritative server snapshot
      setState((prev) => ({ ...prev, ...res.data }));
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.message ||
        "Action failed. Please try again.";
      setErr(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  // Hold advances to the next trading day on the server
  const handleHold = async () => {
    await postAction({ gameId: state.gameId, type: "hold" });
  };

  // Quit liquidates on the server and ends the game
  const handleQuit = async () => {
    await postAction({ gameId: state.gameId, type: "quit" });
  };

  /**
   * Handle Buy/Sell.
   * We send the raw amount the user entered and tell the server what "mode" it is:
   *  - For buy: amount is USD (mode: "usd")
   *  - For sell: amount is SHARES (mode: "shares")
   */
  const handleTransaction = async (actionType, amount) => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const payload =
      actionType === "buy"
        ? { gameId: state.gameId, type: "buy", amount: amt, mode: "usd" }
        : { gameId: state.gameId, type: "sell", amount: amt, mode: "shares" };

    await postAction(payload);
    setMode(""); // back to main view after server response
  };

  if (mode) {
    return (
      <BuySellScreen
        mode={mode}
        // For buy, user enters dollars; cap by bank. For sell, user enters shares; cap by shares.
        max={mode === "buy" ? state.bank : state.shares}
        price={state.price}
        onSubmit={(amt) => handleTransaction(mode, amt)}
        onCancel={() => setMode("")}
      />
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2 className="title">Day {state.day}</h2>

        <p>
          Ticker: <strong>{state.ticker}</strong>
        </p>
        <p>Price: ${Number(state.price || 0).toFixed(2)}</p>
        <p>Bank: ${Number(state.bank || 0).toFixed(2)}</p>
        <p>Shares: {Number(state.shares || 0).toFixed(4)}</p>
        <p>Total Equity: ${Number(state.equity || 0).toFixed(2)}</p>
        {err && <div className="error" style={{ marginTop: 8 }}>{err}</div>}

        <div className="buttonRow" style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button disabled={loading} onClick={() => setMode("buy")}>
            Buy
          </button>
          <button disabled={loading || state.shares <= 0} onClick={() => setMode("sell")}>
            Sell
          </button>
          <button disabled={loading} onClick={handleHold}>
            {loading ? "Loading…" : "Hold"}
          </button>
          <button disabled={loading} onClick={handleQuit}>
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
