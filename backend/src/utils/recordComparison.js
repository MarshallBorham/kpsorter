import { ComparisonResult } from "../models/ComparisonResult.js";
import { LOWER_IS_BETTER } from "./constants.js";

const COMPARE_STATS = [
  "eFG", "ARate", "Stl", "Blk", "OR", "DR",
  "BPM", "OBPM", "DBPM", "Close2PM", "FTM", "3PM",
];

export async function recordComparison(playerA, playerB, source = "web") {
  // skip self-comparisons (PlayerPage uses compare endpoint for percentiles)
  if (playerA.id === playerB.id) return;

  let scoreA = 0;
  let scoreB = 0;

  for (const key of COMPARE_STATS) {
    const valA = playerA.stats?.[key];
    const valB = playerB.stats?.[key];
    if (valA == null && valB == null) continue;
    if (valA == null) { scoreB++; continue; }
    if (valB == null) { scoreA++; continue; }
    if (valA === valB) continue;
    const lowerWins = LOWER_IS_BETTER.has(key);
    if (lowerWins ? valA < valB : valA > valB) scoreA++;
    else scoreB++;
  }

  let winnerId = null;
  if (scoreA > scoreB) winnerId = playerA.id;
  else if (scoreB > scoreA) winnerId = playerB.id;

  await ComparisonResult.create({
    playerAId: playerA.id,
    playerBId: playerB.id,
    winnerId,
    source,
  });
}