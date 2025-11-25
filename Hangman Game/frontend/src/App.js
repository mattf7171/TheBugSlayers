import { useState, useEffect } from 'react';
import { socket } from './socket';
import NameEntry from './components/NameEntry';
import HangmanBoard from './components/HangmanBoard';
import SecretChooser from './components/SecretChooser';
import Leaderboards from './components/Leaderboards';
import './App.css';

export default function App() {
  const [playerName, setPlayerName] = useState(null);
  const [players, setPlayers] = useState([]);
  const [role, setRole] = useState(null); // 'setter' or 'guesser'
  const [phase, setPhase] = useState('waiting');
  const [masked, setMasked] = useState('');
  const [guesses, setGuesses] = useState({ correct: [], wrong: [] });
  const [maxWrong, setMaxWrong] = useState(6);
  const [outcome, setOutcome] = useState(null);
  const [secretWord, setSecretWord] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [matchResults, setMatchResults] = useState(null);

  useEffect(() => {
    socket.on('players:update', (names) => {
      setPlayers(names);
    });
    socket.on('role', (data) => {
      setRole(data.role);
    });
    socket.on('phase:update', ({ phase }) => {
      setPhase(phase);
      if (phase === 'chooseSecret') {
        setSecretWord(null);
      }
    });
    socket.on('round:state', (s) => {
      setPhase(s.phase);
      setMasked(s.masked);
      setGuesses(s.guesses);
      setMaxWrong(s.maxWrong);
      setOutcome(s.outcome || null);

      if (s.phase === 'finished') {
        let timeLeft = 4;
        setCountdown(timeLeft);
        const interval = setInterval(() => {
          timeLeft -= 1;
          setCountdown(timeLeft);
          if (timeLeft <= 0) {
            clearInterval(interval);
            setCountdown(null);
          }
        }, 1000);
      }
    });
    socket.on('roles:update', (payload) => {
      const me = payload.players.find((p) => p.id === socket.id);
      if (me) setRole(me.role);
    });
    socket.on('round:secret', ({ secret }) => {
      setSecretWord(secret);
    });
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

  // --- name entry screen ---
  if (!playerName) {
    return (
      <div className="App">
        <div className="app-shell fullscreen-center">
          <div className="card">
            <div className="card-header">
              <div>
                <h1 className="app-title">BugSlayers Hangman</h1>
                <p className="app-subtitle">
                  Start by entering your player name to join the 2-player session.
                </p>
              </div>
            </div>
            <NameEntry onRegistered={setPlayerName} />
          </div>
        </div>
      </div>
    );
  }

  // --- main game shell ---
  return (
    <div className="App">
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">BugSlayers Hangman</h1>
          <p className="app-subtitle">
            Take turns choosing phrases and guessing them in real time. Session mode:
            2-Player.
          </p>
        </header>

        {/* Waiting for the 2nd player */}
        {phase === 'waiting' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Waiting Room</span>
              <span className="status-chip">Connected: {players.length}/2</span>
            </div>
            <p>Your name: <strong>{playerName}</strong></p>
            <p className="session-muted">
              Share the game URL with your partner and have them join from another browser or
              incognito window.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              Players connected: {players.join(', ') || 'Just you so far'}
            </p>
          </div>
        )}

        {/* Secret choosing */}
        {phase === 'chooseSecret' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Secret Phrase</span>
              <span className="status-chip">
                You are the {role === 'setter' ? 'Setter' : 'Guesser'}
              </span>
            </div>
            {role === 'setter' ? (
              <>
                <p className="session-muted">
                  Enter a custom phrase, or let the system draw a random one from the database.
                  Your partner will only see blanks.
                </p>
                <SecretChooser />
              </>
            ) : (
              <p>
                Waiting for the <strong>setter</strong> to choose a new word or phrase…
              </p>
            )}
          </div>
        )}

        {/* Gameplay + sidebar */}
        {(phase === 'playing' || phase === 'finished') && (
          <div className="app-grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Hangman Board</span>
                <span className="status-chip">
                  Role: {role === 'setter' ? 'Setter' : 'Guesser'}
                </span>
              </div>
              <HangmanBoard
                role={role}
                masked={masked}
                guesses={guesses}
                maxWrong={maxWrong}
                outcome={outcome}
                secretWord={secretWord}
                countdown={countdown}
              />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Session Info</span>
              </div>
              <div className="session-list">
                <p>
                  <span className="session-label">You:</span> {playerName}
                </p>
                <p>
                  <span className="session-label">Players connected:</span>{' '}
                  {players.length ? players.join(', ') : 'Unknown'}
                </p>
                <p>
                  <span className="session-label">Guesses (wrong):</span>{' '}
                  {guesses.wrong.length}/{maxWrong}
                </p>
                <p>
                  <span className="session-label">Correct letters:</span>{' '}
                  {guesses.correct.join(', ') || '—'}
                </p>
                <p>
                  <span className="session-label">Wrong letters:</span>{' '}
                  {guesses.wrong.join(', ') || '—'}
                </p>

                {outcome && (
                  <p style={{ marginTop: '0.4rem' }}>
                    <span className="session-label">Round result:</span>{' '}
                    {outcome === 'win' ? 'Guesser succeeded' : 'Guesser failed'}
                  </p>
                )}

                {countdown !== null && (
                  <p className="session-muted" style={{ marginTop: '0.25rem' }}>
                    Next round starting in {countdown}…
                  </p>
                )}

                <div className="leaderboard-wrapper">
                  <div className="leaderboard-title-row">
                    <span className="card-section-title">High Scores</span>
                    <span className="badge">Previous match results</span>
                  </div>
                  {matchResults && matchResults.length > 0 ? (
                    <Leaderboards results={matchResults} />
                  ) : (
                    <p className="session-muted">Play through a full match to see results.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match over */}
        {phase === 'matchOver' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Match Results</span>
              <span className="badge">Game complete</span>
            </div>
            <p className="session-muted">
              Below are the most recent rounds played in this session (and prior sessions).
            </p>
            <Leaderboards results={matchResults} />
          </div>
        )}
      </div>
    </div>
  );
}
