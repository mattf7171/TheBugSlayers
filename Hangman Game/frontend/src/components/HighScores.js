import { useEffect, useState } from 'react';

export default function HighScores() {
  const [scores, setScores] = useState([]);

  useEffect(() => {
    fetch('http://localhost:4000/api/results')
      .then((res) => res.json())
      .then((data) => setScores(data))
      .catch((err) => {
        console.error('Error loading high scores:', err);
      });
  }, []);

  if (!scores || scores.length === 0) {
    return (
      <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
        No prior games saved yet.
      </div>
    );
  }

  return (
    <div className="table-wrapper" style={{ maxHeight: 260, overflowY: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Phrase</th>
            <th>Guesses</th>
            <th>Source</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s, i) => (
            <tr key={i}>
              <td>{s.playerName}</td>
              <td>{s.phrase}</td>
              <td>{s.totalGuesses}</td>
              <td>
                <span className="mode-pill">
                  {s.mode === 'random' ? 'Database' : 'Hand typed'}
                </span>
              </td>
              <td>
                {s.success ? (
                  <span className="badge-success">Success</span>
                ) : (
                  <span className="badge-fail">Failed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
