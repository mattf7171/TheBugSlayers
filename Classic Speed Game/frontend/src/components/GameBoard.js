import React from "react";
import "../styles/GameBoard.css";
import { useDrag } from "react-dnd";
import { useDrop } from "react-dnd";

// Determine if card is playable
function isPlayable(card, pileCard) {
  if (!pileCard) return false;

  const cardValue = card.value;
  const pileValue = pileCard.value;

  // speed rules
  return (
    Math.abs(cardValue - pileValue) === 1 ||
    (cardValue === 1 && pileValue === 13) ||
    (cardValue === 13 && pileValue === 1)
  );
}

// check for any playable card
function hasPlayableCard(hand, centerPiles) {
  const leftTop = centerPiles.left?.[centerPiles.left.length - 1] || null;
  const rightTop = centerPiles.right?.[centerPiles.right.length - 1] || null;
  return hand.some((card) =>
    isPlayable(card, leftTop) || isPlayable(card, rightTop)
  );
}

// Get card image
function getCardImageUrl(value, suit) {
  // Map card values to their display names
  const valueMap = {
    1: 'A',
    11: 'J',
    12: 'Q',
    13: 'K',
    10: '0'  // Deck of Cards API uses '0' for 10
  };
  
  const displayValue = valueMap[value] || value;
  
  // Capitalize first letter of suit
  const suitCap = suit.charAt(0).toUpperCase() + suit.slice(1);
  
  // Using public domain card images from deckofcardsapi.com
  return `https://deckofcardsapi.com/static/img/${displayValue}${suitCap.charAt(0)}.png`;
}

// Draggable Card - make cards draggable
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
      <img 
        src={getCardImageUrl(value, suit)} 
        alt={`${value} of ${suit}`}
        className="card-image"
      />
    </div>
  );
}

// Drop pile - center piles
function DropPile({ pileName, topCard, onDrop, canDrop }) {
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
      className={`pile ${isOver ? 'pile-hover' : ''}`}
    >
      <div className="card">
        {topCard ? (
          <img 
            src={getCardImageUrl(topCard.value, topCard.suit)} 
            alt={`${topCard.value} of ${topCard.suit}`}
            className="card-image"
          />
        ) : (
          <div className="empty-pile">Empty</div>
        )}
      </div>
    </div>
  );
}

// Gameboard component
export default function GameBoard({
  gameState,
  playCard,
  drawCard,
  requestFlip,
  playerId,
  gamePlayers,
}) {
  // Keep the latest gamePlaers in a ref
  const gamePlayersRef = React.useRef(gamePlayers);
  gamePlayersRef.current = gamePlayers;

  // early loading states
  if (!gameState) return <div>Loading game...</div>;
  if (!playerId || !gamePlayers || !gamePlayers[playerId]) {
    return <div>Loading your cards...</div>;
  }

  // extract game state
  const { centerPiles, sidePiles } = gameState;
  const leftTop = centerPiles.left?.[centerPiles.left.length - 1] || null;
  const rightTop = centerPiles.right?.[centerPiles.right.length - 1] || null;

  // identify self and opponent
  const me = gamePlayers[playerId];
  const myHand = me.hand;

  const playerIds = Object.keys(gamePlayers);
  const opponentId = playerIds.find(id => id !== playerId);
  const opponent = gamePlayers[opponentId];

  // gameplay helpers
  const canPlayCard = hasPlayableCard(myHand, centerPiles);
  const canFlip = !canPlayCard;

  // handle drop called when a card is dropped into center piles
  const handleDrop = (cardId, pile) => {
    const latestMe = gamePlayersRef.current[playerId];
    const latestHand = latestMe?.hand || [];

    const card = latestHand.find(c => c.id === cardId);
    if (!card) {
      console.warn("Card not found in latest hand:", cardId);
      return;
    }

    playCard(card.id, pile);
  };

  return (
    <div className="game-board">
      {/* Opponent Section */}
      <div className="opponent-section">
        <h3 className="player-name">{opponent?.name}'s Hand</h3>
        <div className="opponent-hand">
          {opponent &&
            Array(opponent.hand.length)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="card">
                  <img 
                    src="https://deckofcardsapi.com/static/img/back.png" 
                    alt="Card back"
                    className="card-image"
                  />
                </div>
              ))}
        </div>
        <div className="draw-count">
          <span className="card-icon">🎴</span> Draw Pile: {opponent?.drawCount || 0} cards
        </div>
      </div>

      {/* Center Area */}
      <div className="center-area">
        <div className="side-pile left">
          <div className="pile-label">Side Pile</div>
          <div className="card-stack">
            {sidePiles?.left?.length > 0 ? (
              <div className="card">
                <img 
                  src="https://deckofcardsapi.com/static/img/back.png" 
                  alt="Card back"
                  className="card-image"
                />
                <div className="pile-count">{sidePiles.left.length}</div>
              </div>
            ) : (
              <div className="card empty-pile">Empty</div>
            )}
          </div>
        </div>

        <div className="center-piles-container">
          <div className="center-piles">
            <DropPile pileName="left" topCard={leftTop} onDrop={handleDrop} />
            <DropPile pileName="right" topCard={rightTop} onDrop={handleDrop} />
          </div>
          
          <div className="flip-section">
            <button
              onClick={requestFlip}
              disabled={canPlayCard || gameState.flipVotes?.[playerId]}
              className={`flip-button ${gameState.flipVotes?.[playerId] ? 'voted' : ''}`}
            >
              {gameState.flipVotes?.[playerId] ? '✅ Voted to Flip' : '🔄 Request Flip'}
            </button>
            
            <div className="flip-status">
              <div className={gameState.flipVotes?.[playerId] ? 'vote-active' : 'vote-inactive'}>
                You: {gameState.flipVotes?.[playerId] ? '✅' : '⏳'}
              </div>
              <div className={gameState.flipVotes?.[opponentId] ? 'vote-active' : 'vote-inactive'}>
                {opponent?.name}: {gameState.flipVotes?.[opponentId] ? '✅' : '⏳'}
              </div>
            </div>
            
            {canPlayCard && (
              <div className="hint">You have a playable card!</div>
            )}
          </div>
        </div>

        <div className="side-pile right">
          <div className="pile-label">Side Pile</div>
          <div className="card-stack">
            {sidePiles?.right?.length > 0 ? (
              <div className="card">
                <img 
                  src="https://deckofcardsapi.com/static/img/back.png" 
                  alt="Card back"
                  className="card-image"
                />
                <div className="pile-count">{sidePiles.right.length}</div>
              </div>
            ) : (
              <div className="card empty-pile">Empty</div>
            )}
          </div>
        </div>
      </div>

      {/* Player Section */}
      <div className="player-section">
        <h3 className="player-name">Your Hand</h3>

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

        <div className="player-controls">
          <div className="draw-count">
            <span className="card-icon">🎴</span> Draw Pile: {me?.drawCount || 0} cards
          </div>
          
          <button
            onClick={drawCard}
            disabled={me.drawCount === 0 || myHand.length >= 5}
            className="draw-button"
          >
            {me.drawCount === 0 ? 'No Cards to Draw' : 
             myHand.length >= 5 ? 'Hand Full' : 
             '📥 Draw Card'}
          </button>
        </div>
      </div>
    </div>
  );
}