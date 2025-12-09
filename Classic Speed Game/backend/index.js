require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');

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
// NOTE: strictly 2 players; treat refresh as a brand new player.
// This array holds *current* connected players only.
const players = []; // [{ id: socketId, name, ready }]
const game = {
  phase: 'waiting', // waiting → ready → playing → finished
  players: {},      // { socketId: { name, hand: [], drawPile: [] } }
  deck: [],
  centerPiles: {
    left: [],
    right: [],
  },
  sidePiles: {
    left: [],
    right: [],
  },
  flipVotes: {},
  winner: null,
};

// --- socket handlers ---
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // player registers with a name
  socket.on('player:register', ({ name }) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;

    socket.request.session.playerName = trimmed;
    socket.request.session.save();

    // remove any stale entry with this id, then add fresh
    const existingIdx = players.findIndex((p) => p.id === socket.id);
    if (existingIdx !== -1) {
      players.splice(existingIdx, 1);
    }

    // if already 2 players, ignore extra join attempts (or you could queue)
    if (players.length >= 2) {
      console.log('Lobby full; ignoring extra player:', trimmed);
      return;
    }

    players.push({ id: socket.id, name: trimmed, ready: false });

    // send back explicit playerId
    socket.emit('player:registered', { name: trimmed, playerId: socket.id });

    io.emit('players:update', players);
  });

  // both players are ready
  socket.on('player:ready', () => {
    const p = players.find((p) => p.id === socket.id);
    if (!p) return;

    p.ready = true;
    io.emit('players:update', players);

    const allReady = players.length === 2 && players.every((p) => p.ready);
    if (allReady) {
      startCountdownAndStartGame();
    }
  });

  // Player attempts to play a card
  socket.on('card:play', ({ cardId, pile }) => {
    handleCardPlay(socket, socket.id, cardId, pile);
  });

  // Player draws from deck
  socket.on('card:draw', () => {
    handleDraw(socket.id);
  });

  // Flip the side piles if voted
  socket.on('pile:flipRequest', () => {
    game.flipVotes[socket.id] = true;

    io.emit('pile:flipStatus', game.flipVotes);

    const allVoted = Object.values(game.flipVotes).every((v) => v === true);
    if (allVoted && noMovesAvailable()) {
      flipSidePiles();
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);

    // remove from lobby players
    const idx = players.findIndex((p) => p.id === socket.id);
    if (idx !== -1) {
      players.splice(idx, 1);
    }

    // remove from game state
    delete game.players[socket.id];
    delete game.flipVotes[socket.id];

    // if we lose a player during a game, reset everything
    if (game.phase === 'playing') {
      resetGameState();
      io.emit('game:finished', { winner: null, reason: 'player_disconnected' });
    }

    io.emit('players:update', players);
  });
}); // end io.on connection

// ---------------- GAME LOGIC ----------------

function startSpeedGame() {
  // reset game in case users are playing again
  resetGameState();

  // Build and shuffle the deck
  game.deck = buildShuffleDeck();

  // Initialize the Player objects for exactly the 2 players in the lobby
  players.forEach((p) => {
    game.flipVotes[p.id] = false;
    game.players[p.id] = {
      name: p.name,
      hand: game.deck.splice(0, 5),
      drawPile: game.deck.splice(0, 15),
    };
  });

  game.sidePiles.left = game.deck.splice(0, 5);
  game.sidePiles.right = game.deck.splice(0, 5);

  // Initialize center piles
  game.centerPiles.left = [game.deck.pop()];
  game.centerPiles.right = [game.deck.pop()];

  game.phase = 'playing';

  io.emit('game:start', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    phase: game.phase,
  });
}

function buildShuffleDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  const deck = [];
  for (const s of suits) {
    for (const v of values) {
      deck.push({
        id: `${s}-${v}-${Math.random().toString(36).slice(2)}`,
        value: v,
        suit: s,
      });
    }
  }

  // Shuffle (Fisher-Yates shuffle)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function handleCardPlay(socket, playerId, cardId, pile) {
  const player = game.players[playerId];
  if (!player) return;

  const card = player.hand.find((c) => c.id === cardId);
  if (!card) {
    console.log('ERROR: Card not found in hand:', cardId, 'for player', playerId);
    return;
  }

  const pileStack = game.centerPiles[pile];
  if (!pileStack || pileStack.length === 0) return;

  const topCard = pileStack[pileStack.length - 1];
  const pileValue = topCard.value;
  const cardValue = card.value;

  const isValid =
    Math.abs(cardValue - pileValue) === 1 ||
    (cardValue === 1 && pileValue === 13) ||
    (cardValue === 13 && pileValue === 1);

  if (!isValid) return;

  console.log('Player playing card:', playerId);
  console.log('Player hand BEFORE:', player.hand.map((c) => c.id));

  // Remove card from hand
  player.hand = player.hand.filter((c) => c.id !== card.id);

  // Update pile
  game.centerPiles[pile].push(card);

  // Refill only THIS player's hand after a valid play
  if (player.drawPile.length > 0 && player.hand.length < 5) {
    player.hand.push(player.drawPile.pop());
  }

  // Check win
  if (player.hand.length === 0 && player.drawPile.length === 0) {
    game.phase = 'finished';
    game.winner = playerId;
    io.emit('game:finished', { winner: player.name });
    return;
  }

  // Reset flip votes because a valid play happened
  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  // Broadcast updated state
  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

