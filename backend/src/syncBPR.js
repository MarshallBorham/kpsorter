import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

// ── CLI arg ──────────────────────────────────────────────────────────────────
const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node src/syncBPR.js <path-to-txt-file>");
  process.exit(1);
}

// ── Connect ───────────────────────────────────────────────────────────────────
const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// ── Parse the file ────────────────────────────────────────────────────────────
// Each player occupies exactly 14 lines:
//  0  rank line  (e.g. "1." or "1")
//  1  player name
//  2  college
//  3  OBPR
//  4  DBPR
//  5  BPR
//  6  possessions
//  7  Box OBPR
//  8  Box DBPR
//  9  Box BPR
// 10  Adj Team Off Eff
// 11  Adj Team Def Eff
// 12  Adj Team Eff Margin
// 13  +/-

const BLOCK_SIZE = 14;

const raw = readFileSync(resolve(filePath), "utf8");
const lines = raw.split(/\r?\n/);

console.log(`File loaded — ${lines.length} lines`);

const fileEntries = []; // { name, college, obpr, dbpr, bpr }

for (let i = 0; i + BLOCK_SIZE <= lines.length; i += BLOCK_SIZE) {
  const block = lines.slice(i, i + BLOCK_SIZE).map(l => l.trim());

  const name   = block[1];
  const college = block[2];
  const obpr   = parseFloat(block[3]);
  const dbpr   = parseFloat(block[4]);
  const bpr    = parseFloat(block[5]);

  if (!name || isNaN(obpr) || isNaN(dbpr) || isNaN(bpr)) {
    console.warn(`  Skipping malformed block at line ${i + 1}: "${block[0]}"`);
    continue;
  }

  fileEntries.push({ name, college, obpr, dbpr, bpr });
}

console.log(`Parsed ${fileEntries.length} player entries from file`);

// ── Load DB players ───────────────────────────────────────────────────────────
const dbPlayers = await Player.find({}, "name team stats").lean();
console.log(`Loaded ${dbPlayers.length} players from database`);

// ── Fuzzy matching helpers ────────────────────────────────────────────────────
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

// Normalise a school name for comparison
const ABBREV = {
  "st": "state", "st.": "state",
  "unc": "north carolina", "usc": "southern california",
  "uconn": "connecticut", "unlv": "nevada las vegas",
  "lsu": "louisiana state", "smu": "southern methodist",
  "tcu": "texas christian", "vcu": "virginia commonwealth",
  "ole miss": "mississippi", "pitt": "pittsburgh",
  "fsu": "florida state", "k-state": "kansas state",
  "nc state": "north carolina state", "ncstate": "north carolina state",
};

function normTeam(t) {
  if (!t) return "";
  let s = t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  for (const [abbr, full] of Object.entries(ABBREV)) {
    if (s === abbr) s = full;
    s = s.replace(new RegExp(`\\b${abbr}\\b`, "g"), full);
  }
  return s;
}

function teamSimilarity(a, b) {
  const na = normTeam(a);
  const nb = normTeam(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const ed = editDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - ed / maxLen;
}

// Match one file entry to the best DB player
function findBestMatch(entry) {
  const nameLower = entry.name.toLowerCase();
  const [firstName = "", ...rest] = nameLower.split(" ");
  const lastName = rest.join(" ");
  const prefix = firstName.slice(0, 2); // first two letters of first name

  let best = null;
  let bestScore = -Infinity;

  for (const dbp of dbPlayers) {
    const dbName = dbp.name.toLowerCase();
    const [dbFirst = "", ...dbRest] = dbName.split(" ");
    const dbLast = dbRest.join(" ");

    // Must share first two letters of first name
    if (!dbFirst.startsWith(prefix)) continue;

    const lastEd = editDistance(lastName, dbLast);
    if (lastEd > 2) continue; // max edit distance on last name

    const teamSim = teamSimilarity(entry.college, dbp.team);
    // Require at least partial team match
    if (teamSim < 0.4) continue;

    // Score: reward exact last name, exact first name, and team similarity
    const score = (lastEd === 0 ? 10 : 5 - lastEd) + teamSim * 5;

    if (score > bestScore) {
      bestScore = score;
      best = dbp;
    }
  }

  return best;
}

// ── Match & update ────────────────────────────────────────────────────────────
let matched = 0, unmatched = 0, updated = 0;
const unmatchedList = [];
const bulk = [];

for (const entry of fileEntries) {
  const dbp = findBestMatch(entry);

  if (!dbp) {
    unmatched++;
    unmatchedList.push(`${entry.name} (${entry.college})`);
    continue;
  }

  matched++;

  bulk.push({
    updateOne: {
      filter: { _id: dbp._id },
      update: {
        $set: {
          "stats.OBPR": entry.obpr,
          "stats.DBPR": entry.dbpr,
          "stats.BPR":  entry.bpr,
        },
      },
    },
  });
}

if (bulk.length > 0) {
  const result = await mongoose.connection.collection("players").bulkWrite(bulk);
  updated = result.modifiedCount;
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n── Results ──────────────────────────────────────────");
console.log(`  File entries parsed : ${fileEntries.length}`);
console.log(`  Matched             : ${matched}`);
console.log(`  Unmatched           : ${unmatched}`);
console.log(`  DB records updated  : ${updated}`);

if (unmatchedList.length > 0) {
  console.log("\n── Unmatched players ────────────────────────────────");
  unmatchedList.slice(0, 50).forEach(p => console.log("  " + p));
  if (unmatchedList.length > 50)
    console.log(`  ... and ${unmatchedList.length - 50} more`);
}

await mongoose.disconnect();
console.log("\nDone.");