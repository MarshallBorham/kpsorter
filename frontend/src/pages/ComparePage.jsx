import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import Header from "../components/Header.jsx";

const STAT_LABELS = {
  PPG: "Points Per Game", RPG: "Rebounds Per Game", APG: "Assists Per Game",
  G: "Games Played", Min: "Min %", ORTG: "Off. Rating", DRTG: "Def. Rating",
  Usg: "Usage %", eFG: "eFG %", TS: "True Shooting %", OR: "Off. Reb %",
  DR: "Def. Reb %", ARate: "Assist Rate", TO: "Turnover %", Blk: "Block %",
  Stl: "Steal %", FTRate: "FT Rate %", FC40: "FC/40", FTA: "FTA", FTM: "FTM",
  FT: "FT %", "2PM": "2PM", "2PA": "2PA", "2P": "2P %", "3PM": "3PM",
  "3PA": "3PA", "3P": "3P %", Close2PM: "Close 2PM", Close2PA: "Close 2PA",
  Close2P: "Close 2P %", Far2PM: "Far 2PM", Far2PA: "Far 2PA", Far2P: "Far 2P %",
  DunksAtt: "Dunks Att.", DunksMade: "Dunks Made", DunkPct: "Dunk %",
  BPM: "BPM", OBPM: "OBPM", DBPM: "DBPM", "3P100": "3P/100",
};

const STAT_GROUPS = [
  { label: "Scoring", stats: ["PPG", "ORTG", "eFG", "TS", "Usg"] },
  { label: "Shooting", stats: ["FT", "FTRate", "2P", "3P", "3P100", "Close2P", "Far2P"] },
  { label: "Volume", stats: ["G", "Min", "FTM", "FTA", "2PM", "2PA", "3PM", "3PA", "Close2PM", "Close2PA", "Far2PM", "Far2PA", "DunksAtt", "DunksMade", "DunkPct"] },
  { label: "Playmaking", stats: ["APG", "ARate", "TO"] },
  { label: "Rebounding", stats: ["RPG", "OR", "DR"] },
  { label: "Defense", stats: ["DRTG", "Blk", "Stl", "FC40"] },
  { label: "Overall", stats: ["BPM", "OBPM", "DBPM"] },
];

const LOWER_IS_BETTER = new Set(["TO", "FC40", "DRTG"]);

function formatVal(stat, val) {
  const wholeNumber = new Set(["G","FTA","FTM","2PM","2PA","3PM","3PA","Close2PM","Close2PA","Far2PM","Far2PA","DunksAtt","DunksMade"]);
  const hundredths = new Set(["DunkPct","Far2P","Close2P","3P","2P","FT"]);
  if (val == null) return "—";
  if (wholeNumber.has(stat)) return Math.round(val).toString();
  if (hundredths.has(stat)) return Number(val).toFixed(2);
  return Number(val).toFixed(1);
}

