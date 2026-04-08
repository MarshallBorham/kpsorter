/**
 * Print Discord /depth-chart team request totals (MongoDB).
 * Usage: node src/reportDiscordDepthChartStats.js
 */
import mongoose from "mongoose";
import { DiscordDepthChartTeamStat } from "./models/DiscordDepthChartTeamStat.js";
import { getEnvVar } from "./getEnvVar.js";
import { Event } from "./models/Event.js";
import "dotenv/config";

const uri = getEnvVar("MONGODB_URI", false);
if (!uri) {
  console.error("MONGODB_URI not set.");
  process.exit(1);
}

await mongoose.connect(uri);

const byTeam = await DiscordDepthChartTeamStat.find().sort({ count: -1 }).lean();
console.log("\nPer-team totals (DiscordDepthChartTeamStat):\n");
for (const row of byTeam) {
  console.log(`${row.count}\t${row.teamCanonical}\t(last: ${row.lastRequestedAt ?? "—"})`);
}
console.log(`\n${byTeam.length} teams · ${byTeam.reduce((s, r) => s + r.count, 0)} successful lookups\n`);

const recent = await Event.find({ type: "discord_depth_chart" })
  .sort({ createdAt: -1 })
  .limit(15)
  .lean();
console.log("Last 15 raw events (type discord_depth_chart):\n");
for (const e of recent) {
  const d = e.data || {};
  console.log(
    `${e.createdAt?.toISOString?.() ?? e.createdAt}\tok=${d.ok}\tcanon=${d.teamCanonical ?? "—"}\tinput=${d.teamInput}`
  );
}

await mongoose.disconnect();
