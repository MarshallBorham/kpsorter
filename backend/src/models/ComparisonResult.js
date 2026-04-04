import mongoose from "mongoose";

const comparisonResultSchema = new mongoose.Schema({
  playerAId: { type: String, required: true },
  playerBId: { type: String, required: true },
  winnerId:  { type: String, default: null }, // null = tie
  source:    { type: String, enum: ["web", "discord"], default: "web" },
  createdAt: { type: Date, default: Date.now },
});

export const ComparisonResult = mongoose.model("ComparisonResult", comparisonResultSchema);