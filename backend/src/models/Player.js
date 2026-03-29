import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  team: String,
  year: String,
  position: String,
  height: String,
  heightInches: Number,
  stats: { type: Map, of: Number },
});

export const Player = mongoose.model("Player", playerSchema);