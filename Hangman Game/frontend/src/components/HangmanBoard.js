import { socket } from '../socket';

function HangmanDrawing({ wrongCount }) {
  // 0–6 mistakes → progressively draw parts
  const parts = {
    head: wrongCount > 0,
    body: wrongCount > 1,
    armLeft: wrongCount > 2,
    armRight: wrongCount > 3,
    legLeft: wrongCount > 4,
    legRight: wrongCount > 5,
  };

  return (
    <svg
      viewBox="0 0 140 170"
      width="100%"
      height="180"
      style={{ display: 'block' }}
    >
      {/* gallows */}
      <line x1="10" y1="160" x2="130" y2="160" stroke="#2d5a2d" strokeWidth="5" />
      <line x1="35" y1="160" x2="35" y2="15" stroke="#2d5a2d" strokeWidth="5" />
      <line x1="35" y1="15" x2="95" y2="15" stroke="#2d5a2d" strokeWidth="5" />
      <line x1="95" y1="15" x2="95" y2="35" stroke="#2d5a2d" strokeWidth="4" />

      {/* head */}
      {parts.head && (
        <circle cx="95" cy="50" r="15" stroke="#2d5a2d" strokeWidth="4" fill="none" />
      )}

      {/* body */}
      {parts.body && (
        <line x1="95" y1="65" x2="95" y2="105" stroke="#2d5a2d" strokeWidth="4" />
      )}

      {/* arms */}
      {parts.armLeft && (
        <line x1="95" y1="75" x2="78" y2="92" stroke="#2d5a2d" strokeWidth="4" />
      )}
      {parts.armRight && (
        <line x1="95" y1="75" x2="112" y2="92" stroke="#2d5a2d" strokeWidth="4" />
      )}

      {/* legs */}
      {parts.legLeft && (
        <line x1="95" y1="105" x2="82" y2="132" stroke="#2d5a2d" strokeWidth="4" />
      )}
      {parts.legRight && (
        <line x1="95" y1="105" x2="108" y2="132" stroke="#2d5a2d" strokeWidth="4" />
      )}
    </svg>
  );
}

export default function HangmanBoard({
  role,
  masked,
  guesses,
  maxWrong,
  outcome,
  secretWord,
  countdown,
  round,
}) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const onGuess = (l) => {
    if (role !== 'guesser' || outcome) return;
    socket.emit('round:guess', { letter: l });
  };

  const wrongCount = guesses.wrong.length;

  return (
    <div className="board-layout">
      <div className="hangman-figure-wrapper">
        <HangmanDrawing wrongCount={wrongCount} />
        <div className="masked-word">
          {masked || '—'}
        </div>
        <p className="guess-summary">
          Wrong guesses: {wrongCount}/{maxWrong}
        </p>
      </div>

      <div>
        {outcome ? (
          <>
            <p className={`outcome-text ${outcome === 'win' ? 'win' : 'lose'}`}>
              {outcome === 'win' ? 'Guesser found the phrase!' : 'Guesser ran out of chances.'}
            </p>
            {countdown !== null && (
              <p className="session-muted">
                {round === 1
                  ? `Next round starting in ${countdown}...`
                  : `Game ends in ${countdown}...`
                }
              </p>
            )}
          </>
        ) : role === 'guesser' ? (
          <>
            <p className="session-muted">
              Tap letters to guess the phrase. Each wrong guess adds a new piece to the
              hangman.
            </p>
            <div className="keyboard-grid">
              {letters.map((l) => {
                const used =
                  guesses.correct.includes(l) || guesses.wrong.includes(l);
                return (
                  <button
                    key={l}
                    onClick={() => onGuess(l)}
                    disabled={used}
                  >
                    {l.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="session-muted">
              You chose this secret phrase. Your opponent is currently guessing letters.
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              <strong>Secret:</strong> {secretWord || '—'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
