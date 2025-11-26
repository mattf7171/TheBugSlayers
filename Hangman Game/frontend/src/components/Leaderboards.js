import { useEffect, useState } from 'react';
import './Leaderboards.css';

export default function Leaderboards({ results }) {
  const [allScores, setAllScores] = useState([]);
  const [showAllScores, setShowAllScores] = useState(false);

  useEffect(() => {
    // Fetch all historical scores when component mounts
    fetch('http://localhost:4000/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        console.log('Fetched leaderboard data:', data); 
        setAllScores(data);
      })
      .catch(error => {
        console.error('Error fetching leaderboard:', error);
      });
  }, []);

  // Debug current results
  console.log('Current match results:', results);

  // Transform the current match results to match the database format
  const transformedResults = results ? results.flatMap(match => 
    match.players.map(player => ({
      playerName: player.name,
      word: match.phrase,
      guesses: match.totalGuesses,
      wasSuccessful: player.wasSuccessful !== undefined ? player.wasSuccessful : (player.role === 'guesser' && match.outcome === 'win'),
      wordSource: match.mode,
      role: player.role,
      round: match.round,
      createdAt: new Date() 
    }))
  ) : [];

  const displayResults = showAllScores ? allScores : transformedResults;

  console.log('Display results:', displayResults);

  if (!displayResults || displayResults.length === 0) {
    return (
      <div className="leaderboard-container">
        <h2>Game Results</h2>
        <div className="no-results">No results yet. Play a game to see results here!</div>
        <div className="leaderboard-actions">
          <button onClick={() => window.location.reload()}>Play Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <h2>{showAllScores ? 'All Game Results' : 'Match Results'}</h2>
      
      <div className="leaderboard-actions">
        <button 
          onClick={() => setShowAllScores(!showAllScores)}
          className="toggle-button"
        >
          {showAllScores ? 'Show Current Match' : 'Show All Games'}
        </button>
        <button onClick={() => window.location.reload()}>Play Again</button>
      </div>

      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Word</th>
            <th>Guesses</th>
            <th>Result</th>
            <th>Source</th>
            <th>Role</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {displayResults.map((result, idx) => (
            <tr key={idx} className={result.wasSuccessful ? 'success-row' : 'failure-row'}>
              <td><strong>{result.playerName || 'Unknown Player'}</strong></td>
              <td className="word-cell">{result.word || 'No word'}</td>
              <td>{result.guesses || 0}</td>
              <td className={result.wasSuccessful ? 'success' : 'failure'}>
                {result.wasSuccessful ? 'Won' : 'Lost'}
              </td>
              <td>{result.wordSource === 'random' ? 'Database' : 'Manual'}</td>
              <td>{result.role || 'Unknown'}</td>
              <td>{result.createdAt ? new Date(result.createdAt).toLocaleDateString() : 'No date'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}