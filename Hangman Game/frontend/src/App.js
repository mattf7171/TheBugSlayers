import { useState, useEffect } from 'react';
import { socket } from './socket';
import NameEntry from './components/NameEntry';
import HangmanBoard from './components/HangmanBoard';
import SecretChooser from './components/SecretChooser';
import Leaderboards from './components/Leaderboards';

export default function App() {
  const [playerName, setPlayerName] = useState(null);
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null); // 'setter' or 'guesser'
  const [phase, setPhase] = useState('waiting');
  const [masked, setMasked] = useState('');
  const [guesses, setGuesses] = useState({ correct: [], wrong: [] });
  const [maxWrong, setMaxWrong] = useState(6);
  const [outcome, setOutcome] = useState(null);
  const [playersWithRoles, setPlayersWithRoles] = useState([]);
  const [secretWord, setSecretWord] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [matchResults, setMatchResults] = useState(null);

  useEffect(() => {
    socket.on('players:update', (names) => {
      console.log('Players update:', names);
      setPlayers(names);
    });
    socket.on('role', (data) => {
      console.log('Role assigned:', data.role);
      setRole(data.role);
    });
    socket.on('phase:update', ({ phase }) => {
      console.log('Phase update:', phase);
      setPhase(phase);
      if (phase === 'chooseSecret') {
        setSecretWord(null); // clear the old word
      }
    });
    socket.on('round:state', (s) => {
      console.log('Round state:', s);
      setPhase(s.phase);
      setMasked(s.masked);
      setGuesses(s.guesses);
      setMaxWrong(s.maxWrong);
      setOutcome(s.outcome || null);

      if (s.phase === 'finished') {
        // Start a countdown (currently set to 4 seconds)
        let timeLeft = 4;
        setCountdown(timeLeft);

        const interval = setInterval(() => {
          timeLeft -= 1;
          setCountdown(timeLeft);
          if (timeLeft <= 0) {
            clearInterval(interval);
            setCountdown(null); // clear when done
          }
        }, 1000);
      }
    });
    socket.on('roles:update', (payload) => {
      setPlayersWithRoles(payload.players);
      // Find myself in the updated list and set my role
      const me = payload.players.find(p => p.id === socket.id);
      if (me) {
        setRole(me.role);
      }
    });
    socket.on('round:secret', ({ secret }) => {
      setSecretWord(secret);
    })
    socket.on('match:results', (payload) => {
      setMatchResults(payload.results);
    });
    return () => {
      socket.off('players:update');
      socket.off('role');
      socket.off('phase:update');
      socket.off('round:state');
      socket.off('roles:update');
      socket.off('round:secret');
      socket.off('match:results');
    };
  }, []);

  if (!playerName) {
    return <NameEntry onRegistered={setPlayerName} />;
  }

  // Phase handling
  if (phase === 'waiting') {
    return (
      <div>
        <h2>Waiting for another player...</h2>
        <p>Players connected: {players.join(', ')}</p>
      </div>
    );
  }

  if (phase === 'chooseSecret') {
    if (role === 'setter') return <SecretChooser />;
    return <div>Waiting for setter to choose a new word...</div>;
  }

  if (phase === 'playing' || phase === 'finished') {
    return (
      <HangmanBoard
        role={role}
        masked={masked}
        guesses={guesses}
        maxWrong={maxWrong}
        outcome={outcome}
        secretWord={secretWord}
        countdown={countdown}
      />
    );
  }

  if (phase === 'matchOver') {
    return <Leaderboards results={matchResults} />;
  }

  return <div>Waiting for game state...</div>;
}