function startCountdownAndStartGame() {
  let seconds = 3;

  io.emit('game:countdown', { seconds });

  const interval = setInterval(() => {
    seconds -= 1;

    if (seconds > 0) {
      io.emit('game:countdown', { seconds });
    } else {
      clearInterval(interval);
      io.emit('game:countdown', { seconds: 0 });

      startSpeedGame();
    }
  }, 1000);
}

function handleDraw(playerId) {
  const player = game.players[playerId];
  if (!player) return;

  console.log('Player drawing:', playerId);
  console.log('Hand BEFORE draw:', player.hand.map((c) => c.id));

  if (player.drawPile.length > 0 && player.hand.length < 5) {
    player.hand.push(player.drawPile.pop());
  }

  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

function flipSidePiles() {
  if (
    game.sidePiles.left.length === 0 &&
    game.sidePiles.right.length === 0 &&
    noMovesAvailable()
  ) {
    reshuffleCenterPiles();
    return;
  }

  const leftCard = game.sidePiles.left.pop();
  const rightCard = game.sidePiles.right.pop();

  if (leftCard) game.centerPiles.left.push(leftCard);
  if (rightCard) game.centerPiles.right.push(rightCard);

  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
  });
}

function reshuffleCenterPiles() {
  console.log('RESHUFFLING...');

  const pileCards = [...game.centerPiles.left, ...game.centerPiles.right];

  console.log('Collected cards:', pileCards);

  game.centerPiles.left = [];
  game.centerPiles.right = [];

  if (pileCards.length < 2) {
    console.log('Not enough cards to reshuffle center piles...');
    return;
  }

  for (let i = pileCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pileCards[i], pileCards[j]] = [pileCards[j], pileCards[i]];
  }

  game.centerPiles.left.push(pileCards.pop());
  game.centerPiles.right.push(pileCards.pop());

  console.log('New center piles:', game.centerPiles);

  const remaining = pileCards;
  const half = Math.ceil(remaining.length / 2);

  game.sidePiles.left = remaining.slice(0, half);
  game.sidePiles.right = remaining.slice(half);
  console.log('New side piles:', game.sidePiles);

  for (const id in game.flipVotes) {
    game.flipVotes[id] = false;
  }

  io.emit('game:update', {
    players: sanitizeGameStateForClients(),
    centerPiles: game.centerPiles,
    sidePiles: game.sidePiles,
    flipVotes: game.flipVotes,
    reshuffled: true,
  });
}

function noMovesAvailable() {
  const leftStack = game.centerPiles.left;
  const rightStack = game.centerPiles.right;

  if (!leftStack.length || !rightStack.length) return false;

  const leftTop = leftStack[leftStack.length - 1];
  const rightTop = rightStack[rightStack.length - 1];

  const piles = [leftTop.value, rightTop.value];

  for (const playerId in game.players) {
    const player = game.players[playerId];

    for (const card of player.hand) {
      const v = card.value;

      for (const pileValue of piles) {
        const isValid =
          Math.abs(v - pileValue) === 1 ||
          (v === 1 && pileValue === 13) ||
          (v === 13 && pileValue === 1);

        if (isValid) {
          return false;
        }
      }
    }
  }

  return true;
}

function sanitizeGameStateForClients() {
  const result = {};
  for (const [id, p] of Object.entries(game.players)) {
    result[id] = {
      name: p.name,
      hand: p.hand.map((c) => ({ ...c })),
      drawCount: p.drawPile.length,
    };
  }
  return result;
}

function resetGameState() {
  game.phase = 'waiting';
  game.players = {};
  game.deck = [];
  game.centerPiles = { left: [], right: [] };
  game.sidePiles = { left: [], right: [] };
  game.flipVotes = {};
  game.winner = null;

  players.forEach((p) => (p.ready = false));
}

// --- start server ---
(async () => {
  server.listen(4000, () =>
    console.log('Backend running on http://localhost:4000')
  );
})();
