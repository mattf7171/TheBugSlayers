import React, { useState, useEffect } from 'react';
import '../styles/Results.css';

// Results component
export default function Results({ winner, winnerId, opponentCardsLeft, playerId, playerName, onPlayAgain }) {
  const [gameHistory, setGameHistory] = useState([]); // player's historical match data
  const [loading, setLoading] = useState(true); // loading state for history fetch
  const [readyForRematch, setReadyForRematch] = useState(false);  // play again

  // determine if player won
  const didIWin = winnerId === playerId;

  useEffect(() => {
    // Only FETCH history, don't save (backend already saved it)
    const fetchHistory = async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/game-history/${playerName}`);
        const data = await response.json();
        setGameHistory(data.history || []);
      } catch (err) {
        console.error('Error fetching game history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [playerName]);

  // Play again?
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