import React from "react";
import "../styles/GameBoard.css";

function isPlayable(card, pileCard) {
  if (!pileCard) return false;

  const cardValue = card.value;
  const pileValue = pileCard.value;

  return (
    Math.abs(cardValue - pileValue) === 1 ||
    (cardValue === 1 && pileValue === 13) ||
    (cardValue === 13 && pileValue === 1)
  );
}

function hasPlayableCard(hand, centerPiles) {
  return hand.some(card =>
    isPlayable(card, centerPiles.left) ||
    isPlayable(card, centerPiles.right)
  );
}


export default function GameBoard({
  gameState,
  playCard,
  drawCard,
  requestFlip,
  playerId,
  gamePlayers,
}) {
  if (!gameState) return <div>Loading game...</div>;

  const { centerPiles, sidePiles } = gameState;

  // ✅ Prevent crash when playerId isn't ready yet
  if (!playerId || !gamePlayers || !gamePlayers[playerId]) {
    return <div>Loading your cards...</div>;
  }

  const me = gamePlayers[playerId];

  const opponentId = Object.keys(gamePlayers).find((id) => id !== playerId);
  const opponent = gamePlayers[opponentId];

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
        <h3>
          {opponent?.name} — Draw: {opponent.drawCount}
        </h3>

      </div>

      {/* Center Area */}
      <div className="center-area">
        <div className="side-pile left">
          <h4>Side Pile L ({sidePiles.left.length})</h4>
          <div className="card-stack">
            {sidePiles?.left?.length > 0 ? (
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
          <h4>Side Pile R ({sidePiles.right.length})</h4>
          <div className="card-stack">
            {sidePiles?.right?.length > 0 ? (
              <div className="card back"></div>
            ) : (
              <div className="empty">Empty</div>
            )}
          </div>
        </div>

        <div className="flip-status">
          <h4>Flip Votes</h4>
          <div>You: {gameState.flipVotes?.[playerId] ? "✅ Voted" : "⏳ Not yet"}</div>
          <div>
            {opponent?.name}: {gameState.flipVotes?.[opponentId] ? "✅ Voted" : "⏳ Not yet"}
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
              onClick={() => {
                if (isPlayable(card, centerPiles.left)) {
                  playCard(card, "left");
                } else if (isPlayable(card, centerPiles.right)) {
                  playCard(card, "right");
                }
                console.log('Playing card:', card);
              }}
            >
              {card.value} {card.suit}
            </div>
          ))}
        </div>

        <h3>
          {me?.name} — Draw: {me.drawCount}
        </h3>


        <div className="actions">
          <button
            onClick={() => {
              if (hasPlayableCard(myHand, centerPiles)) {
                alert("You have a playable card!");
                return;
              }
              requestFlip();
            }}
          >
            Flip
          </button>

        </div>
      </div>
    </div>
  );
}
