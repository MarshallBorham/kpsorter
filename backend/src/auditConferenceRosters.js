/**
 * Reports Player counts per conference map entry; suggests DB team strings for zero rosters.
 * Usage: node src/auditConferenceRosters.js
 */
import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { PORTAL_CONFERENCE_MAP, resolveCanonicalTeamName } from "./data/portalConferenceMap.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function bestFuzzyCandidates(canonical, teamToCount, topN = 5) {
  const nc = norm(canonical);
  if (!nc) return [];
  const scored = [];
  for (const [t, c] of teamToCount) {
    if (c === 0) continue;
    const nt = norm(t);
    if (!nt) continue;
    if (nt.includes(nc) || nc.includes(nt)) {
      scored.push({ t, n: c, score: Math.min(nt.length, nc.length) / Math.max(nt.length, nc.length) });
    }
  }
  scored.sort((a, b) => b.n - a.n || b.score - a.score);
  return scored.slice(0, topN);
}

function countPlayersForCanonical(canonical, teamToCount) {
  const cset = new Set([canonical]);
  let n = 0;
  for (const [dbTeam, cnt] of teamToCount) {
    if (resolveCanonicalTeamName(dbTeam, cset) === canonical) n += cnt;
  }
  return n;
}

const uri = getEnvVar("MONGODB_URI", false);
if (!uri) {
  console.error("MONGODB_URI not set — cannot audit.rosters.");
  process.exit(1);
}

await mongoose.connect(uri);
const agg = await Player.aggregate([
  { $match: { team: { $exists: true, $nin: [null, ""] } } },
  { $group: { _id: "$team", n: { $sum: 1 } } },
]);
const teamToCount = new Map(agg.map((x) => [x._id, x.n]));
console.log(`Distinct teams in DB: ${teamToCount.size}, total player docs summed: ${[...teamToCount.values()].reduce((a, b) => a + b, 0)}`);

const zeros = [];
for (const [conf, teams] of Object.entries(PORTAL_CONFERENCE_MAP)) {
  for (const canonical of teams) {
    const n = countPlayersForCanonical(canonical, teamToCount);
    if (n === 0) {
      const hints = bestFuzzyCandidates(canonical, teamToCount);
      zeros.push({ conf, canonical, hints: hints.map((h) => `${h.t} (${h.n})`).filter(Boolean) });
    }
  }
}

console.log(`\nTeams with 0 players (${zeros.length}):\n`);
for (const z of zeros) {
  console.log(`${z.conf} | ${z.canonical}`);
  if (z.hints.length) console.log(`  candidates: ${z.hints.join(", ")}`);
}

await mongoose.disconnect();
