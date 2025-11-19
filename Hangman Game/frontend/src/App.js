import { useState, useEffect } from 'react';
import { socket } from './socket';
import NameEntry from './components/NameEntry';
import HangmanBoard from './components/HangmanBoard';
import SecretChooser from './components/SecretChooser';

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
    });
    socket.on('round:state', (s) => {
      console.log('Round state:', s);
      setPhase(s.phase);
      setMasked(s.masked);
      setGuesses(s.guesses);
      setMaxWrong(s.maxWrong);
      setOutcome(s.outcome || null);
    });
    socket.on('roles:update', (payload) => {
      setPlayersWithRoles(payload.players);
      // Find myself in the updated list and set my role
      const me = payload.players.find(p => p.id === socket.id);
      if (me) {
        setRole(me.role);
      }
    });
    return () => {
      socket.off('players:update');
      socket.off('role');
      socket.off('phase:update');
      socket.off('round:state');
      socket.off('roles:update');
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
      />
    );
  }

  return <div>Waiting for game state...</div>;
}
