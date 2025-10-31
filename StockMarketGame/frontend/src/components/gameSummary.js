// src/components/GameSummary.js
import React from "react";
import './home.css'; 

export default function GameSummary({ state, onExit }) {
  const finalCash = state.shares * state.price;
  const totalBank = state.bank + finalCash;
  const gain = totalBank - 10000;

  return (
    <div className="home-page">
      <div className="home-card">
        <div className="header-section">
          <h1 className="game-title">Game Over</h1>
          <p className="game-description">Here’s how you did:</p>
        </div>

        <div className="summary-box">
            <span className="stat-label">Days Played: </span>
            <span className="stat-value">{state.day}</span>
        </div>
        <div className="summary-box">
            <span className="stat-label">Final Bank: </span>
            <span className="stat-value">${totalBank.toFixed(2)}</span>
        </div>
        <div className="summary-box">
            <span className="stat-label">Gain/Loss: </span>
            <span className="stat-value">
              {gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(2)}
            </span>
        </div>

        <div className="action-section">
          <button className="btn-danger" onClick={onExit}>Return to Home</button>
        </div>
      </div>
    </div>
  );
}
