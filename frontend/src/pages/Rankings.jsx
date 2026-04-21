import { useEffect, useState, useMemo, useRef } from "react";
import Header from "../components/Header.jsx";

const MONO = "var(--font-mono)";

function fmtNet(val) {
  if (val == null) return "—";
  const pct = (val * 100).toFixed(1);
  return val >= 0 ? `+${pct}%` : `${pct}%`;
}

// Color relative to the 50th percentile of the visible dataset
function pctColor(val, median) {
  if (val == null || median == null) return "var(--text-muted)";
  if (val > median) return "var(--success)";
  if (val < median) return "var(--error)";
  return "var(--text)";
}

function median(values) {
  const sorted = values.filter(v => v != null).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function SortTh({ label, col, sortCol, sortDir, onSort, tooltip }) {
  const active = sortCol === col;
  const [tipPos, setTipPos] = useState(null);
  const thRef = useRef(null);

  function handleMouseEnter() {
    if (!tooltip) return;
    const rect = thRef.current?.getBoundingClientRect();
    if (rect) setTipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  }

  return (
    <th
      ref={thRef}
      onClick={() => onSort(col)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTipPos(null)}
      style={{
        padding: "0.6rem 0.75rem",
        textAlign: "center",
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        color: active ? "var(--primary)" : "var(--text-muted)",
      }}
    >
      {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      {tooltip && tipPos && (
        <div style={{
          position: "fixed",
          top: tipPos.top,
          left: tipPos.left,
          transform: "translateX(-50%)",
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          borderRadius: "var(--radius)",
          padding: "0.45rem 0.7rem",
          fontFamily: MONO,
          fontSize: "0.65rem",
          fontWeight: 400,
          color: "var(--text)",
          whiteSpace: "nowrap",
          boxShadow: "var(--shadow-sm)",
          pointerEvents: "none",
          zIndex: 1000,
          letterSpacing: "0.02em",
          textTransform: "none",
        }}>
          {tooltip}
        </div>
      )}
    </th>
  );
}

export default function Rankings() {
  const [teams,    setTeams]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [sortCol, setSortCol] = useState("sosAdjustedElo");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ season: 2026 });
        const res    = await fetch(`/api/rankings?${params}`);
        const data   = await res.json();
        if (!res.ok) { setError(data.error || "Failed to load rankings"); return; }
        setTeams(data.teams ?? []);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  // 50th-percentile thresholds computed from the full dataset
  const thresholds = useMemo(() => ({
    federerNet:     median(teams.map(t => t.federerNet)),
    trueFedererPct: median(teams.map(t => t.trueFedererPct)),
    sosAdjustedElo: median(teams.map(t => t.sosAdjustedElo)),
  }), [teams]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...teams].sort((a, b) => {
      const av = a[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bv = b[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      return (av - bv) * dir;
    });
  }, [teams, sortCol, sortDir]);

  const thStyle = {
    padding: "0.6rem 0.75rem",
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "var(--text-muted)",
  };

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 760, padding: "1.5rem 1rem" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 className="page-title" style={{ margin: 0 }}>Team Rankings</h1>
          <p style={{ fontFamily: MONO, color: "var(--text-muted)", fontSize: "0.72rem", letterSpacing: "0.04em", margin: "0.25rem 0 0" }}>
            // FEDERER — possession exchange win rate
          </p>
        </div>

        {/* ── Description ── */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "1.25rem",
          marginBottom: "1.5rem", boxShadow: "var(--shadow-sm)",
        }}>
          <p style={{ fontFamily: MONO, fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
            Federer% is the percentage of time a team outscores their opponent after they both play a single possession (called a Possession Exchange). The stat was created in order to encapsulate how often each team truly wins and loses throughout a season. It is inspired by Roger Federer, who only won 54% of the points he played in his career. Despite losing 46% of the time, Roger was still the #1 ranked tennis player because he had a Federer% of +8%.
          </p>
        </div>

        {/* ── Status ── */}
        {loading && <p className="status-msg">Loading rankings…</p>}
        {error   && <p className="status-msg error">{error}</p>}

        {!loading && !error && sorted.length === 0 && (
          <p style={{ fontFamily: MONO, textAlign: "center", color: "var(--text-muted)", marginTop: "3rem", fontSize: "0.8rem", letterSpacing: "0.04em" }}>
            // No teams found.
          </p>
        )}

        {/* ── Table ── */}
        {!loading && !error && sorted.length > 0 && (
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "2.5rem" }} />
                <col />
                <col style={{ width: "4.5rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "4rem" }} />
                <col style={{ width: "7.5rem" }} />
                <col style={{ width: "6rem" }} />
              </colgroup>
              <thead>
                <tr style={{
                  background: "var(--bg-2)", borderBottom: "1px solid var(--border-bright)",
                  fontFamily: MONO, fontSize: "0.6rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                  <th style={{ ...thStyle, textAlign: "center" }}>#</th>
                  <th style={{ ...thStyle }}>Team</th>
                  <SortTh label="ELO"            col="sosAdjustedElo" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="An adjusted Elo rating combining True Federer% and strength of schedule" />
                  <SortTh label="W"              col="exchangesWon"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="Total possession exchange wins" />
                  <SortTh label="L"              col="exchangesLost"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="Total possession exchange losses" />
                  <SortTh label="T"              col="exchangesTied"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="Total possession exchange ties" />
                  <SortTh label="True Federer%"  col="trueFedererPct" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="Federer% weighted by the margin of each possession exchange" />
                  <SortTh label="Federer%"       col="federerNet"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltip="Ratio of exchange wins minus exchange losses over total exchanges" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => (
                  <tr
                    key={t.espnTeamId}
                    style={{ borderBottom: "1px solid var(--border)", transition: "background 120ms ease" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--surface-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* Rank */}
                    <td style={{ fontFamily: MONO, fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textAlign: "center", padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                      {i + 1}
                    </td>

                    {/* Team */}
                    <td style={{ fontFamily: MONO, fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", padding: "0.65rem 0.5rem 0.65rem 0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.displayName}
                      {(t.gameWins != null && t.gameLosses != null) && (
                        <span style={{ fontWeight: 400, fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "0.35rem" }}>
                          ({t.gameWins}–{t.gameLosses})
                        </span>
                      )}
                    </td>

                    {/* ELO (×10 for whole number around 1000) */}
                    <td style={{ fontFamily: MONO, fontSize: "0.85rem", fontWeight: 700, textAlign: "center", padding: "0.65rem 0.5rem", color: "var(--text)" }}>
                      {t.sosAdjustedElo != null ? Math.round(t.sosAdjustedElo * 10) : "—"}
                    </td>

                    {/* W */}
                    <td style={{ fontFamily: MONO, fontSize: "0.78rem", textAlign: "center", color: "var(--success)", padding: "0.65rem 0.75rem" }}>
                      {t.exchangesWon.toLocaleString()}
                    </td>

                    {/* L */}
                    <td style={{ fontFamily: MONO, fontSize: "0.78rem", textAlign: "center", color: "var(--error)", padding: "0.65rem 0.75rem" }}>
                      {t.exchangesLost.toLocaleString()}
                    </td>

                    {/* T */}
                    <td style={{ fontFamily: MONO, fontSize: "0.78rem", textAlign: "center", color: "var(--text-muted)", padding: "0.65rem 0.75rem" }}>
                      {t.exchangesTied.toLocaleString()}
                    </td>

                    {/* True Federer% */}
                    <td style={{ fontFamily: MONO, fontSize: "0.85rem", fontWeight: 400, textAlign: "center", padding: "0.65rem 0.75rem", color: t.trueFedererPct > 0 ? "var(--success)" : t.trueFedererPct < 0 ? "var(--error)" : "var(--text)" }}>
                      {fmtNet(t.trueFedererPct)}
                    </td>

                    {/* Federer% (formerly Raw) */}
                    <td style={{ fontFamily: MONO, fontSize: "0.82rem", textAlign: "center", padding: "0.65rem 0.75rem", color: pctColor(t.federerNet, thresholds.federerNet) }}>
                      {fmtNet(t.federerNet)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Legend ── */}
        {!loading && !error && sorted.length > 0 && (
          <div style={{ marginTop: "1.25rem", fontFamily: MONO, fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            // ELO: (100 + True Federer%) × SOS × 10 &nbsp;·&nbsp;
            True Federer%: margin-weighted exchange win rate &nbsp;·&nbsp;
            Federer%: (W−L) / total exchanges &nbsp;·&nbsp;
            colors relative to 50th percentile · click headers to sort · hover headers for descriptions
          </div>
        )}
      </main>
    </>
  );
}
