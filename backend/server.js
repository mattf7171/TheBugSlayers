import express from "express";
import cors from "cors";
import { router as stockRoutes } from "./routes/stockRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", stockRoutes);

const PORT = 5050;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
