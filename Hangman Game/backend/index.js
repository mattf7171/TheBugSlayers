require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
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
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
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
  phase: 'waiting', // 'waiting' -> 'chooseSecret' -> 'playing' -> 'finished' -> 'matchOver'
  secretBySetter: null, // kept server-side only
  secretMode: null, // 'manual' | 'random'
  masked: '',
  guesses: { correct: [], wrong: [] },
  maxWrong: 6,
  round: 1,
  lastOutcome: null,
  results: [],
};

function computeMasked(secret, correctGuesses) {
  const set = new Set(correctGuesses.map((c) => c.toLowerCase()));
  return secret
    .split('')
    .map((ch) => {
      const isAlpha = /[a-z]/i.test(ch);
      if (!isAlpha) return ch;
      return set.has(ch.toLowerCase()) ? ch : '_';
    })
    .join('');
}

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

    // once there are 2 players, assign roles and start
    if (players.length === 2 && game.phase === 'waiting') {
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
    const me = players.find((p) => p.id === socket.id);
    if (!me || me.role !== 'setter') return;

    let chosen = '';
    try {
      if (mode === 'manual') {
        chosen = (secret || '').trim();
      } else if (mode === 'random') {
        const db = await connectDB();

        // Try to sample a random document
        const wordDoc = await db
          .collection('phrases')
          .aggregate([{ $sample: { size: 1 } }])
          .next();

        // Accept either { text: 'word' } or { phrase: 'word' }
        chosen = (wordDoc?.text || wordDoc?.phrase || '').trim();

        if (!chosen) {
          console.warn(
            'Random phrase: no documents or missing text/phrase field; using fallback'
          );
        } else {
          console.log('Random phrase chosen:', chosen);
        }
      }
    } catch (err) {
      console.error('Error choosing secret word:', err);
    }

    // Fallback if something went wrong or DB was empty
    if (!chosen) {
      chosen = 'fallback phrase';
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
      outcome: null,
    });

    // Only the setter ever sees the answer
    io.to(socket.id).emit('round:secret', { secret: chosen });
  });

  // guesser submits a letter
  socket.on('round:guess', async ({ letter }) => {
    const me = players.find((p) => p.id === socket.id);
    if (!me || me.role !== 'guesser') return;
    if (game.phase !== 'playing') return;
    if (!game.secretBySetter) return;

    const l = (letter || '').toLowerCase();
    if (!/^[a-z]$/.test(l)) return;

    if (
      game.guesses.correct.includes(l) ||
      game.guesses.wrong.includes(l)
    ) {
      return; // already guessed
    }

    if (game.secretBySetter.toLowerCase().includes(l)) {
      game.guesses.correct.push(l);
    } else {
      game.guesses.wrong.push(l);
    }

    game.masked = computeMasked(game.secretBySetter, game.guesses.correct);

    const won = !game.masked.includes('_');
    const lost = game.guesses.wrong.length >= game.maxWrong;

    if (!won && !lost) {
      // still playing: just broadcast new state
      io.emit('round:state', {
        phase: game.phase,
        masked: game.masked,
        guesses: game.guesses,
        maxWrong: game.maxWrong,
        outcome: null,
      });
      return;
    }

    // end of round
    game.phase = 'finished';
    game.lastOutcome = won ? 'win' : 'lose';
    const totalGuesses =
      game.guesses.correct.length + game.guesses.wrong.length;

    game.results.push({
      round: game.round,
      phrase: game.secretBySetter,
      totalGuesses,
      mode: game.secretMode,
      outcome: game.lastOutcome,
      players: players.map((p) => ({ name: p.name, role: p.role })),
    });

    io.emit('round:state', {
      phase: game.phase,
      masked: game.masked,
      guesses: game.guesses,
      maxWrong: game.maxWrong,
      outcome: game.lastOutcome,
    });

    // swap roles for next round
    const currentSetter = players.find((p) => p.role === 'setter');
    const currentGuesser = players.find((p) => p.role === 'guesser');
    if (currentSetter && currentGuesser) {
      currentSetter.role = 'guesser';
      currentGuesser.role = 'setter';
    }

    // small pause, then either next round or show leaderboard
    setTimeout(async () => {
      game.round += 1;

      if (game.round > 2) {
        // match is over, persist to DB and show all prior results
        game.phase = 'matchOver';

        try {
          const db = await connectDB();
          const docsToInsert = game.results.map((r) => ({
            ...r,
            createdAt: new Date(),
          }));
          if (docsToInsert.length > 0) {
            await db.collection('results').insertMany(docsToInsert);
          }

          const allResults = await db
            .collection('results')
            .find()
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

          io.emit('phase:update', { phase: 'matchOver' });
          io.emit('match:results', { results: allResults });
        } catch (err) {
          console.error('Error saving/fetching results:', err);
          io.emit('phase:update', { phase: 'matchOver' });
          io.emit('match:results', { results: game.results });
        }

        return;
      }

      // prepare next round
      game.secretBySetter = null;
      game.secretMode = null;
      game.guesses = { correct: [], wrong: [] };
      game.masked = '';
      game.phase = 'chooseSecret';

      io.emit('roles:update', {
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
        })),
      });

      io.emit('phase:update', { phase: 'chooseSecret' });
    }, 4000);
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
});

// REST endpoint for high scores (all prior results)
app.get('/api/results', async (req, res) => {
  try {
    const db = await connectDB();
    const results = await db
      .collection('results')
      .find()
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json(results);
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ error: 'Failed to load results' });
  }
});

server.listen(4000, () => console.log('Backend running on http://localhost:4000'));
