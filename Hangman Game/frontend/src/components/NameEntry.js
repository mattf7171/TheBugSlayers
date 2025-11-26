import { useState, useEffect } from 'react';
import { socket } from '../socket';
import './NameEntry.css';

export default function NameEntry({ onRegistered }) {
  const [name, setName] = useState('');

  useEffect(() => {
    socket.on('player:registered', (data) => {
      onRegistered(data.name);
    });
    return () => socket.off('player:registered');
  }, [onRegistered]);

  const register = () => {
    socket.emit('player:register', { name });
  };

  return (
    <div>
      <h2>Enter your name</h2>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button onClick={register}>Submit</button>
    </div>
  );
}
