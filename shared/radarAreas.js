/**
 * Canonical radar area definitions — shared between backend and frontend.
 * Each area blends one or more stat percentile keys into a single 0–100 score.
 */

export const RADAR_AREAS = [
  { id: "close2",     label: "Close 2",      keys: ["Close2P", "Close2PM"] },
  { id: "three_pt",   label: "3PT",          keys: ["3P", "3P100"] },
  { id: "far2",       label: "Far 2",        keys: ["Far2P", "Far2PM"] },
  { id: "stl_blk",    label: "Stl / Blk",   keys: ["Stl", "Blk"] },
  { id: "usage",      label: "Usage",        keys: ["Usg"] },
  { id: "shot_pct",   label: "Shot %",       keys: ["eFG", "TS"] },
  { id: "playmaking", label: "Playmaking",   keys: ["APG", "ARate"] },
  { id: "ball_sec",   label: "Ball security",keys: ["TO"] },
];

export const ALL_RADAR_KEYS = [...new Set(RADAR_AREAS.flatMap((a) => a.keys))];
