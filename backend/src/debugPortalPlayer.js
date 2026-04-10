/**
 * Usage: node src/debugPortalPlayer.js "Tucker Anderson"
 * Fetches the VC portal data and prints the raw API row + DB match result for a player.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";

const searchName = process.argv[2]?.trim().toLowerCase();
if (!searchName) { console.error("Pass a player name as argument"); process.exit(1); }

const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://verbalcommits.com/transfers",
    Origin: "https://verbalcommits.com",
    pb: "tcdIJEr3eL4ZAzyH",
    dnt: "1",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  },
  body: JSON.stringify({
    name: "",
    queryTarget: "TRANSFER",
    transferYear: 2026,
    transferLevel: "D1",
    filters: [
      { type: "HS_GRAD_YEAR", minValue: -1, maxValue: 5000 },
      { type: "HEIGHT", minValue: -1, maxValue: 5000 },
      { type: "WEIGHT", minValue: -1, maxValue: 5000 },
      { type: "RATING", minValue: -1, maxValue: 5000 },
      { type: "GPA", minValue: -1, maxValue: 5000 },
      { type: "PPG", minValue: -1, maxValue: 5000 },
      { type: "APG", minValue: -1, maxValue: 5000 },
      { type: "RPG", minValue: -1, maxValue: 5000 },
      { type: "BPG", minValue: -1, maxValue: 5000 },
      { type: "SPG", minValue: -1, maxValue: 5000 },
      { type: "CRAM", minValue: -1, maxValue: 5000 },
      { type: "RAM", minValue: -1, maxValue: 5000 },
      { type: "FG_PCT", minValue: -1, maxValue: 5000 },
      { type: "FT_PCT", minValue: -1, maxValue: 5000 },
      { type: "THREE_PCT", minValue: -1, maxValue: 5000 },
      { type: "IS_JUCO", comparand: [] },
      { type: "IS_REDSHIRT", comparand: [] },
      { type: "POSITION", comparand: [] },
      { type: "STATUS", comparand: [] },
      { type: "TRANSFER_FROM_TO", comparand: [] },
      { type: "TRANSFER_FROM_TO_CONFERENCE", comparand: [] },
      { type: "STATE", comparand: [] },
      { type: "IS_PLAYER_PLUS", comparand: [] },
      { type: "ELIGIBILITY_YEAR", comparand: [] },
    ],
  }),
});

const allPlayers = await res.json();
const matches = allPlayers.filter(
  (p) => `${p.playerFirstName} ${p.playerLastName}`.toLowerCase().includes(searchName)
);

if (matches.length === 0) {
  console.log(`No VC portal rows found matching "${searchName}"`);
} else {
  for (const p of matches) {
    console.log("\n── VC API row ──────────────────────────────────────");
    console.log(`Name:               ${p.playerFirstName} ${p.playerLastName}`);
    console.log(`fromSchoolName:     ${p.fromSchoolName}`);
    console.log(`toSchoolName:       ${p.toSchoolName}`);
    console.log(`transferStatusName: ${p.transferStatusName}`);
    console.log(`transferStatus:     ${p.transferStatus}`);
    console.log(`transferDecisionType: ${p.transferDecisionType}`);
    console.log("All fields:", JSON.stringify(p, null, 2));
  }
}

await mongoose.connect(getEnvVar("MONGODB_URI"));
const dbMatches = await Player.find({
  name: { $regex: searchName.replace(/\s+/g, ".*"), $options: "i" },
}).lean();
console.log("\n── DB records ──────────────────────────────────────");
if (dbMatches.length === 0) {
  console.log("No DB records found");
} else {
  for (const p of dbMatches) {
    console.log(`${p.name} | team: ${p.team} | inPortal: ${p.inPortal} | year: ${p.year}`);
  }
}
await mongoose.disconnect();
