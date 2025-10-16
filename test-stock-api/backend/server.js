const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

app.get('/api/stock-price', async (req, res) => {
  const { symbol, date, direction } = req.query; // direction: 'next' or 'previous'
  const apiKey = process.env.POLYGON_API_KEY;

  try {
    // Get a 1-year range around the requested date
    const from = '2024-01-01';
    const to = '2025-12-31';

    const response = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}`, {
      params: {
        apiKey,
        sort: 'asc',
        limit: 5000,
      },
    });

    const results = response.data.results;
    if (!results || results.length === 0) {
      return res.status(404).json({ error: 'No historical data found.' });
    }

    // Convert requested date to timestamp
    const requestedTs = new Date(date).getTime();

    // Find the closest date based on direction
    let fallback;
    if (direction === 'next') {
      fallback = results.find(r => r.t > requestedTs);
    } else {
      fallback = [...results].reverse().find(r => r.t <= requestedTs);
    }

    if (!fallback) {
      return res.status(404).json({ error: `No ${direction} trading day found from ${date}.` });
    }

    const fallbackDate = new Date(fallback.t).toISOString().split('T')[0];
    const price = fallback.c;

    res.json({ symbol, date: fallbackDate, price });
  } catch (error) {
    console.error('Polygon API error:', error.message);
    res.status(500).json({ error: 'Polygon API request failed.' });
  }
});



const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
