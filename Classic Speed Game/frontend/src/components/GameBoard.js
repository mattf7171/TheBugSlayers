import React from "react";
import "../styles/GameBoard.css";

export default function GameBoard({
  gameState,
  playCard,
  drawCard,
  requestFlip,
  playerId,
}) {
  if (!gameState) return <div>Loading game...</div>;

  const { players, centerPiles, sidePiles, winner, phase } = gameState;

  // ✅ Prevent crash when playerId isn't ready yet
  if (!playerId || !players[playerId]) {
    return <div>Loading your cards...</div>;
  }

  const me = players[playerId];

  const opponentId = Object.keys(players).find((id) => id !== playerId);
  const opponent = players[opponentId];

  const myHand = me.hand;

  return (
    <div className="game-board">
      {/* Opponent Section */}
      <div className="opponent-section">
        <h3>{opponent?.name}</h3>
        <div className="opponent-hand">
          {opponent &&
            Array(opponent.hand.length)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="card back"></div>
              ))}
        </div>
      </div>

      {/* Center Area */}
      <div className="center-area">
        <div className="side-pile left">
          <h4>Side Pile L</h4>
          <div className="card-stack">
            {sidePiles?.left > 0 ? (
              <div className="card back"></div>
            ) : (
              <div className="empty">Empty</div>
            )}
          </div>
        </div>

        <div className="center-piles">
          <div className="pile">
            <h4>Left</h4>
            <div className="card">
              {centerPiles.left.value} {centerPiles.left.suit}
            </div>
          </div>

          <div className="pile">
            <h4>Right</h4>
            <div className="card">
              {centerPiles.right.value} {centerPiles.right.suit}
            </div>
          </div>
        </div>

        <div className="side-pile right">
          <h4>Side Pile R</h4>
          <div className="card-stack">
            {sidePiles?.right > 0 ? (
              <div className="card back"></div>
            ) : (
              <div className="empty">Empty</div>
            )}
          </div>
        </div>
      </div>

      {/* Player Section */}
      <div className="player-section">
        <h3>{me?.name}</h3>

        <div className="player-hand">
          {myHand.map((card, i) => (
            <div
              key={i}
              className="card"
              onClick={() => playCard(card, "left")} // temporary
            >
              {card.value} {card.suit}
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={drawCard}>Draw</button>
          <button onClick={requestFlip}>Flip</button>
        </div>
      </div>

      {phase === "finished" && (
        <div className="winner-banner">Winner: {winner}</div>
      )}
    </div>
  );
}
