import { useState, useEffect } from "react";
import { Link } from "react-router";
import Header from "../components/Header.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function WatchlistPage() {
  const { authFetch } = useAuth();
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    async function fetchWatchlist() {
      setLoading(true);
      setError("");
      try {
        const res = await authFetch("/api/watchlist");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to fetch watchlist");
          return;
        }
        setWatchlist(data);
      } catch {
        setError("Network error — is the server running?");
      } finally {
        setLoading(false);
      }
    }
    fetchWatchlist();
  }, []);

  async function handleRemove(entry) {
    const key = `${entry.playerId}-${entry.stat1}-${entry.stat2}`;
    setRemoving(key);
    try {
      const res = await authFetch(
        `/api/watchlist/${entry.playerId}?stat1=${entry.stat1}&stat2=${entry.stat2}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setWatchlist((prev) =>
          prev.filter(
            (e) =>
              !(e.playerId === entry.playerId &&
                e.stat1 === entry.stat1 &&
                e.stat2 === entry.stat2)
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setRemoving(null);
    }
  }

  return (
    <>
      <Header />
      <main className="container">
        <Link to="/" className="back-link">← Back to Search</Link>
        <h1 className="page-title">My Watchlist</h1>

        {loading && (
          <p className="status-msg">⏳ Loading watchlist…</p>
        )}

        {error && (
          <p className="status-msg error">⚠️ {error}</p>
        )}

        {!loading && !error && watchlist.length === 0 && (
          <div className="empty">
            <p>You haven't saved any players yet.</p>
            <Link to="/" className="btn btn-primary" style={{ display: "inline-block", width: "auto" }}>
              Find Players
            </Link>
          </div>
        )}

        {!loading && !error && watchlist.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Player</th>
                  <th scope="col">Team</th>
                  <th scope="col">Pos</th>
                  <th scope="col">Year</th>
                  <th scope="col">Stat 1</th>
                  <th scope="col">Stat 2</th>
                  <th scope="col">Combined</th>
                  <th scope="col">Remove</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((entry, index) => {
                  const key = `${entry.playerId}-${entry.stat1}-${entry.stat2}`;
                  return (
                    <tr key={key}>
                      <td className="rank">{index + 1}</td>
                      <td>{entry.name}</td>
                      <td>{entry.team}</td>
                      <td>{entry.position}</td>
                      <td>{entry.year}</td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {entry.stat1}
                        </span>
                        <br />
                        {entry.stat1Value.toFixed(1)}
                      </td>
                      <td>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {entry.stat2}
                        </span>
                        <br />
                        {entry.stat2Value.toFixed(1)}
                      </td>
                      <td className="combined">{entry.combined.toFixed(1)}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRemove(entry)}
                          disabled={removing === key}
                        >
                          {removing === key ? "…" : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}