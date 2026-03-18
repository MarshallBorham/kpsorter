import { useState } from "react";
import { useNavigate } from "react-router";
import Header from "../components/Header.jsx";

const STATS = [
  { value: "eFG",    label: "Effective FG% (eFG)" },
  { value: "ARate",  label: "Assist Rate (ARate)" },
  { value: "Stl",    label: "Steal % (Stl)" },
  { value: "Blk",    label: "Block % (Blk)" },
  { value: "FTRate", label: "Free Throw Rate (FTRate)" },
  { value: "OR",     label: "Offensive Rebound % (OR)" },
  { value: "DR",     label: "Defensive Rebound % (DR)" },
  { value: "TO",     label: "Turnover % (TO)" },
  { value: "Min",    label: "Minutes % (Min)" },
  { value: "Shots",  label: "Shot Rate (Shots)" },
  { value: "TS",     label: "True Shooting % (TS)" },
  { value: "2P",     label: "2-Point % (2P)" },
  { value: "3P",     label: "3-Point % (3P)" },
  { value: "FT",     label: "Free Throw % (FT)" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stat1, setStat1] = useState("eFG");
  const [stat2, setStat2] = useState("ARate");
  const [error, setError] = useState("");

  function handleSearch(e) {
    e.preventDefault();
    if (stat1 === stat2) {
      setError("Please select two different stats.");
      return;
    }
    setError("");
    navigate(`/results?stat1=${stat1}&stat2=${stat2}`);
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="home-hero">
          <h1>Find Top Transfer Portal Players</h1>
          <p>Select two stats to find the best players by combined score</p>

          {error && <p className="error-msg" style={{ maxWidth: 600, margin: "0 auto 1rem" }}>{error}</p>}

          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-form-row">
              <div className="form-group">
                <label htmlFor="stat1">First Stat</label>
                <select
                  id="stat1"
                  value={stat1}
                  onChange={(e) => setStat1(e.target.value)}
                >
                  {STATS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="stat2">Second Stat</label>
                <select
                  id="stat2"
                  value={stat2}
                  onChange={(e) => setStat2(e.target.value)}
                >
                  {STATS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              Find Players
            </button>
          </form>
        </div>
      </main>
    </>
  );
}