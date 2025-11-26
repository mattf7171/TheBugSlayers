require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// in memory session store
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
});

app.use(sessionMiddleware);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true
  }
});

// share sessions with sockets
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// in memory random word database
const randomWords = [
  'javascript', 'python', 'database', 'algorithm', 'variable', 
  'function', 'framework', 'debugging', 'website', 'browser',
  'computer', 'programming', 'software', 'hardware', 'network',
  'react', 'nodejs', 'express', 'mongodb', 'api',
  'json', 'authentication', 'encryption', 'server', 'client',
  'protocol', 'keyboard', 'monitor', 'syntax', 'hangman'
];

// Track players and game state
const players = [];
const game = {
  phase: 'waiting',
  secretBySetter: null,
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

function getRandomWord() {
  return randomWords[Math.floor(Math.random() * randomWords.length)];
}

// in memory storage for leaderboard
let leaderboardData = [];

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
      chosen = getRandomWord();
      console.log(`Selected random word: "${chosen}"`);
    }
    
    game.secretBySetter = chosen;
    game.secretMode = mode;
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
    
    io.to(socket.id).emit('round:secret', { secret: chosen });
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
      
      // FIXED: Create proper results structure with correct wasSuccessful calculation
      const roundResult = {
        round: game.round,
        phrase: game.secretBySetter,
        totalGuesses: totalGuesses,
        mode: game.secretMode,
        outcome: game.lastOutcome,
        players: players.map(p => ({ 
          name: p.name, 
          role: p.role,
          wasSuccessful: (p.role === 'guesser' && won) || (p.role === 'setter' && lost)
        })),
      };

      game.results.push(roundResult);

      console.log(`Round ${game.round} finished - Word: "${game.secretBySetter}", Outcome: ${won ? 'WIN' : 'LOSE'}`);
      console.log('Round results:', roundResult);

      io.emit('round:state', {
        phase: game.phase,
        masked: game.masked,
        guesses: game.guesses,
        maxWrong: game.maxWrong,
        outcome: won ? 'win' : 'lose'
      });

      // swap roles by identity (not array index)
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
          
          const dbResults = game.results.flatMap(match => 
            match.players.map(player => ({
              playerName: player.name,
              word: match.phrase,
              guesses: match.totalGuesses,
              wasSuccessful: player.wasSuccessful, 
              wordSource: match.mode,
              role: player.role,
              round: match.round,
              createdAt: new Date()
            }))
          );

          leaderboardData = [...leaderboardData, ...dbResults];
          console.log('Results saved to leaderboard:', dbResults);
          
          io.emit('phase:update', { phase: 'matchOver' });
          io.emit('match:results', { results: game.results });
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
      }, 4000);
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
    console.log('Socket disconnected:', socket.id);
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx !== -1) players.splice(idx, 1);
    io.emit('players:update', players.map(p => p.name));
  });
});

// API Routes for leaderboard
app.get('/api/results', (req, res) => {
  console.log(' Fetching leaderboard data, total entries:', leaderboardData.length);
  res.json(leaderboardData);
});

app.get('/api/leaderboard', (req, res) => {
  console.log(' Fetching leaderboard data, total entries:', leaderboardData.length);
  res.json(leaderboardData);
});

app.post('/api/results', (req, res) => {
  try {
    const { results } = req.body;
    console.log(' Saving results via API:', results);
    
    // transform results for storage
    const dbResults = results.flatMap(match => 
      match.players.map(player => ({
        playerName: player.name,
        word: match.phrase,
        guesses: match.totalGuesses,
        wasSuccessful: player.wasSuccessful,
        wordSource: match.mode,
        role: player.role,
        round: match.round,
        createdAt: new Date()
      }))
    );

    leaderboardData = [...leaderboardData, ...dbResults];
    console.log(' Results saved via API:', dbResults.length, 'entries');
    res.json({ success: true, added: dbResults.length });
  } catch (error) {
    console.error('Error saving results:', error);
    res.status(500).json({ error: 'Failed to save results' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const stats = leaderboardData.reduce((acc, result) => {
      const playerName = result.playerName;
      if (!acc[playerName]) {
        acc[playerName] = {
          playerName,
          totalGames: 0,
          wins: 0,
          totalGuesses: 0
        };
      }
      
      acc[playerName].totalGames++;
      acc[playerName].wins += result.wasSuccessful ? 1 : 0;
      acc[playerName].totalGuesses += result.guesses;
      
      return acc;
    }, {});
    
    const statsArray = Object.values(stats).map(stat => ({
      ...stat,
      losses: stat.totalGames - stat.wins,
      winRate: stat.totalGames > 0 ? Math.round((stat.wins / stat.totalGames) * 100) : 0,
      averageGuesses: stat.totalGames > 0 ? Math.round(stat.totalGuesses / stat.totalGames) : 0
    })).sort((a, b) => b.winRate - a.winRate);
    
    res.json(statsArray);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Debug endpoint to check current data
app.get('/api/debug-results', (req, res) => {
  res.json({
    currentGameResults: game.results,
    leaderboardData: leaderboardData,
    players: players.map(p => ({ name: p.name, role: p.role })),
    gameState: {
      phase: game.phase,
      round: game.round,
      players: players.length
    }
  });
});

// Clear leaderboard data (for testing)
app.delete('/api/clear-results', (req, res) => {
  const previousCount = leaderboardData.length;
  leaderboardData = [];
  game.results = [];
  console.log('Cleared all results. Previous count:', previousCount);
  res.json({ success: true, cleared: previousCount });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    totalGames: leaderboardData.length,
    randomWordsCount: randomWords.length,
    connectedPlayers: players.length
  });
});

// Test endpoint to verify random words
app.get('/api/test-random', (req, res) => {
  const testWords = [];
  for (let i = 0; i < 5; i++) {
    testWords.push(getRandomWord());
  }
  res.json({ testWords });
});

server.listen(4000, () => {
  console.log(' Backend running on http://localhost:4000');
  console.log(' Random words available:', randomWords.length);
  console.log(' - http://localhost:4000/api/health');
  console.log(' - http://localhost:4000/api/test-random');
});