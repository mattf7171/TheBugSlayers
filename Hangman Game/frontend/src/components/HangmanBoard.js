import { socket } from '../socket';
import './HangmanBoard.css';

export default function HangmanBoard({ role, masked, guesses, maxWrong, outcome, secretWord, countdown }) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const onGuess = (l) => {
    if (role !== 'guesser' || outcome) return;
    socket.emit('round:guess', { letter: l });
  };

  const getKeyClass = (letter) => {
    let className = 'keyboard-key';
    if (guesses.correct.includes(letter)) className += ' correct';
    if (guesses.wrong.includes(letter)) className += ' wrong';
    return className;
  };

  return (
    <div className="hangman-board">
      <h2>{masked}</h2>
      
      <div className="status-section">
        <p className="wrong-guesses">Wrong: {guesses.wrong.join(', ')} ({guesses.wrong.length}/{maxWrong})</p>
        <p className="correct-guesses">Correct: {guesses.correct.join(', ')}</p>
      </div>

      {outcome ? (
        <div className="outcome-message">
          <p>{outcome === 'win' ? 'Guesser won!' : 'Guesser lost!'}</p>
          {countdown !== null && (
            <p className="countdown">Next round starting in {countdown}...</p>
          )}
        </div>
        
      ) : role === 'guesser' ? (
        <div className="keyboard-container">
          {letters.map((l) => (
            <button
              key={l}
              className={getKeyClass(l)}
              onClick={() => onGuess(l)}
              disabled={guesses.correct.includes(l) || guesses.wrong.includes(l)}
            >
              {l}
            </button>
          ))}
        </div>
      ) : (
        <div className="secret-word-display">
          <p><strong>Secret word: </strong> <span className="secret-word">{secretWord}</span></p>
          <p>Waiting for guesses…</p>
        </div>
      )}
    </div>
  );
}