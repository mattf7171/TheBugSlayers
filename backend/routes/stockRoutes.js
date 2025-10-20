import express from "express";
import axios from "axios";
import dayjs from "dayjs";
import dotenv from "dotenv";

dotenv.config();
export const router = express.Router();

router.post("/start", async (req, res) => {
  const { ticker } = req.body || {};
  const apiKey = process.env.POLYGON_API_KEY;

  if (!ticker) return res.status(400).json({ error: "Ticker is required" });

  try {
    // Pick a random date between 1 year ago and 6 months ago
    const endDate = dayjs().subtract(6, "month");
    const startDate = dayjs().subtract(1, "year");
    const diffDays = endDate.diff(startDate, "day");
    const randomOffset = Math.floor(Math.random() * diffDays);
    const randomDate = startDate.add(randomOffset, "day").format("YYYY-MM-DD");

    // Try to fetch price for that date
    const url = `https://api.polygon.io/v1/open-close/${ticker}/${randomDate}`;
    const params = { adjusted: true, apiKey };

    let response;
    try {
      response = await axios.get(url, { params });
    } catch (err) {
      response = null;
    }

    let price = response?.data?.close;
    let finalDate = randomDate;

    // If no price, fallback to next closest trading day
    if (!price) {
      const fallbackRes = await axios.get(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${randomDate}/2025-12-31`,
        {
          params: {
            apiKey,
            sort: "asc",
            limit: 5000,
          },
        }
      );

      const fallback = fallbackRes.data.results?.find((r) => r.t);
      if (!fallback) {
        return res.status(404).json({ error: "No fallback trading day found." });
      }

      finalDate = new Date(fallback.t).toISOString().split("T")[0];
      price = fallback.c;
    }

    const gameState = {
      ticker,
      price,
      hiddenDate: finalDate,
      bank: 10000,
      shares: 0,
      investment: 0,
      day: 1,
      history: [],
    };

    res.json(gameState);
  } catch (error) {
    console.error("Error starting game:", error.message);
    res.status(500).json({ error: "Failed to start game." });
  }
});
