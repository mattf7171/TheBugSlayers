// frontend/src/components/SecretChooser.js
import { useState } from 'react';
import { socket } from '../socket';

export default function SecretChooser() {
  const [mode, setMode] = useState('manual');
  const [secret, setSecret] = useState('');

  const submit = () => {
    socket.emit('secret:choose', { mode, secret });
  };

  const manualDisabled = mode === 'manual' && !secret.trim();

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '0.75rem',
        }}
      >
        <label className="field-label">How do you want to choose the phrase?</label>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="radio"
              checked={mode === 'manual'}
              onChange={() => setMode('manual')}
            />
            <span>Enter manually</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="radio"
              checked={mode === 'random'}
              onChange={() => setMode('random')}
            />
            <span>Random from database</span>
          </label>
        </div>

        {mode === 'manual' && (
          <div className="field-group" style={{ marginTop: '0.5rem' }}>
            <label className="field-label">Secret phrase</label>
            <input
              className="text-input"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Type a word or phrase (letters only will be hidden)"
            />
            <span className="helper-text">
              Only you see this. The other player just sees blanks and guesses letters.
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button
          className="btn-primary"
          onClick={submit}
          disabled={manualDisabled}
        >
          Lock In Secret
        </button>
      </div>
    </>
  );
}
