export default function Results({ winner, onPlayAgain }) {
  return (
    <div className="results-screen">
      <h1>Game Over</h1>
      <h2>Winner: {winner}</h2>

      <button onClick={onPlayAgain}>Play Again</button>
    </div>
  );
}
