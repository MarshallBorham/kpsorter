/**
 * Spider/radar chart: 8 wedges from percentile ranks (0–100),
 * same pool as compare API (Min ≥ 15%). TO uses backend-inverted percentile (high = low turnovers).
 */

const MONO = "var(--font-mono)";

const RADAR_AXES = [
  { label: "Close 2", short: "Close 2", keys: ["Close2P", "Close2PM"] },
  { label: "3PT", short: "3PT", keys: ["3P", "3P100"] },
  { label: "Far 2", short: "Far 2", keys: ["Far2P", "Far2PM"] },
  { label: "Stl / Blk", short: "Stl/Blk", keys: ["Stl", "Blk"] },
  { label: "Usage", short: "Usg", keys: ["Usg"] },
  { label: "Shot qual.", short: "Shot", keys: ["eFG", "TS"] },
  { label: "Playmaking", short: "Ast", keys: ["APG", "ARate"] },
  { label: "Ball security", short: "TOV", keys: ["TO"] },
];

function blendPercentile(statPcts, keys) {
  const vals = keys
    .map((k) => statPcts[k])
    .filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function polarPoint(angle, radius) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/** Solid RGB from percentile: red (low) → yellow → green (high). No alpha. */
/** Angular center of wedge between spokes prev and i (for label above that wedge). */
function wedgeBisectorAngle(angles, i, n) {
  const prev = (i - 1 + n) % n;
  const s = Math.sin(angles[prev]) + Math.sin(angles[i]);
  const c = Math.cos(angles[prev]) + Math.cos(angles[i]);
  return Math.atan2(s, c);
}

function colorFromPercentile(p) {
  const t = (p == null ? 0 : Math.max(0, Math.min(100, p))) / 100;
  const c0 = [255, 59, 48];
  const c1 = [245, 166, 35];
  const c2 = [26, 127, 55];
  let r;
  let g;
  let b;
  if (t < 0.45) {
    const u = t / 0.45;
    r = Math.round(c0[0] + (c1[0] - c0[0]) * u);
    g = Math.round(c0[1] + (c1[1] - c0[1]) * u);
    b = Math.round(c0[2] + (c1[2] - c0[2]) * u);
  } else {
    const u = (t - 0.45) / 0.55;
    r = Math.round(c1[0] + (c2[0] - c1[0]) * u);
    g = Math.round(c1[1] + (c2[1] - c1[1]) * u);
    b = Math.round(c1[2] + (c2[2] - c1[2]) * u);
  }
  const h = (x) => x.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function PlayerRadarChart({ percentiles }) {
  const n = RADAR_AXES.length;
  const values = RADAR_AXES.map((axis) => blendPercentile(percentiles || {}, axis.keys));

  const hasAny = values.some((v) => v != null);
  const dataMaxR = 78;
  const gridRings = [0.25, 0.5, 0.75, 1];
  /** Outside the plot; labels sit centered on each wedge (mid-angle), not on spoke alignment hacks. */
  const labelR = 100;

  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);

  const outerOctagonPts = angles
    .map((angle) => {
      const p = polarPoint(angle, dataMaxR);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  const dataPoints = angles.map((angle, i) => {
    const v = values[i];
    const r = ((v ?? 0) / 100) * dataMaxR;
    return polarPoint(angle, r);
  });

  const polygonPts = dataPoints.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        Profile radar
      </span>
      <svg
        viewBox="-110 -110 220 220"
        role="img"
        aria-label="Player percentile profile across eight stat categories"
        style={{ width: "min(100%, 280px)", height: "auto", overflow: "visible" }}
      >
        <polygon points={outerOctagonPts} fill="var(--surface)" stroke="none" />

        <polygon
          points={outerOctagonPts}
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.75"
        />

        {gridRings.map((t) => (
          <polygon
            key={t}
            fill="none"
            stroke="var(--border-bright)"
            strokeWidth="0.65"
            points={angles
              .map((angle) => {
                const p = polarPoint(angle, t * dataMaxR);
                return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
              })
              .join(" ")}
          />
        ))}

        {angles.map((angle, i) => {
          const outer = polarPoint(angle, dataMaxR);
          return (
            <line
              key={i}
              x1="0"
              y1="0"
              x2={outer.x}
              y2={outer.y}
              stroke="var(--border-bright)"
              strokeWidth="0.85"
            />
          );
        })}

        {hasAny &&
          Array.from({ length: n }, (__, i) => {
            const prev = (i - 1 + n) % n;
            const a = dataPoints[prev];
            const b = dataPoints[i];
            const fill = colorFromPercentile(values[i]);
            const d = `M 0 0 L ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
            return <path key={`wedge-${RADAR_AXES[i].label}`} d={d} fill={fill} />;
          })}

        {hasAny && (
          <polygon
            points={polygonPts}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        )}

        {angles.map((_, i) => {
          const labelAngle = wedgeBisectorAngle(angles, i, n);
          const p = polarPoint(labelAngle, labelR);
          const v = values[i];
          return (
            <text
              key={`lbl-${RADAR_AXES[i].label}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "7px",
                fontWeight: 700,
                fill: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              {RADAR_AXES[i].short}
              {v != null ? (
                <tspan style={{ fill: "var(--text-dim)", fontWeight: 600 }}>
                  {` ${v}`}
                </tspan>
              ) : null}
            </text>
          );
        })}

        {hasAny &&
          dataPoints.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r={2.25}
              fill="var(--bg)"
              stroke="var(--primary)"
              strokeWidth="1.2"
            >
              <title>{`${RADAR_AXES[i].label}: ${values[i] != null ? `${values[i]}th pctl` : "—"}`}</title>
            </circle>
          ))}
      </svg>
      {!hasAny && (
        <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: "var(--text-dim)" }}>
          Not enough data for radar
        </span>
      )}
      <span
        style={{
          fontFamily: MONO,
          fontSize: "0.58rem",
          color: "var(--text-dim)",
          textAlign: "center",
          maxWidth: 260,
          lineHeight: 1.45,
        }}
      >
        Percentiles vs. players with Min ≥ 15%. Numbers on axes are blended category scores (0–100).
      </span>
    </div>
  );
}
