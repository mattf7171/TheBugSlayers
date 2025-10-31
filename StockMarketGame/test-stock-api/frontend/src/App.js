import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [currentDate, setCurrentDate] = useState('');
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState(null);
  const [error, setError] = useState('');
  

  const fetchPrice = async (direction = 'previous') => {
    try {
      const res = await axios.get('http://localhost:5000/api/stock-price', {
      params: { symbol, date: currentDate, direction },
    });
      console.log('Received from backend:', res.data);
      setPrice(res.data.price);
      setCurrentDate(res.data.date);
      setError('');
    } catch (err) {
      console.error('Fetch error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Could not fetch price.');
      setPrice(null);
    }
  };


  return (
    <div style={{ padding: '2rem' }}>
      <h2>Stock Price Lookup</h2>

      <input
        type="text"
        placeholder="Ticker Symbol (e.g. AAPL)"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
      />
      <input
        type="date"
        value={currentDate}
        onChange={(e) => setCurrentDate(e.target.value)}
      />

      <div style={{ marginTop: '1rem' }}>
        <button onClick={() => fetchPrice('previous')}>Get Price</button>
      </div>

      {price && (
        <p style={{ marginTop: '1rem' }}>
          Price for {symbol} on closest available date ({currentDate}): <strong>${price}</strong>
        </p>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );

}

export default App;
