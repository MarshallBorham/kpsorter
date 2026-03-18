import express from "express";
import { players } from "../data/players.js";
import { requireAuth } from "../middleware/auth.js";

export const playerRouter = express.Router();

// GET /api/players?stat1=eFG&stat2=ARate
playerRouter.get("/", requireAuth, (req, res) => {
  const { stat1, stat2 } = req.query;

  const validStats = ["eFG", "ARate", "Stl", "Blk", "FTRate", "OR", "DR", "TO", "Min", "Shots", "TS", "2P", "3P", "FT"];

  if (!stat1 || !stat2) {
    return res.status(400).json({ error: "stat1 and stat2 query params are required" });
  }
  if (!validStats.includes(stat1) || !validStats.includes(stat2)) {
    return res.status(400).json({ error: "Invalid stat name" });
  }
  if (stat1 === stat2) {
    return res.status(400).json({ error: "stat1 and stat2 must be different" });
  }

  const ranked = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      year: p.year,
      position: p.position,
      stat1Value: p.stats[stat1] ?? 0,
      stat2Value: p.stats[stat2] ?? 0,
      combined: (p.stats[stat1] ?? 0) + (p.stats[stat2] ?? 0),
    }))
    .sort((a, b) => b.combined - a.combined);

  res.json({ stat1, stat2, results: ranked });
});