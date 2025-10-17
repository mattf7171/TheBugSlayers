import React, { useState } from "react";
import Home from "./components/home";
import "./styles.css";

export default function App() {
  const [gameState, setGameState] = useState(null);

  return (
    <>
      {!gameState ? (
        <Home onGameStarted={setGameState} />
      ) : (
        <div className="page">
          <div className="card">
            <h2 className="title">Game Started</h2>
            <p className="desc">
              Ticker: <strong>{gameState.ticker}</strong>
            </p>
            <p>Bank: ${gameState.bank?.toFixed?.(2)}</p>
            <p>Shares: {gameState.shares}</p>
            <p>Price: ${gameState.price?.toFixed?.(2)}</p>
            <p>Day: {gameState.day}</p>
            <button className="playBtn" onClick={() => setGameState(null)}>
              Back to Home
            </button>
          </div>
        </div>
      )}
    </>
  );
}
