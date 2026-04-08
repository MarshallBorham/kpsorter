import mongoose from "mongoose";

/** Aggregated /discord-chart usage per resolved canonical team name. */
const schema = new mongoose.Schema(
  {
    teamCanonical: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    lastRequestedAt: { type: Date },
  },
  { timestamps: true }
);

export const DiscordDepthChartTeamStat = mongoose.model("DiscordDepthChartTeamStat", schema);
