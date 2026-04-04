import { useEffect, useState } from "react";
import { Link } from "react-router";
import Header from "../components/Header.jsx";

function WinRate({ wins, total }) {
  const rate = total === 0 ? 0 : Math.round((wins / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div style={{ flex: 1, height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${rate}%`, background: "var(--primary)", borderRadius: "3px" }} />
      </div>
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: "2.5rem", textAlign: "right" }}>{rate}%</span>
    </div>
  );
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/players/leaderboard")
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setLeaderboard(d.leaderboard);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 800, padding: "1.5rem 1rem" }}>
        <Link to="/compare" className="back-link">← Back to Compare</Link>
        <h1 className="page-title">Comparison Leaderboard</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Rankings based on head-to-head comparison battles across the site and Discord bot.
        </p>

        {loading && <p className="status-msg">Loading leaderboard…</p>}
        {error && <p className="status-msg error">{error}</p>}

        {!loading && !error && leaderboard.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "3rem" }}>
            No comparisons recorded yet. Use the Compare page or /compare on Discord to get started.
          </p>
        )}

        {leaderboard.length > 0 && (
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2rem 1fr 3rem 3rem 3rem 3rem 8rem",
              gap: "0.75rem",
              padding: "0.6rem 1rem",
              background: "var(--primary)",
              color: "#fff",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              <div>#</div>
              <div>Player</div>
              <div style={{ textAlign: "center" }}>W</div>
              <div style={{ textAlign: "center" }}>L</div>
              <div style={{ textAlign: "center" }}>T</div>
              <div style={{ textAlign: "center" }}>GP</div>
              <div>Win Rate</div>
            </div>

            {leaderboard.map((player, i) => (
              <div
                key={player.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2rem 1fr 3rem 3rem 3rem 3rem 8rem",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  alignItems: "center",
                  borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ fontWeight: 700, color: i < 3 ? "var(--primary)" : "var(--text-muted)", fontSize: i < 3 ? "1rem" : "0.9rem" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div>
                  <Link
                    to={`/player/${player.id}`}
                    style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}
                  >
                    {player.name}
                  </Link>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {player.team} · {player.year}
                  </div>
                </div>
                <div style={{ textAlign: "center", fontWeight: 700, color: "var(--success)" }}>{player.wins}</div>
                <div style={{ textAlign: "center", color: "var(--error)" }}>{player.losses}</div>
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>{player.ties}</div>
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>{player.total}</div>
                <WinRate wins={player.wins} total={player.total} />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}