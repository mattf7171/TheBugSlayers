require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
// const MongoStore = require('connect-mongo');
const { Server } = require('socket.io');
//const connectDB = require('./db');

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
    // store: MongoStore.create({
    //     clientPromise: (async () => {
    //         const client = new MongoClient(process.env.MONGO_URI);
    //         await client.connect();
    //         return client;
    //     })(),
    //     dbName: process.env.MONGO_DB_NAME || 'speedgame',
    //     collectionName: 'sessions',
    // }),


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
  phase: 'waiting', // waiting → ready → playing → finished
  players: {},      // { socketId: { name, hand: [], pile: [] } }
  deck: [],
  centerPiles: {
    left: null,
    right: null,
  },
  sidePiles: {
    left: [],
    right: []
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

        // avoid duplicates if they reconnect
        const existing = players.find((p) => p.id === socket.id);
        if (!existing) {
            players.push({ id: socket.id, name: trimmed });
        } else {
            existing.name = trimmed;
        }

        socket.emit('player:registered', { name: trimmed });
        io.emit(
            'players:update',
            players.map((p) => p.name)
        );
    }); // end player register

    // both players are ready
    socket.on('player:ready', () => { 
        // player ready logic
        const p = players.find(p => p.id === socket.id);
        if (!p) return;

        p.ready = true;

        io.emit('players:update', players);

        const allReady = players.length === 2 && players.every(p => p.ready);
        if (allReady) {
            startCountdownAndStartGame();
        }
    });

    // Player attempts to play a card
    socket.on('card:play', ({ card, pile }) => {
        // card play logic
        handleCardPlay(socket.id, card, pile);
    });

    // Player draws from deck
    socket.on('card:draw', () => {
        // draw card logic
        handleDraw(socket.id);
    });

    // Flip the side piles if voted
    socket.on('pile:flipRequest', () => {
        // Allow flipping only if no moves exist
        if (!noMovesAvailable()) {
            // Optional: tell the player they cannot flip yet
            socket.emit('pile:flipDenied', { reason: "Moves still available" });
            return;
        }

        // Record vote
        game.flipVotes[socket.id] = true;

        // Broadcast vote status
        io.emit('pile:flipStatus', game.flipVotes);

        // Check for both players' votes
        const allVoted = Object.values(game.flipVotes).every(v => v === true);

        if (allVoted) {
            flipSidePiles();
        }
    });

    socket.on('disconnect', () => {
        const idx = players.findIndex((p) => p.id === socket.id);
        if (idx !== -1) {
            players.splice(idx, 1);
            io.emit(
                'players:update',
                players.map((p) => p.name)
            );
        }
    });
}); // end io.on connection

