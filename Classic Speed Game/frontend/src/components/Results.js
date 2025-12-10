import React, { useState, useEffect, useRef } from 'react';
import '../styles/Results.css';

export default function Results({ winner, winnerId, opponentCardsLeft, playerId, playerName, onPlayAgain }) {
  const [gameHistory, setGameHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readyForRematch, setReadyForRematch] = useState(false);
  const hasSaved = useRef(false);  // ✅ FIX: Prevent duplicate saves

  const didIWin = winnerId === playerId;

  useEffect(() => {
    // ✅ FIX: Only save once per game result
    if (hasSaved.current) return;
    
    // Save game result to database
    const saveResult = async () => {
      try {
        hasSaved.current = true;  // Mark as saved immediately
        
        await fetch('http://localhost:4000/api/game-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName,
            won: didIWin,
            opponentCardsLeft: didIWin ? opponentCardsLeft : null,
          }),
        });

        // Fetch game history
        const response = await fetch(`http://localhost:4000/api/game-history/${playerName}`);
        const data = await response.json();
        setGameHistory(data.history || []);
      } catch (err) {
        console.error('Error with game results:', err);
        hasSaved.current = false;  // Allow retry on error
      } finally {
        setLoading(false);
      }
    };

    saveResult();
  }, []); // ✅ FIX: Empty dependency array - only run once

  const handlePlayAgain = () => {
    setReadyForRematch(true);
    onPlayAgain();
  };

  return (
    <div className="results-overlay">
      <div className="results-card">
        <div className={`results-header ${didIWin ? 'win' : 'loss'}`}>
          <h1>{didIWin ? '🎉 Victory!' : '😔 Defeat'}</h1>
          <h2>Winner: {winner}</h2>
          {didIWin && opponentCardsLeft > 0 && (
            <p className="cards-left">Opponent had {opponentCardsLeft} cards remaining</p>
          )}
        </div>

        <div className="results-body">
          <h3>Your Game History</h3>
          {loading ? (
            <p>Loading history...</p>
          ) : gameHistory.length === 0 ? (
            <p>No previous games found</p>
          ) : (
            <div className="history-list">
              {gameHistory.map((game, idx) => (
                <div key={idx} className={`history-item ${game.result}`}>
                  <span className="result-badge">
                    {game.result === 'win' ? '🏆 Win' : '❌ Loss'}
                  </span>
                  <span className="date">
                    {new Date(game.timestamp).toLocaleDateString()} {new Date(game.timestamp).toLocaleTimeString()}
                  </span>
                  {game.opponentCardsLeft && (
                    <span className="opponent-cards">
                      Opponent: {game.opponentCardsLeft} cards left
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="results-actions">
          <button 
            onClick={handlePlayAgain}
            className={`play-again-button ${readyForRematch ? 'ready' : ''}`}
            disabled={readyForRematch}
          >
            {readyForRematch ? '⏳ Waiting for opponent...' : '🔄 Play Again'}
          </button>
        </div>
      </div>
    </div>
  );
}