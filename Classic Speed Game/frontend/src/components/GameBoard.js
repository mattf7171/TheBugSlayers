import React from "react";
import "../styles/GameBoard.css";
import { useDrag } from "react-dnd";
import { useDrop } from "react-dnd";

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
  const leftTop = centerPiles.left?.[centerPiles.left.length - 1] || null;
  const rightTop = centerPiles.right?.[centerPiles.right.length - 1] || null;
  return hand.some((card) =>
    isPlayable(card, leftTop) || isPlayable(card, rightTop)
  );
}

function DraggableCard({ cardId, value, suit }) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: "CARD",
    item: { cardId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={dragRef}
      className="card"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {value} {suit}
    </div>
  );
}

function DropPile({ pileName, topCard, onDrop }) {
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: "CARD",
    drop: (item) => onDrop(item.cardId, pileName),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={dropRef}
      className="pile"
      style={{
        backgroundColor: isOver ? "#d0ffd0" : "transparent",
      }}
    >
      <h4>{pileName}</h4>
      <div className="card">
        {topCard ? `${topCard.value} ${topCard.suit}` : "Empty"}
      </div>
    </div>
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

  // ✅ Hooks must always run first
  const gamePlayersRef = React.useRef(gamePlayers);
  gamePlayersRef.current = gamePlayers;

  // ✅ Now safe to early-return
  if (!gameState) return <div>Loading game...</div>;
  if (!playerId || !gamePlayers || !gamePlayers[playerId]) {
    return <div>Loading your cards...</div>;
  }

  const { centerPiles, sidePiles } = gameState;
  const leftTop = centerPiles.left?.[centerPiles.left.length - 1] || null;
  const rightTop = centerPiles.right?.[centerPiles.right.length - 1] || null;


  const me = gamePlayers[playerId];
  const myHand = me.hand;

  const playerIds = Object.keys(gamePlayers);
  const opponentId = playerIds.find(id => id !== playerId);
  const opponent = gamePlayers[opponentId];

  console.log("Frontend hand IDs:", myHand.map((c) => c.id));

  // Use latest gamePlayers when a drop occurs, to avoid stale closures
  const handleDrop = (cardId, pile) => {
    const latestMe = gamePlayersRef.current[playerId];
    const latestHand = latestMe?.hand || [];

    console.log("handleDrop → latestHand IDs:", latestHand.map(c => c.id));
    console.log("handleDrop → cardId:", cardId);

    const card = latestHand.find(c => c.id === cardId);
    if (!card) {
      console.warn("Card not found in latest hand:", cardId, latestHand);
      return;
    }

    playCard(card.id, pile);
  };


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
          <DropPile pileName="left" topCard={leftTop} onDrop={handleDrop} />
          <DropPile pileName="right" topCard={rightTop} onDrop={handleDrop} />
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
          <div>
            You: {gameState.flipVotes?.[playerId] ? "✅ Voted" : "⏳ Not yet"}
          </div>
          <div>
            {opponent?.name}:{" "}
            {gameState.flipVotes?.[opponentId] ? "✅ Voted" : "⏳ Not yet"}
          </div>
        </div>
      </div>

      {/* Player Section */}
      <div className="player-section">
        <h3>{me?.name}</h3>

        <div className="player-hand">
          {myHand.map((card) => (
            <DraggableCard
              key={card.id}
              cardId={card.id}
              value={card.value}
              suit={card.suit}
            />
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
