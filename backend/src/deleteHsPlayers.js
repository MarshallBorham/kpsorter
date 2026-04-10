import "dotenv/config";
import mongoose from "mongoose";
import { Player } from "./models/Player.js";
import { getEnvVar } from "./getEnvVar.js";

await mongoose.connect(getEnvVar("MONGODB_URI"));
const res = await Player.deleteMany({ id: /^hs-2026-/ });
console.log(`Deleted ${res.deletedCount} hs-2026 players`);
await mongoose.disconnect();
