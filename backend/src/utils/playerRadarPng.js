/**
 * Renders the player profile radar chart as a PNG (matches web spider chart logic).
 */

import { createCanvas } from "@napi-rs/canvas";
import { Player } from "../models/Player.js";

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

const RADAR_AXES = [
  { short: "Close 2", keys: ["Close2P", "Close2PM"] },
  { short: "3PT", keys: ["3P", "3P100"] },
  { short: "Far 2", keys: ["Far2P", "Far2PM"] },
  { short: "Stl/Blk", keys: ["Stl", "Blk"] },
  { short: "Usg", keys: ["Usg"] },
  { short: "Shot", keys: ["eFG", "TS"] },
  { short: "Ast", keys: ["APG", "ARate"] },
  { short: "TOV", keys: ["TO"] },
];

const ALL_SOURCE_STATS = [...new Set(RADAR_AXES.flatMap((a) => a.keys))];

function getStat(obj, field, key) {
  if (!obj) return undefined;
  const bag = obj[field];
  if (bag == null) return undefined;
  if (typeof bag.get === "function") return bag.get(key);
  return bag[key];
}

function calcPercentiles(stat, pool, statsField) {
  const values = pool.map((p) => getStat(p, statsField, stat) ?? 0).sort((a, b) => a - b);
  const total = values.length;
  return function getPercentile(val) {
    let low = 0;
    let high = total;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (values[mid] < val) low = mid + 1;
      else high = mid;
    }
    const pct = Math.round((low / total) * 100);
    return LOWER_IS_BETTER.has(stat) ? 100 - pct : pct;
  };
}

function blendPercentile(statPcts, keys) {
  const vals = keys.map((k) => statPcts[k]).filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function polarXY(angle, radius) {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

async function getRadarStatPcts(player, top100) {
  const statsField = top100 ? "statsTop100" : "stats";
  const query = top100
    ? { "statsTop100.G": { $exists: true, $gt: 0 }, "statsTop100.Min": { $gte: 15 } }
    : { "stats.Min": { $gte: 15 } };

  const pool = await Player.find(query).lean();
  if (pool.length === 0) return null;

  const statPcts = {};
  for (const s of ALL_SOURCE_STATS) {
    const val = getStat(player, statsField, s);
    if (val != null && typeof val === "number") {
      statPcts[s] = calcPercentiles(s, pool, statsField)(val);
    }
  }
  return statPcts;
}

/**
 * @returns {Promise<Buffer|null>}
 */
export async function renderPlayerRadarPng(player, top100) {
  const statPcts = await getRadarStatPcts(player, top100);
  if (!statPcts || Object.keys(statPcts).length === 0) return null;

  const n = RADAR_AXES.length;
  const values = RADAR_AXES.map((axis) => blendPercentile(statPcts, axis.keys));
  if (!values.some((v) => v != null)) return null;

  const W = 560;
  const H = 560;
  const cx = W / 2;
  const cy = H / 2;
  const dataMaxR = 140;
  const labelR = 188;
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);

  const dataPoints = angles.map((angle, i) => {
    const v = values[i];
    const r = ((v ?? 0) / 100) * dataMaxR;
    return polarXY(angle, r);
  });

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, W, H);

  const gridRings = [0.25, 0.5, 0.75, 1];
  for (const t of gridRings) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const ang = angles[i % n];
      const { x, y } = polarXY(ang, t * dataMaxR);
      const px = cx + x;
      const py = cy + y;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const angle = angles[i];
    const { x, y } = polarXY(angle, dataMaxR);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + x, cy + y);
    ctx.strokeStyle = "#3d4654";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const grd = ctx.createLinearGradient(cx, cy - dataMaxR, cx, cy + dataMaxR);
  grd.addColorStop(0, "rgba(56, 189, 248, 0.35)");
  grd.addColorStop(1, "rgba(56, 189, 248, 0.08)");
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const { x, y } = dataPoints[i % n];
    const px = cx + x;
    const py = cy + y;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (let i = 0; i < n; i++) {
    const { x, y } = dataPoints[i];
    ctx.beginPath();
    ctx.arc(cx + x, cy + y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#0d1117";
    ctx.fill();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  ctx.font = '600 13px "JetBrains Mono", "Consolas", "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < n; i++) {
    const angle = angles[i];
    const { x, y } = polarXY(angle, labelR);
    const v = values[i];
    const line1 = RADAR_AXES[i].short;
    const line2 = v != null ? String(v) : "—";
    const tx = cx + x;
    const ty = cy + y;
    ctx.fillStyle = "#7d8590";
    ctx.fillText(line1, tx, ty - 8);
    ctx.fillStyle = "#4d5566";
    ctx.fillText(line2, tx, ty + 8);
  }

  ctx.font = '700 11px "JetBrains Mono", "Consolas", "Courier New", monospace';
  ctx.fillStyle = "#7d8590";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Profile radar", 16, 14);

  return canvas.toBuffer("image/png");
}
