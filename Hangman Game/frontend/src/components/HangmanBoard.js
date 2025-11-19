import { socket } from '../socket';

export default function HangmanBoard({ role, masked, guesses, maxWrong, outcome }) {
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
        <p>{outcome === 'win' ? 'Guesser won!' : 'Guesser lost!'}</p>
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
        <p>Waiting for guesses…</p>
      )}
    </div>
  );
}
