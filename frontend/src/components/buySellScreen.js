// src/components/buySellScreen.js
import React, { useState } from "react";

// This is the function used for when the user is buying or selling (buy/sell screen) -- TODO add various UI for the user to change amounts
export default function BuySellScreen({ mode, max, price, onSubmit, onCancel }) {
  const [amount, setAmount] = useState("");

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || amt > max) {
      alert(`Enter a valid amount (max: ${max.toFixed(2)})`);
      return;
    }
    onSubmit(amt);
  };

  return (
    <div className="page">
      <div className="card">
        <h2 className="title">{mode === "buy" ? "Buy Shares" : "Sell Shares"}</h2>
        <p>Current Price: ${price.toFixed(2)}</p>
        <p>Max {mode === "buy" ? "Spendable" : "Sellable"}: {max.toFixed(2)}</p>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={mode === "buy" ? "Enter dollar amount" : "Enter share count"}
        />

        <div className="buttonRow">
          <button onClick={handleSubmit}>Confirm</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
