import express from "express";
import cors from "cors";
import axios from "axios";
import dayjs from "dayjs";
import { router as stockRoutes } from "./routes/stockRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", stockRoutes);
app.use(cors());

// This route is used to call the API to get the stock price for a specific date
app.get('/api/stock-price', async (req, res) => {
  const { symbol, date, direction } = req.query; // direction: 'next' or 'previous'
  const apiKey = process.env.POLYGON_API_KEY;

  try {
    const requestedTs = new Date(date).getTime();

    // Dynamically set range around the requested date
    const from = direction === 'next'
      ? new Date(requestedTs).toISOString().split('T')[0]
      : new Date(requestedTs - 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0]; // 1 year before

    const to = direction === 'next'
      ? new Date(requestedTs + 1000 * 60 * 60 * 24 * 365).toISOString().split('T')[0] // 1 year after
      : new Date(requestedTs).toISOString().split('T')[0];

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

    const requestedDay = new Date(requestedTs).toISOString().split("T")[0];

    // The fallback is used to get the next closest date and price (some dates do not have prices)
    let fallback;
    if (direction === "next") {
    fallback = results.find(r => {
        const resultDay = new Date(r.t).toISOString().split("T")[0];
        return resultDay > requestedDay;
    });
    } else {
    fallback = [...results].reverse().find(r => {
        const resultDay = new Date(r.t).toISOString().split("T")[0];
        return resultDay <= requestedDay;
    });
    }

    if (!fallback) {
      return res.status(404).json({ error: `No ${direction} trading day found from ${date}.` });
    }

    // Used for debugging
    console.log("Received request:", { symbol, date, direction });
    console.log("Searching range:", { from, to });
    console.log("Results count:", results.length);
    console.log("Requested timestamp:", requestedTs);

    const fallbackDate = new Date(fallback.t).toISOString().split('T')[0];
    console.log("Fallback date selected:", fallbackDate);
    const price = fallback.c;

    res.json({ symbol, date: fallbackDate, price });
  } catch (error) {
        if (error.response?.status === 429) {
        console.warn("Polygon rate limit hit.");
        return res.status(429).json({ error: "Rate limit exceeded. Please wait and try again." });
    }

    console.error('Polygon API error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
    });
    res.status(500).json({ error: 'Polygon API request failed.' });
  }
});

// This route is used to start the game with a choses Ticker symbol
app.post('/api/start', async (req, res) => {
  const { ticker } = req.body;
  const apiKey = process.env.POLYGON_API_KEY;

  try {
    // date is selected between 1 year to 6 months ago
    const endDate = dayjs.default().subtract(6, 'month');
    const startDate = dayjs.default().subtract(12, 'month');
    const diffDays = endDate.diff(startDate, 'day');
    const randomOffset = Math.floor(Math.random() * diffDays);
    const randomDate = startDate.add(randomOffset, 'day').format('YYYY-MM-DD');

    const response = await axios.get(`https://api.polygon.io/v1/open-close/${ticker}/${randomDate}`, {
      params: { adjusted: true, apiKey }
    });

    const { close } = response.data;

    res.json({
      ticker,
      price: close,
      hiddenDate: randomDate,
      bank: 10000,
      shares: 0,
      investment: 0,
      day: 1,
      history: []
    });
  } catch (error) {
    console.error('Error starting game:', error.message);
    res.status(500).json({ error: 'Failed to start game.' });
  }
});


const PORT = 5050;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
