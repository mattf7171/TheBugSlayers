require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');
const connectDB = require('./db');

const app = express();

// --- middleware ---
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true },
});

app.use(sessionMiddleware);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:3000', credentials: true },
});

// share sessions with socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// --- in-memory match state ---
const players = [];
const game = {
  phase: 'waiting',
  players: {},
  deck: [],
  centerPiles: { left: [], right: [] },
  sidePiles: { left: [], right: [] },
  flipVotes: {},
  winner: null,
  gameStartTime: null,
};

// --- MongoDB API Routes ---
app.post('/api/game-result', async (req, res) => {
  try {
    const { playerName, won, opponentCardsLeft } = req.body;
    
    if (!playerName) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const db = await connectDB();
    const results = db.collection('gameResults');

    await results.insertOne({
      playerName,
      result: won ? 'win' : 'loss',
      opponentCardsLeft: won ? opponentCardsLeft : null,
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving game result:', err);
    res.status(500).json({ error: 'Failed to save game result' });
  }
});

app.get('/api/game-history/:playerName', async (req, res) => {
  try {
    const { playerName } = req.params;
    
    if (!playerName) {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const db = await connectDB();
    const results = db.collection('gameResults');

    const history = await results
      .find({ playerName })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    res.json({ history });
  } catch (err) {
    console.error('Error fetching game history:', err);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// --- socket handlers ---
// This is the main entry point for all real-time communication.
// Every new browser tab / refresh creates a new socket connection.
// All game actions (register, ready, play card, draw, flip, etc.) flow through here.
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Player registration
  socket.on('player:register', ({ name }) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;

    socket.request.session.playerName = trimmed;
    socket.request.session.save(); // save player name

    const existingIdx = players.findIndex((p) => p.id === socket.id);
    if (existingIdx !== -1) {
      players.splice(existingIdx, 1);
    }

    // only allow 2 players
    if (players.length >= 2) {
      socket.emit('lobby:full', { message: 'Game is full. Please wait.' });
      return;
    }

    players.push({ id: socket.id, name: trimmed, ready: false });

    // Broadcast updated lobby state
    socket.emit('player:registered', { name: trimmed, playerId: socket.id });
    io.emit('players:update', players);
  });

  // Player ready
  socket.on('player:ready', () => {
    const p = players.find((p) => p.id === socket.id);
    if (!p) return;

    p.ready = true;
    io.emit('players:update', players);

    // start game only when exactly 2 players exist and are both ready
    const allReady = players.length === 2 && players.every((p) => p.ready);
    if (allReady) {
      startCountdownAndStartGame();
    }
  });

  // Card Play, uses backend game logic to validate/apply a move
  socket.on('card:play', ({ cardId, pile }) => {
    handleCardPlay(socket, socket.id, cardId, pile);
  });

  // Draw Card
  socket.on('card:draw', () => {
    handleDraw(socket.id);
  });

  // Flip Request
  socket.on('pile:flipRequest', () => {
    game.flipVotes[socket.id] = true;
    io.emit('pile:flipStatus', game.flipVotes); // broadcast vote status

    const allVoted = Object.keys(game.players).every((id) => game.flipVotes[id] === true);
    if (allVoted) {
      // reshuffle if both side piles are empty
      if (game.sidePiles.left.length === 0 && game.sidePiles.right.length === 0) {
        if (noMovesAvailable()) {
          reshuffleCenterPiles();
        }
      } else {
        flipSidePiles();
      }
    }
  });

  // Play Again
  socket.on('game:playAgain', () => {
    const p = players.find((p) => p.id === socket.id);
    if (!p) return;

    p.ready = true;
    io.emit('players:update', players);

    const allReady = players.length === 2 && players.every((p) => p.ready);
    if (allReady) {
      resetGameState();
      startCountdownAndStartGame();
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    // remove from lobby
    const idx = players.findIndex((p) => p.id === socket.id);
    if (idx !== -1) {
      players.splice(idx, 1);
    }

    // remove from game state
    delete game.players[socket.id];
    delete game.flipVotes[socket.id];

    // if game was active, end immediately
    if (game.phase === 'playing') {
      resetGameState();
      io.emit('game:finished', { winner: null, reason: 'player_disconnected' });
    }

    io.emit('players:update', players);
  });
});

// ---------------- GAME LOGIC ----------------
// Start Game, called when both players are ready
function startSpeedGame() {
  resetGameState();
  game.deck = buildShuffleDeck();
  game.gameStartTime = Date.now();

  // Deal cards to each player
  players.forEach((p) => {
    game.flipVotes[p.id] = false;
    game.players[p.id] = {
      name: p.name,
      hand: game.deck.splice(0, 5),       // 5 cards to hand
      drawPile: game.deck.splice(0, 15),  // 15 cards to draw pile
    };
  });

  // initialize side and center piles
  game.sidePiles.left = game.deck.splice(0, 5);
  game.sidePiles.right = game.deck.splice(0, 5);
  game.centerPiles.left = [game.deck.pop()];
  game.centerPiles.right = [game.deck.pop()];
  game.phase = 'playing';

  // send full game state to both players
  io.emit('game:start', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    phase: game.phase,
  });
}

// Build and Shuffle Deck
function buildShuffleDeck() {
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  const deck = [];

  // Build the deck
  for (const s of suits) {
    for (const v of values) {
      deck.push({
        id: `${s}-${v}-${Math.random().toString(36).slice(2)}`,
        value: v,
        suit: s,
      });
    }
  }

  // shuffle using Fisher-Yates shuffle method
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Handle Card Play
function handleCardPlay(socket, playerId, cardId, pile) {
  const player = game.players[playerId];
  if (!player) return;

  // validate card exists in player's hand
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) {
    console.log('ERROR: Card not found in hand:', cardId);
    return;
  }

  // validate pile exists and has a top card
  const pileStack = game.centerPiles[pile];
  if (!pileStack || pileStack.length === 0) return;

  const topCard = pileStack[pileStack.length - 1];

  // card must be plus or minus 1
  const isValid =
    Math.abs(card.value - topCard.value) === 1 ||
    (card.value === 1 && topCard.value === 13) ||
    (card.value === 13 && topCard.value === 1);

  if (!isValid) return;

  // apply the play
  player.hand = player.hand.filter((c) => c.id !== card.id);
  game.centerPiles[pile].push(card);

  // refill hand if possible
  if (player.drawPile.length > 0 && player.hand.length < 5) {
    player.hand.push(player.drawPile.shift());
  }

  // Win condition
  if (player.hand.length === 0 && player.drawPile.length === 0) {
  game.phase = 'finished';
  game.winner = playerId;
  
  // determine opponent's cards left
  const playerIds = Object.keys(game.players);
  const opponentId = playerIds.find(id => id !== playerId);
  const opponent = game.players[opponentId];
  const opponentCardsLeft = opponent.hand.length + opponent.drawPile.length;

  // Save game results to database (backend side, once per game)
  saveGameResults(player.name, opponent.name, opponentCardsLeft);

  // broadcast the game is over
  io.emit('game:finished', { 
    winner: player.name,
    winnerId: playerId,
    loserId: opponentId,
    opponentCardsLeft
  });
  return;
}

// any valid play resets flip votes
  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  // broadcase updated game state
  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

// Start Countdown and game
function startCountdownAndStartGame() {
  let seconds = 3;
  io.emit('game:countdown', { seconds });

  const interval = setInterval(() => {
    seconds -= 1;
    if (seconds > 0) {
      io.emit('game:countdown', { seconds });   // broadcast updated countdown
    } else {
      clearInterval(interval);
      io.emit('game:countdown', { seconds: 0 });
      startSpeedGame();   // start game once countdown finishes
    }
  }, 1000);
}

// Handle draw
function handleDraw(playerId) {
  const player = game.players[playerId];
  if (!player) return;

  // check if pile is not empty and hand needs a card
  if (player.drawPile.length > 0 && player.hand.length < 5) {
    player.hand.push(player.drawPile.shift());
  }

  // broadcast full game update
  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

// Flip side piles
function flipSidePiles() {
  // flip one card from side pile into center pile
  const leftCard = game.sidePiles.left.pop();
  const rightCard = game.sidePiles.right.pop();

  if (leftCard) game.centerPiles.left.push(leftCard);
  if (rightCard) game.centerPiles.right.push(rightCard);

  // reset flip votes
  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  // broadcast update
  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

// Reshuffle center piles
function reshuffleCenterPiles() {
  console.log('RESHUFFLING center piles...');

  const pileCards = [...game.centerPiles.left, ...game.centerPiles.right];
  
  if (pileCards.length < 2) {
    console.log('Not enough cards to reshuffle');
    return;
  }

  // clear center piles before rebuilding
  game.centerPiles.left = [];
  game.centerPiles.right = [];

  // shuffle collected cards
  for (let i = pileCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pileCards[i], pileCards[j]] = [pileCards[j], pileCards[i]];
  }

  // place one card into each center pile
  game.centerPiles.left.push(pileCards.pop());
  game.centerPiles.right.push(pileCards.pop());

  // split remaining cards into new side piles
  const remaining = pileCards;
  const half = Math.ceil(remaining.length / 2);

  game.sidePiles.left = remaining.slice(0, half);
  game.sidePiles.right = remaining.slice(half);

  // reset flip votes
  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  // broadcast update
  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
    reshuffled: true,
  });
}

// No moves available
function noMovesAvailable() {
  const leftStack = game.centerPiles.left;
  const rightStack = game.centerPiles.right;

  if (!leftStack.length || !rightStack.length) return false;

  const leftTop = leftStack[leftStack.length - 1];
  const rightTop = rightStack[rightStack.length - 1];
  const piles = [leftTop.value, rightTop.value];

  // check every player's hand for a valid move
  for (const playerId in game.players) {
    const player = game.players[playerId];
    for (const card of player.hand) {
      for (const pileValue of piles) {
        const isValid =
          Math.abs(card.value - pileValue) === 1 ||
          (card.value === 1 && pileValue === 13) ||
          (card.value === 13 && pileValue === 1);
        if (isValid) return false;
      }
    }
  }

  return true;
}

// Sanitize game state
function sanitizeGameStateForClients() {
  const result = {};
  for (const [id, p] of Object.entries(game.players)) {
    result[id] = {
      name: p.name,
      hand: p.hand.map((c) => ({ ...c })),  // deep copy
      drawCount: p.drawPile.length,
    };
  }
  return result;
}

// Reset game state
function resetGameState() {
  game.phase = 'waiting';
  game.players = {};
  game.deck = [];
  game.centerPiles = { left: [], right: [] };
  game.sidePiles = { left: [], right: [] };
  game.flipVotes = {};
  game.winner = null;
  game.gameStartTime = null;

  // reset lobby readiness
  players.forEach((p) => (p.ready = false));
}

// Helper function to save game results
async function saveGameResults(winnerName, loserName, loserCardsLeft) {
  try {
    const db = await connectDB();
    const results = db.collection('gameResults');

    // Save winner's result
    await results.insertOne({
      playerName: winnerName,
      result: 'win',
      opponentCardsLeft: loserCardsLeft,
      timestamp: new Date(),
    });

    // Save loser's result
    await results.insertOne({
      playerName: loserName,
      result: 'loss',
      opponentCardsLeft: null,
      timestamp: new Date(),
    });

    console.log('Game results saved for:', winnerName, 'and', loserName);
  } catch (err) {
    console.error('Error saving game results:', err);
  }
}

// --- start server ---
server.listen(4000, () =>
  console.log('Backend running on http://localhost:4000')
);