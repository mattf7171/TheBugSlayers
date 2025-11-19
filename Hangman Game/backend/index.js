require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Server } = require('socket.io');
const connectDB = require('./db');

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: { httpOnly: true }
});
app.use(sessionMiddleware);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: 'http://localhost:3000', credentials: true } });

// Share sessions with sockets
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Track players and game state
const players = [];
const game = {
  phase: 'waiting',    // 'waiting' -> 'chooseSecret' -> 'playing' -> 'finished'
  secretBySetter: null, // only stored server-side
  masked: '',
  guesses: { correct: [], wrong: [] },
  maxWrong: 6,
  round: 1,
  lastOutcome: null,
  results: []
};

function computeMasked(secret, correctGuesses) {
  const set = new Set(correctGuesses.map(c => c.toLowerCase()));
  return secret
    .split('')
    .map(ch => {
      const isAlpha = /[a-z]/i.test(ch);
      if (!isAlpha) return ch;
      return set.has(ch.toLowerCase()) ? ch : '_';
    })
    .join('');
}


io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Register player
  socket.on('player:register', ({ name }) => {
    console.log(`Received player:register from ${name}`);
    socket.request.session.playerName = name;
    socket.request.session.save();

    players.push({ id: socket.id, name });

    socket.emit('player:registered', { name });
    io.emit('players:update', players.map(p => p.name));

    // When 2 players are present, assign roles and start
    if (players.length === 2) {
      players[0].role = 'setter';
      players[1].role = 'guesser';
      game.phase = 'chooseSecret';
      io.to(players[0].id).emit('role', { role: 'setter' });
      io.to(players[1].id).emit('role', { role: 'guesser' });
      io.emit('phase:update', { phase: game.phase });
    }
  });

  // Setter chooses secret (manual or random)
  socket.on('secret:choose', async ({ mode, secret }) => {
    const me = players.find(p => p.id === socket.id);
    if (!me || me.role !== 'setter') return;

    let chosen = '';
    if (mode === 'manual') {
      chosen = (secret || '').trim();
    } else if (mode === 'random') {
      const db = await connectDB();
      const wordDoc = await db.collection('phrases').aggregate([{ $sample: { size: 1 } }]).next();
      chosen = (wordDoc?.text || 'default phrase').trim();
    }

    game.secretBySetter = chosen;
    game.secretMode = mode; // 'manual' or 'random'
    game.guesses = { correct: [], wrong: [] };
    game.masked = computeMasked(chosen, game.guesses.correct);
    game.phase = 'playing';
    game.lastOutcome = null; 

    io.emit('round:state', {
      phase: game.phase,
      masked: game.masked,
      guesses: game.guesses,
      maxWrong: game.maxWrong,
      outcome: null
    });

    io.to(socket.id).emit('round:secret', {secret: chosen });
  });

  // Guesser makes a guess
  socket.on('round:guess', ({ letter }) => {
    const me = players.find(p => p.id === socket.id);
    if (!me || me.role !== 'guesser') return;
    if (game.phase !== 'playing') return;

    const l = (letter || '').toLowerCase();
    if (!/^[a-z]$/.test(l)) return;
    if (game.guesses.correct.includes(l) || game.guesses.wrong.includes(l)) return;

    if (game.secretBySetter.toLowerCase().includes(l)) {
      game.guesses.correct.push(l);
    } else {
      game.guesses.wrong.push(l);
    }

    game.masked = computeMasked(game.secretBySetter, game.guesses.correct);

    const won = !game.masked.includes('_');
    const lost = game.guesses.wrong.length >= game.maxWrong;

    if (won || lost) {
      // End of round: show outcome once
      game.phase = 'finished';

      game.lastOutcome = won ? 'win' : 'lose';
      const totalGuesses = game.guesses.correct.length + game.guesses.wrong.length;

      game.results.push({
        round: game.round,
        phrase: game.secretBySetter,
        totalGuesses,
        mode: game.secretMode,
        outcome: game.lastOutcome,
        players: players.map(p => ({ name: p.name, role: p.role })),
      });

      io.emit('round:state', {
        phase: game.phase,
        masked: game.masked,
        guesses: game.guesses,
        maxWrong: game.maxWrong,
        outcome: won ? 'win' : 'lose'
      });

      // Swap roles by identity (not array index)
      const currentSetter = players.find(p => p.role === 'setter');
      const currentGuesser = players.find(p => p.role === 'guesser');
      if (currentSetter && currentGuesser) {
        currentSetter.role = 'guesser';
        currentGuesser.role = 'setter';
      }

      setTimeout(() => {
        // Prepare next round
        game.round += 1;

        if (game.round > 2) {
          game.phase = 'matchOver';
          io.emit('phase:update', {phase: 'matchOver'});

          io.emit('match:results', {
            results: game.results
          });
          return;
        }

        game.secretBySetter = null;
        game.guesses = { correct: [], wrong: [] };
        game.masked = '';
        game.phase = 'chooseSecret';

        // Broadcast updated roles so each client updates its own role
        io.emit('roles:update', {
          players: players.map(p => ({ name: p.name, role: p.role, id: p.id }))
        });

        // Notify everyone of the new phase
        io.emit('phase:update', { phase: 'chooseSecret' });
      }, 4000)

      // IMPORTANT: do not emit another round:state here
      return;
    }

    // Continue round: broadcast updated state
    io.emit('round:state', {
      phase: game.phase,
      masked: game.masked,
      guesses: game.guesses,
      maxWrong: game.maxWrong
    });
  });

  socket.on('disconnect', () => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx !== -1) players.splice(idx, 1);
    io.emit('players:update', players.map(p => p.name));
  });
});

app.get('/api/results', async (req, res) => {
  const db = await connectDB();
  const results = await db.collection('results').find().sort({ createdAt: -1 }).limit(50).toArray();
  res.json(results);
});

server.listen(4000, () => console.log('Backend running on http://localhost:4000'));
