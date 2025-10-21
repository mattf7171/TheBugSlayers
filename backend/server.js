import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { router as stockRoutes } from "./routes/stockRoutes.js";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// mount API routes (start/action/state live here)
app.use("/api", stockRoutes);

// simple health check
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "StockMarketGame backend" });
});

const PORT = 5050;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
