import { describe, it, expect } from "vitest";
import {
  buildDepthTeamProfileGetters,
  computeTeamDepthProfile,
} from "./teamDepthProfile.js";

describe("computeTeamDepthProfile", () => {
  it("Min-weights offensive rebounding percentiles", () => {
    const pool = [
      { stats: { Min: 20, OR: 5 } },
      { stats: { Min: 20, OR: 15 } },
    ];
    const getters = buildDepthTeamProfileGetters(pool);
    const roster = [
      { stats: { Min: 1, OR: 5 } },
      { stats: { Min: 9, OR: 15 } },
    ];
    const { bars } = computeTeamDepthProfile(roster, getters);
    const orb = bars.find((b) => b.key === "orb");
    const pLow = getters.OR(5);
    const pHigh = getters.OR(15);
    const expected = Math.round((pLow * 1 + pHigh * 9) / 10);
    expect(orb?.value).toBe(expected);
  });
});
