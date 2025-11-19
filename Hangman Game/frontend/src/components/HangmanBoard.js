import { socket } from '../socket';

export default function HangmanBoard({ role, masked, guesses, maxWrong, outcome, secretWord, countdown }) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const onGuess = (l) => {
    if (role !== 'guesser' || outcome) return;
    socket.emit('round:guess', { letter: l });
  };

  return (
    <div>
      <h2>{masked}</h2>
      <p>Wrong: {guesses.wrong.join(', ')} ({guesses.wrong.length}/{maxWrong})</p>
      <p>Correct: {guesses.correct.join(', ')}</p>

      {outcome ? (
        <div>
          <p>{outcome === 'win' ? 'Guesser won!' : 'Guesser lost!'}</p>
          {countdown !== null && (
            <p>Next round starting in {countdown}...</p>
          )}
        </div>
        
      ) : role === 'guesser' ? (
        <div>
          {letters.map((l) => (
            <button
              key={l}
              onClick={() => onGuess(l)}
              disabled={guesses.correct.includes(l) || guesses.wrong.includes(l)}
            >
              {l}
            </button>
          ))}
        </div>
      ) : (
        <div>
          <p><strong>Secret word: </strong> {secretWord}</p>
          <p>Waiting for guesses…</p>
          </div>
      )}
    </div>
  );
}