function ordinal(n) {
  if (n == null) return "—";
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getWinner(stat, valA, valB) {
  if (valA == null && valB == null) return null;
  if (valA == null) return "B";
  if (valB == null) return "A";
  if (valA === valB) return null;
  return LOWER_IS_BETTER.has(stat)
    ? (valA < valB ? "A" : "B")
    : (valA > valB ? "A" : "B");
}

function PlayerSearch({ label, onSelect, selected, excludeId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selected) { setQuery(""); setResults([]); return; }
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults((data.results || []).filter(p => p.id !== excludeId).slice(0, 8));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, excludeId, selected]);

  if (selected) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "1rem 1.25rem", border: "2px solid var(--primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{selected.name}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.2rem" }}>
              {selected.team} · {selected.position} · {selected.year}
              {selected.inPortal && <span style={{ marginLeft: "0.5rem", color: "var(--primary)", fontWeight: 600 }}>IN PORTAL</span>}
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.25rem", lineHeight: 1 }}
          >✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>{label}</label>
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search player name…"
        style={{ width: "100%", padding: "0.6rem 0.85rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "0.95rem", boxSizing: "border-box" }}
      />
      {(results.length > 0 || loading) && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", zIndex: 50, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          {loading && <div style={{ padding: "0.75rem 1rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>Searching…</div>}
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); setQuery(""); setResults([]); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.65rem 1rem", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: "0.9rem" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem", fontSize: "0.8rem" }}>{p.team} · {p.year}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatRow({ stat, playerA, playerB }) {
  const valA = playerA.stats?.[stat];
  const valB = playerB.stats?.[stat];
  const pctA = playerA.statPcts?.[stat];
  const pctB = playerB.statPcts?.[stat];
  const winner = getWinner(stat, valA, valB);

  const barA = pctA ?? 0;
  const barB = pctB ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 1fr", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
      {/* Left player */}
      <div style={{ textAlign: "right" }}>
        <span style={{ fontWeight: winner === "A" ? 700 : 400, color: winner === "A" ? "var(--primary)" : "var(--text)" }}>
          {winner === "A" && <span style={{ marginRight: "0.3rem" }}>✓</span>}
          {formatVal(stat, valA)}
          {pctA != null && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>({ordinal(pctA)})</span>}
        </span>
        <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barA}%`, background: winner === "A" ? "var(--primary)" : "var(--text-muted)", borderRadius: "2px", marginLeft: "auto" }} />
        </div>
      </div>

      {/* Stat name */}
      <div style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
        {STAT_LABELS[stat] || stat}
      </div>

      {/* Right player */}
      <div style={{ textAlign: "left" }}>
        <span style={{ fontWeight: winner === "B" ? 700 : 400, color: winner === "B" ? "var(--primary)" : "var(--text)" }}>
          {formatVal(stat, valB)}
          {pctB != null && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>({ordinal(pctB)})</span>}
          {winner === "B" && <span style={{ marginLeft: "0.3rem" }}>✓</span>}
        </span>
        <div style={{ height: "4px", background: "var(--bg)", borderRadius: "2px", marginTop: "4px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${barB}%`, background: winner === "B" ? "var(--primary)" : "var(--text-muted)", borderRadius: "2px" }} />
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [playerA, setPlayerA] = useState(null);
  const [playerB, setPlayerB] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const p1 = searchParams.get("p1");
  const p2 = searchParams.get("p2");

  // Load comparison when both IDs are in the URL
  useEffect(() => {
    if (!p1 || !p2) { setData(null); return; }
    setLoading(true);
    setError("");
    fetch(`/api/players/compare?p1=${p1}&p2=${p2}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        setPlayerA(d.playerA);
        setPlayerB(d.playerB);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [p1, p2]);

  function handleSelectA(p) {
    setPlayerA(p);
    if (p && playerB) setSearchParams({ p1: p.id, p2: playerB.id });
    else if (!p) setSearchParams(playerB ? { p2: playerB.id } : {});
  }

  function handleSelectB(p) {
    setPlayerB(p);
    if (p && playerA) setSearchParams({ p1: playerA.id, p2: p.id });
    else if (!p) setSearchParams(playerA ? { p1: playerA.id } : {});
  }

  // Tally wins
  let scoreA = 0, scoreB = 0;
  if (data) {
    for (const group of STAT_GROUPS) {
      for (const stat of group.stats) {
        const valA = data.playerA.stats?.[stat];
        const valB = data.playerB.stats?.[stat];
        const w = getWinner(stat, valA, valB);
        if (w === "A") scoreA++;
        if (w === "B") scoreB++;
      }
    }
  }

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 860, padding: "1.5rem 1rem" }}>
        <Link to="/" className="back-link">← Back to Search</Link>
        <h1 className="page-title" style={{ marginBottom: "1.5rem" }}>Compare Players</h1>

        {/* Search row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          <PlayerSearch label="Player 1" onSelect={handleSelectA} selected={playerA} excludeId={playerB?.id} />
          <PlayerSearch label="Player 2" onSelect={handleSelectB} selected={playerB} excludeId={playerA?.id} />
        </div>

        {loading && <p className="status-msg">⏳ Loading comparison…</p>}
        {error && <p className="status-msg error">⚠️ {error}</p>}

        {data && (
          <>
            {/* Score banner */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1rem", alignItems: "center", background: "var(--surface)", borderRadius: "var(--radius)", padding: "1.25rem", marginBottom: "2rem", boxShadow: "var(--shadow)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 700, color: scoreA > scoreB ? "var(--primary)" : "var(--text)" }}>{scoreA}</div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{data.playerA.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{data.playerA.team} · {data.playerA.year}</div>
              </div>
              <div style={{ textAlign: "center", fontSize: "1.25rem", fontWeight: 700, color: "var(--text-muted)" }}>vs</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 700, color: scoreB > scoreA ? "var(--primary)" : "var(--text)" }}>{scoreB}</div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{data.playerB.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{data.playerB.team} · {data.playerB.year}</div>
              </div>
            </div>

            {/* Stat groups */}
            {STAT_GROUPS.map(group => {
              const visibleStats = group.stats.filter(s =>
                data.playerA.stats?.[s] != null || data.playerB.stats?.[s] != null
              );
              if (visibleStats.length === 0) return null;
              return (
                <div key={group.label} style={{ marginBottom: "2rem" }}>
                  <h2 style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    {group.label}
                  </h2>
                  <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "0 1rem", boxShadow: "var(--shadow)" }}>
                    {visibleStats.map(stat => (
                      <StatRow key={stat} stat={stat} playerA={data.playerA} playerB={data.playerB} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!data && !loading && !error && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "3rem" }}>
            Search for two players above to see their full statistical comparison.
          </p>
        )}
      </main>
    </>
  );
}