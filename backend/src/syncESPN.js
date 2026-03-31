import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const delay = ms => new Promise(r => setTimeout(r, ms));

// Step 1: Get all D1 teams
console.log("Fetching all teams...");
let allTeams = [];
let page = 1;
while (true) {
  const res = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/teams?limit=500&page=${page}`);
  const data = await res.json();
  const refs = data.items || [];
  if (refs.length === 0) break;
  allTeams = allTeams.concat(refs.map(r => {
    const match = r["$ref"].match(/teams\/(\d+)/);
    return match ? match[1] : null;
  }).filter(Boolean));
  if (allTeams.length >= data.count) break;
  page++;
}
console.log(`Found ${allTeams.length} teams`);

// Step 2: Get roster for each team, build espnId → { name, team } map
console.log("Fetching rosters...");
const espnPlayers = {};

for (let i = 0; i < allTeams.length; i++) {
  const teamId = allTeams[i];
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`);
    const data = await res.json();
    const teamName = data.team?.displayName || data.team?.name || "";

    for (const athlete of data.athletes || []) {
      const espnId = String(athlete.id);
      const name = athlete.fullName || athlete.displayName || "";
      if (espnId && name) {
        espnPlayers[espnId] = { name, team: teamName };
      }
    }

    if ((i + 1) % 50 === 0) console.log(`  Processed ${i + 1}/${allTeams.length} teams (${Object.keys(espnPlayers).length} players so far)...`);
    await delay(50);
  } catch (err) {
    console.error(`Failed to fetch roster for team ${teamId}:`, err.message);
  }
}
console.log(`Total players found across all rosters: ${Object.keys(espnPlayers).length}`);

// Step 3: Fetch PPG/RPG/APG stats from leaders endpoint
console.log("Fetching leaders (PPG, RPG, APG)...");
const leadersRes = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/types/2/leaders?limit=1000`);
const leadersData = await leadersRes.json();

const STAT_MAP = {
  pointsPerGame:   "PPG",
  reboundsPerGame: "RPG",
  assistsPerGame:  "APG",
};

const athleteStatMap = {};

for (const category of leadersData.categories) {
  const statKey = STAT_MAP[category.name];
  if (!statKey) continue;
  console.log(`  ${category.name}: ${category.leaders.length} leaders`);
  for (const leader of category.leaders) {
    const ref = leader.athlete?.["$ref"];
    if (!ref) continue;
    const match = ref.match(/athletes\/(\d+)/);
    if (!match) continue;
    const espnId = match[1];
    if (!athleteStatMap[espnId]) athleteStatMap[espnId] = {};
    athleteStatMap[espnId][statKey] = leader.value;
  }
}

// Step 4: Load DB players for matching
console.log("Loading database players for matching...");
const allDbPlayers = await Player.find({}, "name team _id").lean();
console.log(`Loaded ${allDbPlayers.length} players from database`);

// Fuzzy matching helpers
function editDistance(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeSchool(name) {
  return name.toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\bst\b/g, "state")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolMatches(a, b) {
  if (editDistance(a, b) <= 3) return true;
  if (a.length <= 6 && b.replace(/\s/g, "").includes(a.replace(/\s/g, ""))) return true;
  if (b.length <= 6 && a.replace(/\s/g, "").includes(b.replace(/\s/g, ""))) return true;
  return editDistance(normalizeSchool(a), normalizeSchool(b)) <= 3;
}

function findDbPlayer(espnName, espnTeam) {
  // Exact name + team
  let player = allDbPlayers.find(p => p.name === espnName && p.team === espnTeam);
  if (player) return { player, fuzzy: false };

  // Exact name only
  player = allDbPlayers.find(p => p.name === espnName);
  if (player) return { player, fuzzy: false };

  // Fuzzy — skip entirely if we don't have a team to validate against
  if (!espnTeam || espnTeam.trim() === "") return null;

  const espnFirst = normalizeName(espnName.split(" ")[0] || "");
  const espnLast = normalizeName(espnName.split(" ").slice(1).join(" ") || "");
  const espnSchool = normalizeName(espnTeam || "");

  let bestMatch = null;
  let bestDistance = Infinity;

  for (const dbPlayer of allDbPlayers) {
    const parts = dbPlayer.name.split(" ");
    const dbFirst = normalizeName(parts[0] || "");
    const dbLast = normalizeName(parts.slice(1).join(" ") || "");
    const dbSchool = normalizeName(dbPlayer.team || "");

    // Require first two letters of first name to match
    if (!espnFirst || !dbFirst || espnFirst.slice(0, 2) !== dbFirst.slice(0, 2)) continue;

    // School must match closely
    if (!schoolMatches(espnSchool, dbSchool)) continue;

    // Fuzzy last name — max 1 edit
    const lastDist = editDistance(espnLast, dbLast);
    if (lastDist < bestDistance && lastDist <= 1) {
      bestDistance = lastDist;
      bestMatch = dbPlayer;
    }
  }

  if (bestMatch) return { player: bestMatch, fuzzy: true };
  return null;
}

console.log("Matching and updating players...");

let matched = 0;
let fuzzyMatched = 0;
let unmatched = 0;
let noStats = 0;
const processedDbIds = new Set();

const rosterIds = Object.keys(espnPlayers);
console.log(`Processing ${rosterIds.length} roster players...`);

for (let i = 0; i < rosterIds.length; i++) {
  const espnId = rosterIds[i];
  const espn = espnPlayers[espnId];

  const result = findDbPlayer(espn.name, espn.team);
  if (!result) {
    unmatched++;
    continue;
  }

  const { player, fuzzy } = result;

  if (processedDbIds.has(String(player._id))) continue;
  processedDbIds.add(String(player._id));

  // Get stats from leaders map or fetch individually
  let stats = athleteStatMap[espnId];

  if (!stats) {
    try {
      const res = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026/types/2/athletes/${espnId}/statistics/0`);
      const data = await res.json();

      const splits = data.splits?.categories || [];
      const statEntry = {};

      for (const cat of splits) {
        for (const stat of cat.stats || []) {
          if (stat.abbreviation === "PPG" || stat.name === "pointsPerGame") statEntry.PPG = stat.value;
          if (stat.abbreviation === "RPG" || stat.name === "reboundsPerGame") statEntry.RPG = stat.value;
          if (stat.abbreviation === "APG" || stat.name === "assistsPerGame") statEntry.APG = stat.value;
        }
      }

      if (Object.keys(statEntry).length > 0) {
        stats = statEntry;
      }
      await delay(30);
    } catch {
      // silently skip
    }
  }

  if (!stats || Object.keys(stats).length === 0) {
    noStats++;
    continue;
  }

  const update = {};
  for (const [key, value] of Object.entries(stats)) {
    update[`stats.${key}`] = value;
  }

  await Player.updateOne({ _id: player._id }, { $set: update });

  if (fuzzy) {
    fuzzyMatched++;
    if (fuzzyMatched <= 30) console.log(`Fuzzy: "${espn.name}" (${espn.team}) → "${player.name}" (${player.team})`);
  }
  matched++;

  if ((matched + unmatched) % 200 === 0) {
    console.log(`  Progress: ${matched} matched, ${unmatched} unmatched, ${noStats} no stats...`);
  }
}

console.log(`\nResults:`);
console.log(`  Exact matched: ${matched - fuzzyMatched}`);
console.log(`  Fuzzy matched: ${fuzzyMatched}`);
console.log(`  Unmatched (not in our DB): ${unmatched}`);
console.log(`  Matched but no stats found: ${noStats}`);
console.log(`  Total updated: ${matched}`);

await mongoose.disconnect();
console.log("\nDone");