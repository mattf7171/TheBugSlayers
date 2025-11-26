export default function Leaderboards({ results }) {
  if (!results || results.length === 0) {
    return <div>No results for this match yet.</div>;
  }

  return (
    <div>
      <p className="card-subtitle">
        Summary of the two rounds you just played. Roles swapped after the first round.
      </p>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Phrase</th>
              <th>Guesses</th>
              <th>Source</th>
              <th>Outcome</th>
              <th>Players</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => (
              <tr key={idx}>
                <td>{r.round}</td>
                <td>{r.phrase}</td>
                <td>{r.totalGuesses}</td>
                <td>
                  <span className="mode-pill">
                    {r.mode === 'random' ? 'Database' : 'Hand typed'}
                  </span>
                </td>
                <td>
                  {r.outcome === 'win' ? (
                    <span className="badge-success">Guesser successful</span>
                  ) : (
                    <span className="badge-fail">Guesser failed</span>
                  )}
                </td>
                <td>
                  {r.players.map((p) => `${p.name} (${p.role})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
