import type { DepthSlot } from "./depthChart.js";

const AVG_BPR: Record<string, Record<DepthSlot, number>> = {
  Fr: { PG: 0.88, SG: 0.31, SF: 0.62, PF: 0.76,  C: 1.58 },
  So: { PG: 1.68, SG: 0.68, SF: 0.92, PF: 1.12,  C: 1.68 },
  Jr: { PG: 1.59, SG: 0.76, SF: 0.68, PF: 1.67,  C: 2.15 },
  Sr: { PG: 2.49, SG: 1.32, SF: 1.18, PF: 1.89,  C: 2.11 },
};

// (p25, p75) thresholds by class and position
const PCTILE: Record<string, Record<DepthSlot, [number, number]>> = {
  Fr: { PG: [-0.44, 3.17], SG: [-2.00, 2.80], SF: [-0.35, 1.06], PF: [-1.46, 2.29], C: [-1.00, 3.33] },
  So: { PG: [-1.36, 4.29], SG: [-2.38, 2.67], SF: [-1.07, 1.93], PF: [-0.94, 3.09], C: [-1.18, 4.80] },
  Jr: { PG: [-0.85, 3.95], SG: [-1.53, 2.63], SF: [-1.36, 1.88], PF: [-0.08, 3.97], C: [ 0.43, 4.75] },
  Sr: { PG: [ 0.24, 4.22], SG: [-1.00, 3.53], SF: [-1.73, 2.35], PF: [-0.03, 3.71], C: [ 0.20, 4.15] },
};

const YEARS_LEFT: Record<string, number> = { Fr: 3, So: 2, Jr: 1, Sr: 0 };
const NEXT_CLASS: Record<string, string>  = { Fr: "So", So: "Jr", Jr: "Sr" };

export type TvTier = "top" | "mid" | "bottom";

/**
 * Total Value = currBPR + R*(nextClassAvg - currClassAvg) summed for each remaining year.
 * R is fixed at the player's initial tier. TV > BPR for non-Sr players in almost all cases
 * because class averages generally increase each year (Sr avg > current class avg).
 */
export function calcTV(
  currBPR: number,
  year: string,
  slot: DepthSlot
): { tv: number; tier: TvTier } {
  const yearsLeft = YEARS_LEFT[year] ?? 0;

  const [p25, p75] = PCTILE[year]?.[slot] ?? [0, 5];
  let R: number;
  let tier: TvTier;
  if (currBPR >= p75)      { R = 0.80; tier = "top"; }
  else if (currBPR <= p25) { R = 0.20; tier = "bottom"; }
  else                     { R = 0.64; tier = "mid"; }

  if (yearsLeft === 0) {
    return { tv: +currBPR.toFixed(2), tier };
  }

  // Walk through each remaining class step and sum R * (nextAvg - currAvg)
  let currentClass = year;
  let totalIncrement = 0;
  for (let i = 0; i < yearsLeft; i++) {
    const nextClass = NEXT_CLASS[currentClass];
    if (!nextClass) break;
    const currAvg = AVG_BPR[currentClass]?.[slot] ?? 0;
    const nextAvg = AVG_BPR[nextClass]?.[slot] ?? 0;
    totalIncrement += R * (nextAvg - currAvg);
    currentClass = nextClass;
  }

  return { tv: +(currBPR + totalIncrement).toFixed(2), tier };
}
