import { statGet } from "./depthChart.js";

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

const POOL_STATS = [
  "Close2P",
  "3P",
  "Far2P",
  "Stl",
  "Blk",
  "OR",
  "DR",
  "APG",
  "ARate",
  "TO",
];

const TEAM_PROFILE_CATEGORIES = [
  { key: "close2", label: "Close 2", type: "single", stat: "Close2P" },
  { key: "three", label: "3PT", type: "single", stat: "3P" },
  { key: "far2", label: "Far 2", type: "single", stat: "Far2P" },
  { key: "stocks", label: "Stl / Blk", type: "blend", stats: ["Stl", "Blk"] },
  { key: "orb", label: "Offensive rebounding", type: "single", stat: "OR" },
  { key: "drb", label: "Defensive rebounding", type: "single", stat: "DR" },
  { key: "play", label: "Playmaking", type: "blend", stats: ["APG", "ARate"] },
  { key: "tov", label: "Ball security", type: "single", stat: "TO" },
];

function buildPoolValueGetter(stat, pool) {
  const values = pool
    .map((p) => {
      const v = statGet(p, stat);
      const n = v == null || v === "" ? 0 : Number(v);
      return Number.isFinite(n) ? n : 0;
    })
    .sort((a, b) => a - b);
  const total = values.length;
  if (total === 0) {
    return () => null;
  }
  return function getPercentile(val) {
    const raw = val == null || val === "" ? 0 : Number(val);
    const n = Number.isFinite(raw) ? raw : 0;
    let low = 0;
    let high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < n) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return LOWER_IS_BETTER.has(stat) ? 100 - pct : pct;
  };
}

export function buildDepthTeamProfileGetters(pool) {
  const getters = {};
  for (const s of POOL_STATS) {
    getters[s] = buildPoolValueGetter(s, pool);
  }
  return getters;
}

function finiteNumberStat(raw) {
  if (raw != null && typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function blendPlayerPercentiles(player, getters, statKeys) {
  const pcts = [];
  for (const k of statKeys) {
    const n = finiteNumberStat(statGet(player, k));
    if (n == null) continue;
    const pct = getters[k](n);
    if (pct != null) pcts.push(pct);
  }
  if (pcts.length === 0) return null;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

function playerMinWeight(p) {
  const raw = statGet(p, "Min");
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param {object[]} rosterPlayers - Full Player docs (same roster as depth-chart).
 * @param {Record<string, (val: unknown) => number|null>} getters - from buildDepthTeamProfileGetters
 */
export function computeTeamDepthProfile(rosterPlayers, getters) {
  const bars = TEAM_PROFILE_CATEGORIES.map((cat) => {
    let sumWP = 0;
    let sumW = 0;
    for (const p of rosterPlayers) {
      const w = playerMinWeight(p);
      if (w <= 0) continue;

      let pc = null;
      if (cat.type === "single") {
        const n = finiteNumberStat(statGet(p, cat.stat));
        if (n == null) continue;
        pc = getters[cat.stat](n);
      } else {
        pc = blendPlayerPercentiles(p, getters, cat.stats);
      }
      if (pc == null) continue;
      sumWP += pc * w;
      sumW += w;
    }
    const value = sumW > 0 ? Math.round(sumWP / sumW) : null;
    return { key: cat.key, label: cat.label, value };
  });
  return { bars };
}
