import { useState } from 'react';
import { socket } from '../socket';

export default function SecretChooser() {
  const [mode, setMode] = useState('manual');
  const [secret, setSecret] = useState('');

  const submit = () => {
    socket.emit('secret:choose', { mode, secret });
  };

  return (
    <div>
      <h2>Choose a secret word/phrase</h2>
      <label>
        <input
          type="radio"
          checked={mode === 'manual'}
          onChange={() => setMode('manual')}
        />
        Enter manually
      </label>
      <label>
        <input
          type="radio"
          checked={mode === 'random'}
          onChange={() => setMode('random')}
        />
        Random from database
      </label>
      {mode === 'manual' && (
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Type secret"
        />
      )}
      <button onClick={submit}>Submit Secret</button>
    </div>
  );
}
