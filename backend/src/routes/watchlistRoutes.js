import express from "express";
import { User } from "../models/User.js";
import { players } from "../data/players.js";
import { requireAuth } from "../middleware/auth.js";

export const watchlistRouter = express.Router();

// GET /api/watchlist
watchlistRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const enriched = user.watchlist.map((entry) => {
      const player = players.find((p) => p.id === entry.playerId);
      if (!player) return null;
      return {
        playerId: entry.playerId,
        stat1: entry.stat1,
        stat2: entry.stat2,
        addedAt: entry.addedAt,
        name: player.name,
        team: player.team,
        year: player.year,
        position: player.position,
        stat1Value: player.stats[entry.stat1] ?? 0,
        stat2Value: player.stats[entry.stat2] ?? 0,
        combined: (player.stats[entry.stat1] ?? 0) + (player.stats[entry.stat2] ?? 0),
      };
    }).filter(Boolean);

    res.json(enriched);
  } catch (err) {
    console.error("Watchlist GET error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/watchlist
watchlistRouter.post("/", requireAuth, async (req, res) => {
  const { playerId, stat1, stat2 } = req.body;

  if (!playerId || !stat1 || !stat2) {
    return res.status(400).json({ error: "playerId, stat1, and stat2 are required" });
  }

  const playerExists = players.find((p) => p.id === playerId);
  if (!playerExists) {
    return res.status(404).json({ error: "Player not found" });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const alreadySaved = user.watchlist.some(
      (e) => e.playerId === playerId && e.stat1 === stat1 && e.stat2 === stat2
    );
    if (alreadySaved) {
      return res.status(409).json({ error: "Player already in watchlist with these stats" });
    }

    user.watchlist.push({ playerId, stat1, stat2 });
    await user.save();

    res.status(201).json({ message: "Added to watchlist" });
  } catch (err) {
    console.error("Watchlist POST error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/watchlist/:playerId?stat1=X&stat2=Y
watchlistRouter.delete("/:playerId", requireAuth, async (req, res) => {
  const { playerId } = req.params;
  const { stat1, stat2 } = req.query;

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const before = user.watchlist.length;
    user.watchlist = user.watchlist.filter(
      (e) => !(e.playerId === playerId && e.stat1 === stat1 && e.stat2 === stat2)
    );

    if (user.watchlist.length === before) {
      return res.status(404).json({ error: "Entry not found in watchlist" });
    }

    await user.save();
    res.json({ message: "Removed from watchlist" });
  } catch (err) {
    console.error("Watchlist DELETE error:", err);
    res.status(500).json({ error: "Server error" });
  }
});