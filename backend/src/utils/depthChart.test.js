import { describe, it, expect } from "vitest";
import { buildTeamDepth } from "./depthChart.js";

describe("buildTeamDepth", () => {
  it("places a Pure PG in the PG bucket", () => {
    const depth = buildTeamDepth([
      {
        id: "p1",
        name: "Test Player",
        position: "Pure PG",
        stats: { Min: 25 },
        inPortal: false,
      },
    ]);
    expect(depth.PG).toHaveLength(1);
    expect(depth.PG[0].name).toBe("Test Player");
    expect(depth.SG).toHaveLength(0);
  });

  it("excludes Sr class years from slots", () => {
    const depth = buildTeamDepth([
      {
        id: "sr1",
        name: "Senior PG",
        position: "Pure PG",
        stats: { Min: 35 },
        year: "Sr",
        inPortal: false,
      },
      {
        id: "jr1",
        name: "Junior PG",
        position: "Pure PG",
        stats: { Min: 20 },
        year: "Jr",
        inPortal: false,
      },
    ]);
    expect(depth.PG).toHaveLength(1);
    expect(depth.PG[0].name).toBe("Junior PG");
    expect(depth.PG[0].year).toBe("Sr");
  });

  it("bumps displayed class one year (Fr→So→Jr→Sr) only in depth output", () => {
    const depth = buildTeamDepth([
      {
        id: "f",
        name: "F",
        position: "Center",
        stats: { Min: 10 },
        year: "Fr",
        inPortal: false,
      },
      {
        id: "s",
        name: "S",
        position: "Center",
        stats: { Min: 9 },
        year: "So",
        inPortal: false,
      },
    ]);
    const byName = Object.fromEntries(depth.C.map((p) => [p.name, p.year]));
    expect(byName.F).toBe("So");
    expect(byName.S).toBe("Jr");
  });
});
