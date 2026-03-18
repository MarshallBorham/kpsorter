import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { getEnvVar } from "./getEnvVar.js";
import { authRouter } from "./routes/authRoutes.js";
import { playerRouter } from "./routes/playerRoutes.js";
import { watchlistRouter } from "./routes/watchlistRoutes.js";

const PORT = Number.parseInt(getEnvVar("PORT", false), 10) || 3000;
const MONGO_URI = getEnvVar("MONGODB_URI");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/players", playerRouter);
app.use("/api/watchlist", watchlistRouter);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}. CTRL+C to stop.`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });