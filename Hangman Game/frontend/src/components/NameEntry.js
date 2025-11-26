// frontend/src/components/NameEntry.js
import { useState, useEffect } from 'react';
import { socket } from '../socket';

export default function NameEntry({ onRegistered }) {
  const [name, setName] = useState('');

  useEffect(() => {
    const handler = (data) => {
      onRegistered(data.name);
    };
    socket.on('player:registered', handler);
    return () => socket.off('player:registered', handler);
  }, [onRegistered]);

  const register = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    socket.emit('player:register', { name: trimmed });
  };

  return (
    <>
      <div className="field-group">
        <label className="field-label">Player name</label>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Matt, SlayerOne…"
        />
        <span className="helper-text">
          This name will appear in the session info and match results.
        </span>
      </div>

      <button
        className="btn-primary"
        onClick={register}
        disabled={!name.trim()}
      >
        Join Game
      </button>
    </>
  );
}
