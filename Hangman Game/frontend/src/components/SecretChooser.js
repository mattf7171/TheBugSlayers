import { useState } from 'react';
import { socket } from '../socket';
import './SecretChooser.css';

export default function SecretChooser() {
  const [mode, setMode] = useState('manual');
  const [secret, setSecret] = useState('');

  const submit = () => {
    if (mode === 'manual' && !secret.trim()) {
      alert('Please enter a secret word!');
      return;
    }
    socket.emit('secret:choose', { mode, secret: secret.trim() });
  };

  return (
    <div className="secret-chooser">
      <h2>Choose a Secret Word/Phrase</h2>
      
      <div className="mode-selection">
        <label className={`mode-option ${mode === 'manual' ? 'selected' : ''}`}>
          <input
            type="radio"
            checked={mode === 'manual'}
            onChange={() => setMode('manual')}
          />
          Enter Manually
        </label>
        <label className={`mode-option ${mode === 'random' ? 'selected' : ''}`}>
          <input
            type="radio"
            checked={mode === 'random'}
            onChange={() => setMode('random')}
          />
          Random from Database
        </label>
      </div>

      {mode === 'manual' && (
        <input
          className="secret-input"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Type your secret word or phrase..."
          maxLength={50}
        />
      )}

      {mode === 'random' && (
        <div className="random-info">
          A random word will be selected from our database
        </div>
      )}

      <button className="submit-secret" onClick={submit}>
        Submit Secret
      </button>
    </div>
  );
}