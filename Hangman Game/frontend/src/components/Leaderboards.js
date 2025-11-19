export default function Leaderboards({ results }) {
  if (!results || results.length === 0) return <div>No results yet</div>;

  return (
    <div>
      <h2>Match Results</h2>
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Phrase</th>
            <th>Total Guesses</th>
            <th>Mode</th>
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
              <td>{r.mode === 'random' ? 'Database' : 'Hand typed'}</td>
              <td>{r.outcome === 'win' ? 'Guesser successful' : 'Guesser failed'}</td>
              <td>
                {r.players.map(p => `${p.name} (${p.role})`).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
