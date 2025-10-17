import express from "express";
export const router = express.Router();

// naive in-memory game state just to prove async works
let gameState = { bank: 10000, shares: 0, price: 123.45, day: 1, ticker: "" };

router.post("/start", (req, res) => {
  const { ticker } = req.body || {};
  if (!ticker) return res.status(400).json({ error: "Ticker is required" });
  gameState = { ...gameState, ticker, day: 1 };
  res.json(gameState);
});
