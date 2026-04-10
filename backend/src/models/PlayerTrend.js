import mongoose from "mongoose";

const playerTrendSchema = new mongoose.Schema({
  playerId: { type: String, required: true, unique: true },
  trendingTotal: { type: Number, default: 0 },
});

export const PlayerTrend = mongoose.model("PlayerTrend", playerTrendSchema);
