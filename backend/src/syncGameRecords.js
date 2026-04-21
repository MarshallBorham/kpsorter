/**
 * Fetches each D1 team's schedule results (regular season + postseason) and
 * stores per-team game W-L in TeamStat. Much faster than syncFederer since
 * it only hits the schedule API, not PBP.
 *
 * Run from backend/:
 *   node src/syncGameRecords.js
 */

import mongoose from "mongoose";
import { TeamStat } from "./models/TeamStat.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const SEASON     = 2026;
const DELAY_MS   = 40;
const BATCH_SIZE = 50;

const delay = ms => new Promise(r => setTimeout(r, ms));

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// ── Step 1: Fetch all D1 team IDs (same as syncFederer) ──────────────────────
console.log("Fetching D1 team list...");
let allTeamIds = [];
let page = 1;
while (true) {
  const res  = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/${SEASON}/teams?limit=500&page=${page}`);
  const data = await res.json();
  const refs = data.items || [];
  if (refs.length === 0) break;
  allTeamIds = allTeamIds.concat(
    refs.map(r => { const m = r["$ref"].match(/teams\/(\d+)/); return m ? m[1] : null; }).filter(Boolean)
  );
  if (allTeamIds.length >= data.count) break;
  page++;
}
console.log(`${allTeamIds.length} teams found`);

// ── Step 2: Accumulate W-L per team from schedules ───────────────────────────
// espnTeamId → { wins, losses, name }
const records = new Map();

function getOrCreate(teamId, teamName) {
  if (!records.has(teamId)) records.set(teamId, { wins: 0, losses: 0, name: teamName });
  return records.get(teamId);
}

async function processSchedule(teamId, seasontype) {
  try {
    const res  = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule?seasontype=${seasontype}`
    );
    const data = await res.json();

    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp?.status?.type?.completed) continue;

      // Only credit the team whose schedule we're fetching
      const c = (comp.competitors || []).find(c => String(c.id) === String(teamId));
      if (!c) continue;
      const name = c.team?.displayName ?? c.team?.name ?? teamId;
      const acc  = getOrCreate(String(teamId), name);
      if (c.winner === true)       acc.wins++;
      else if (c.winner === false) acc.losses++;
    }
  } catch {
    // silently skip failed requests
  }
}

for (let i = 0; i < allTeamIds.length; i++) {
  const teamId = allTeamIds[i];
  await processSchedule(teamId, 2);
  await delay(DELAY_MS);
  await processSchedule(teamId, 3);
  await delay(DELAY_MS);
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${allTeamIds.length} teams processed`);
}

console.log(`\nBuilt records for ${records.size} teams`);

// ── Step 3: Write to DB ───────────────────────────────────────────────────────
console.log("Writing to database...");
const bulkOps = [];

for (const [espnTeamId, rec] of records.entries()) {
  bulkOps.push({
    updateOne: {
      filter: { espnTeamId, season: SEASON },
      update: { $set: { gameWins: rec.wins, gameLosses: rec.losses } },
    },
  });
}

for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
  await TeamStat.bulkWrite(bulkOps.slice(i, i + BATCH_SIZE));
}

console.log(`Updated ${bulkOps.length} records`);
await mongoose.disconnect();
console.log("Done");
