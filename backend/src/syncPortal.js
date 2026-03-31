import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";
import "dotenv/config";

const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// Fetch all portal players — paginate through all pages
let allPlayers = [];
let page = 0;
const pageSize = 200;

while (true) {
  const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "",
      queryTarget: "TRANSFER",
      transferYear: 2026,
      transferLevel: "D1",
      filters: [
        { type: "HS_GRAD_YEAR", minValue: -1, maxValue: 5000 },
        { type: "HEIGHT", minValue: -1, maxValue: 5000 },
      ],
      page,
      pageSize,
    }),
  });

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) break;
  allPlayers = allPlayers.concat(data);
  console.log(`Fetched ${allPlayers.length} portal players so far...`);
  if (data.length < pageSize) break;
  page++;
}

console.log(`Total portal players fetched: ${allPlayers.length}`);

// Reset all inPortal flags first
await Player.updateMany({}, { inPortal: false });
console.log("Reset all inPortal flags");

// Match and mark
let matched = 0;
let unmatched = 0;

for (const p of allPlayers) {
  const fullName = `${p.playerFirstName} ${p.playerLastName}`.trim();
  const school = p.fromSchoolName;

  // Try exact name + school match first
  let player = await Player.findOne({
    name: fullName,
    team: school,
  });

  // Fall back to name only
  if (!player) {
    player = await Player.findOne({ name: fullName });
  }

  if (player) {
    await Player.updateOne({ _id: player._id }, { inPortal: true });
    matched++;
  } else {
    unmatched++;
  }
}

console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
await mongoose.disconnect();
console.log("Done");