import React, { useState } from "react";
import GameBoard from "./GameBoard";
import Results from "./Results";
import useSpeedSocket from "../hooks/useSpeedSocket";
import "../styles/Lobby.css";

export default function Lobby() {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const {
    lobbyPlayers,
    gameState,
    countdown,
    sendReady,
    playCard,
    drawCard,
    requestFlip,
    socketId,
    gamePlayers,
    sendPlayAgain,
  } = useSpeedSocket(submitted ? name : null);

  // Name entry screen
  if (!submitted) {
    return (
      <div className="lobby-container">
        <div className="name-entry">
          <h1 className="game-title">⚡ Speed Card Game ⚡</h1>
          <p className="subtitle">Fast-paced, competitive card matching!</p>
          <div className="name-form">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  setSubmitted(true);
                }
              }}
            />
            <button
              onClick={() => {
                if (name.trim()) setSubmitted(true);
              }}
              disabled={!name.trim()}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Countdown screen
  if (countdown !== null && countdown > 0) {
    return (
      <div className="countdown-screen">
        <h1 className="countdown-number">{countdown}</h1>
        <p>Get ready!</p>
      </div>
    );
  }

  // Game board
  if (gameState?.phase === "playing") {
    return (
      <GameBoard
        gameState={gameState}
        playCard={playCard}
        drawCard={drawCard}
        requestFlip={requestFlip}
        playerId={socketId}
        gamePlayers={gamePlayers}
      />
    );
  }

  // Results screen
  if (gameState?.phase === "finished") {
    return (
      <Results
        winner={gameState.winner}
        winnerId={gameState.winnerId}
        opponentCardsLeft={gameState.opponentCardsLeft}
        playerId={socketId}
        playerName={name}
        onPlayAgain={sendPlayAgain}
      />
    );
  }

  // Waiting room
  return (
    <div className="lobby-container">
      <div className="waiting-room">
        <h2>⏳ Waiting for Players</h2>
        
        <div className="players-list">
          {lobbyPlayers?.map((p) => (
            <div key={p.id} className={`player-item ${p.ready ? 'ready' : 'waiting'}`}>
              <span className="player-name">{p.name}</span>
              <span className="player-status">
                {p.ready ? '✅ Ready' : '⏳ Waiting'}
              </span>
            </div>
          ))}
          
          {lobbyPlayers?.length < 2 && (
            <div className="player-item empty">
              <span className="player-name">Waiting for opponent...</span>
            </div>
          )}
        </div>

        <button 
          onClick={sendReady} 
          className="ready-button"
          disabled={lobbyPlayers?.find(p => p.id === socketId)?.ready}
        >
          {lobbyPlayers?.find(p => p.id === socketId)?.ready ? '✅ Ready!' : 'Ready Up'}
        </button>
        
        {lobbyPlayers?.length === 2 && lobbyPlayers.every(p => p.ready) && (
          <p className="starting-message">Game starting soon...</p>
        )}
      </div>
    </div>
  );
}