function startSpeedGame() {
    // reset game in case users are playing again
    resetGameState();

    // Build and shuffle the deck
    game.deck = buildShuffleDeck();

    // Initialize the Player objects
    players.forEach(p=> {
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
    game.centerPiles.left = game.deck.pop();
    game.centerPiles.right = game.deck.pop();

    // Set phase
    game.phase = 'playing';

    // Broadcast
    io.emit('game:start', {
        players: sanitizeGameStateForClients(),
        centerPiles: game.centerPiles,
        phase: game.phase,
    });
}

function buildShuffleDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [1,2,3,4,5,6,7,8,9,10,11,12,13];

    const deck = [];
    for (const s of suits) {
        for (const v of values) {
            deck.push({ value: v, suit: s });
        }
    }

    // Shuffle ( Fisher-Yates shuffle )
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

function handleCardPlay(playerId, card, pile) {
    const player = game.players[playerId];
    if (!player) return;
    if (!game.centerPiles[pile]) return;

    const pileValue = game.centerPiles[pile].value;
    const cardValue = card.value;

    const isValid =
        Math.abs(cardValue - pileValue) === 1 ||
        (cardValue === 1 && pileValue === 13) ||
        (cardValue === 13 && pileValue === 1);

    if (!isValid) return;

    // Remove card from hand
    player.hand = player.hand.filter(c => !(c.value === cardValue && c.suit === card.suit));

    // Update pile
    game.centerPiles[pile] = card;

    // Refill hand if possible
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

    // Broadcast updated state
    io.emit('game:update', {
        players: sanitizeGameStateForClients(),
        centerPiles: game.centerPiles,
    });
}

function startCountdownAndStartGame() {
    let seconds = 3;

    // Broadcast countdown
    io.emit('game:countdown', { seconds });

    const interval = setInterval(() => {
        seconds -= 1;

        if (seconds > 0) {
            io.emit('game:countdown', { seconds });
        } else {
            clearInterval(interval);
            io.emit('game:countdown', { seconds: 0 });

            // start game
            startSpeedGame();
        }
    }, 1000);
}

function handleDraw(playerId) {
    const player = game.players[playerId];
    if (!player) return;

    if (player.drawPile.length > 0 && player.hand.length < 5) {
        player.hand.push(player.drawPile.pop());
    }

    io.emit('game:update', {
        players: sanitizeGameStateForClients(),
        centerPiles: game.centerPiles,
    });
}

function flipSidePiles() {
    // If either pile is empty, reshuffle center piles instead
    if (game.sidePiles.left.length === 0 || game.sidePiles.right.length === 0) {
        reshuffleCenterPiles();
        return;
    }

    // Flip one card from each side pile
    const leftCard = game.sidePiles.left.pop();
    const rightCard = game.sidePiles.right.pop();

    game.centerPiles.left = leftCard;
    game.centerPiles.right = rightCard;

    // Reset votes
    for (const id in game.flipVotes) {
        game.flipVotes[id] = false;
    }

    io.emit('game:update', {
        players: sanitizeGameStateForClients(),
        centerPiles: game.centerPiles,
        sidePiles: {
            left: game.sidePiles.left.length,
            right: game.sidePiles.right.length
        }
    });
}

function reshuffleCenterPiles() {
    const pileCards = [];

    // Collect all cards from center piles
    if (game.centerPiles.left) pileCards.push(game.centerPiles.left);
    if (game.centerPiles.right) pileCards.push(game.centerPiles.right);

    // Shuffle them
    for (let i = pileCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pileCards[i], pileCards[j]] = [pileCards[j], pileCards[i]];
    }

    // Reset center piles
    game.centerPiles.left = pileCards.pop();
    game.centerPiles.right = pileCards.pop();

    // Reset votes
    for (const id in game.flipVotes) {
        game.flipVotes[id] = false;
    }

    io.emit('game:update', {
        players: sanitizeGameStateForClients(),
        centerPiles: game.centerPiles,
        reshuffled: true
    });
}

function noMovesAvailable() {
    const left = game.centerPiles.left;
    const right = game.centerPiles.right;

    if (!left || !right) return false;

    const piles = [left.value, right.value];

    // check every player's hand
    for (const playerId in game.players) {
        const player = game.players[playerId];

        for (const card of player.hand) {
            const v = card.value;

            for (const pileValue of piles) {
                const isValid = Math.abs(v - pileValue) === 1 || (v === 1 && pileValue === 13) || (v === 13 && pileValue === 1);

                if (isValid) {
                    return false; // someone can play a card
                }
            }
        }
    }

    return true; // No moves are available
}

function sanitizeGameStateForClients() {
    const result = {};
    for (const [id, p] of Object.entries(game.players)) {
        result[id] = {
            name: p.name,
            hand: p.hand,
            drawCount: p.drawPile.length,
        };
    }

    return result;
}

function resetGameState() {
    game.phase = 'waiting';
    game.players = {};
    game.deck = [];
    game.centerPiles = { left: null, right: null };
    game.sidePiles = { left: [], right: []};
    game.flipVotes = {};
    game.winner = null;

    players.forEach(p => p.ready = false);
}

// --- start server after seeding phrases (if needed) ---
(async () => {
  server.listen(4000, () =>
    console.log('Backend running on http://localhost:4000')
  );
})();
