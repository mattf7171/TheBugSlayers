import { useEffect, useState } from 'react';

export default function HighScores() {
  const [scores, setScores] = useState([]);

  useEffect(() => {
    fetch('http://localhost:4000/api/results')
      .then(res => res.json())
      .then(setScores);
  }, []);

  return (
    <div>
      <h2>High Scores</h2>
      <ul>
        {scores.map((s, i) => (
          <li key={i}>
            {s.playerName} guessed "{s.phrase}" in {s.numberOfGuesses} tries ({s.success ? 'Success' : 'Fail'})
          </li>
        ))}
      </ul>
    </div>
  );
}
