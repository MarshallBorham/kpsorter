import { statGet } from "./depthChart.js";
import { LOWER_IS_BETTER } from "./constants.js";

const TEAM_PROFILE_CATEGORIES = [
  {
    key: "close2",
    label: "Close 2",
    type: "shooting",
    statPct: "Close2P",
    statMakes: "Close2PM",
  },
  {
    key: "three",
    label: "3PT",
    type: "shooting",
    statPct: "3P",
    statMakes: "3PM",
  },
  {
    key: "far2",
    label: "Far 2",
    type: "shooting",
    statPct: "Far2P",
    statMakes: "Far2PM",
  },
  {
    key: "stocks",
    label: "Stl / Blk",
    type: "blend_product",
    stats: ["Stl", "Blk"],
  },
  {
    key: "orb",
    label: "Offensive rebounding",
    type: "rebound",
    stat: "OR",
  },
  {
    key: "drb",
    label: "Defensive rebounding",
    type: "rebound",
    stat: "DR",
  },
  {
    key: "play",
    label: "Playmaking",
    type: "blend_product",
    stats: ["APG", "ARate"],
  },
  {
    key: "tov",
    label: "Ball security",
    type: "product",
    stat: "TO",
  },
];

function playerMinWeight(p) {
  const raw = statGet(p, "Min");
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function numStat(p, key) {
  const v = statGet(p, key);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Volume-efficiency product: sum(stat_i * Min_i).
 * Removing any contributor always lowers the score.
 * Returns null if no qualifying players.
 */
function teamProduct(players, stat) {
  let total = 0;
  let hasAny = false;
  for (const p of players) {
    const w = playerMinWeight(p);
    if (w <= 0) continue;
    const n = numStat(p, stat);
    if (n == null) continue;
    total += n * w;
    hasAny = true;
  }
  return hasAny ? total : null;
}

/**
 * Shooting aggregates for a group of players.
 * Volume  = sum(makes_i)  — total makes on the roster.
 * Efficiency = sum(pct_i * makes_i) / sum(makes_i) — makes-weighted team shooting %.
 * Returns null if no player has both a valid makes and pct value.
 */
function teamShootingAgg(players, statPct, statMakes) {
  let totalMakes = 0;
  let weightedPctSum = 0;
  let hasAny = false;
  for (const p of players) {
    const makes = numStat(p, statMakes);
    if (makes == null || makes <= 0) continue;
    const pct = numStat(p, statPct);
    if (pct == null) continue;
    totalMakes += makes;
    weightedPctSum += pct * makes;
    hasAny = true;
  }
  if (!hasAny || totalMakes <= 0) return null;
  return { volume: totalMakes, efficiency: weightedPctSum / totalMakes };
}

/** Build a linear 1–99 rater from an array of team values. */
function makeLinearRater(values) {
  if (values.length === 0) return () => null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (val) => {
    if (val == null) return null;
    if (max === min) return 50;
    const ratio = (val - min) / (max - min);
    return Math.max(1, Math.min(99, Math.round(1 + ratio * 98)));
  };
}

/**
 * Build team-level rating functions from the national pool.
 *
 * Shooting categories (3PT, Close2, Far2):
 *   - Volume rater: total makes across roster, 1–99 vs all teams.
 *   - Efficiency rater: makes-weighted team shooting %, 1–99 vs all teams.
 *   Final rating = average of the two.
 *
 * Rebounding / product categories:
 *   - sum(stat * Min) per team, 1–99 vs all teams.
 */
export function buildDepthTeamProfileGetters(pool) {
  const teamMap = new Map();
  for (const p of pool) {
    const team = p.team;
    if (!team) continue;
    if (!teamMap.has(team)) teamMap.set(team, []);
    teamMap.get(team).push(p);
  }

  const getters = {};

  // ── Shooting getters ──────────────────────────────────────────────────────
  const SHOOTING = [
    { statPct: "Close2P", statMakes: "Close2PM" },
    { statPct: "3P",      statMakes: "3PM" },
    { statPct: "Far2P",   statMakes: "Far2PM" },
  ];
  for (const { statPct, statMakes } of SHOOTING) {
    const volumeVals = [];
    const efficiencyVals = [];
    for (const players of teamMap.values()) {
      const agg = teamShootingAgg(players, statPct, statMakes);
      if (agg == null) continue;
      volumeVals.push(agg.volume);
      efficiencyVals.push(agg.efficiency);
    }
    const volumeRater = makeLinearRater(volumeVals);
    const efficiencyRater = makeLinearRater(efficiencyVals);
    getters[`${statPct}_volume`] = volumeRater;
    getters[`${statPct}_efficiency`] = efficiencyRater;
  }

  // ── Product getters (rebound, stocks, playmaking, TO) ─────────────────────
  const PRODUCT_STATS = ["OR", "DR", "Stl", "Blk", "APG", "ARate", "TO"];
  for (const stat of PRODUCT_STATS) {
    const teamVals = [];
    for (const players of teamMap.values()) {
      const vol = teamProduct(players, stat);
      if (vol != null) teamVals.push(vol);
    }
    const rater = makeLinearRater(teamVals);
    getters[`${stat}_product`] = (val) => {
      const r = rater(val);
      return LOWER_IS_BETTER.has(stat) && r != null ? 100 - r : r;
    };
  }

  return getters;
}

/**
 * @param {object[]} rosterPlayers - Players to profile (full team or seniors-excluded roster).
 * @param {Record<string, function>} getters - from buildDepthTeamProfileGetters
 */
export function computeTeamDepthProfile(rosterPlayers, getters) {
  const bars = TEAM_PROFILE_CATEGORIES.map((cat) => {
    let value = null;

    if (cat.type === "shooting") {
      const agg = teamShootingAgg(rosterPlayers, cat.statPct, cat.statMakes);
      if (agg != null) {
        const volRating = getters[`${cat.statPct}_volume`](agg.volume);
        const effRating = getters[`${cat.statPct}_efficiency`](agg.efficiency);
        if (volRating != null && effRating != null) {
          value = Math.round((volRating + effRating) / 2);
        } else {
          value = volRating ?? effRating;
        }
      }
    } else if (cat.type === "rebound" || cat.type === "product") {
      const vol = teamProduct(rosterPlayers, cat.stat);
      if (vol != null) value = getters[`${cat.stat}_product`](vol);
    } else if (cat.type === "blend_product") {
      const ratings = [];
      for (const stat of cat.stats) {
        const vol = teamProduct(rosterPlayers, stat);
        if (vol == null) continue;
        const r = getters[`${stat}_product`](vol);
        if (r != null) ratings.push(r);
      }
      if (ratings.length > 0) {
        value = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
      }
    }

    return { key: cat.key, label: cat.label, value };
  });
  return { bars };
}
