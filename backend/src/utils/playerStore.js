/**
 * In-memory player store.
 * Loaded once on startup; all search/filter operations run against this
 * instead of querying MongoDB on every request.
 *
 * Each player object gets a `precomputedPcts` field with percentile ranks
 * for every stat, computed against the full Min ≥ 15 pool.
 */

import { Player } from "../models/Player.js";
import { LOWER_IS_BETTER } from "./constants.js";

const ALL_STATS = [
  "PPG", "RPG", "APG", "eFG", "TS", "OR", "DR", "ARate", "TO", "Blk", "Stl", "FTRate", "FT",
  "2P", "3P", "Min", "G", "ORTG", "DRTG", "Usg",
  "FTA", "FTM", "2PM", "2PA", "3PM", "3PA",
  "FC40", "Close2PM", "Close2PA", "Close2P",
  "Far2PM", "Far2PA", "Far2P", "DunksAtt", "DunksMade", "DunkPct",
  "BPM", "OBPM", "DBPM", "3P100",
  "OBPR", "DBPR", "BPR",
];

function buildPercentileFn(sortedVals, lowerIsBetter) {
  const total = sortedVals.length;
  return function (val) {
    let low = 0, high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (sortedVals[mid] < val) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return lowerIsBetter ? 100 - pct : pct;
  };
}

let _players = [];
let _loaded  = false;

export async function loadPlayerStore() {
  const raw = await Player.find({}).lean();

  // Reference pool for percentiles: all players with Min ≥ 15
  const refPool = raw.filter((p) => (p.stats?.Min ?? 0) >= 15);

  // Build one sorted array + percentile function per stat
  const pctFns = {};
  for (const stat of ALL_STATS) {
    const sorted = refPool.map((p) => p.stats?.[stat] ?? 0).sort((a, b) => a - b);
    pctFns[stat] = buildPercentileFn(sorted, LOWER_IS_BETTER.has(stat));
  }

  // Attach precomputedPcts to every player
  _players = raw.map((p) => {
    const precomputedPcts = {};
    for (const stat of ALL_STATS) {
      const val = p.stats?.[stat];
      if (val != null) precomputedPcts[stat] = pctFns[stat](val);
    }
    return { ...p, precomputedPcts };
  });

  _loaded = true;
  console.log(`[PlayerStore] Loaded ${_players.length} players, percentiles pre-computed against ${refPool.length}-player pool`);
}

/** Reload after a sync script updates the DB. */
export async function reloadPlayerStore() {
  await loadPlayerStore();
}

export function getPlayerStore() { return _players; }
export function isStoreLoaded()  { return _loaded; }
