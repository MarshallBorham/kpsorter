// Fetches VerbalCommits portal data and calculates what percent of committed
// transfers committed back to the school they transferred FROM.

const res = await fetch("https://verbalcommits.com/api/vc/players/find/transfers", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    Referer: "https://verbalcommits.com/transfers",
    Origin: "https://verbalcommits.com",
    pb: "tcdIJEr3eL4ZAzyH",
    dnt: "1",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  },
  body: JSON.stringify({
    name: "",
    queryTarget: "TRANSFER",
    transferYear: 2026,
    transferLevel: "D1",
    filters: [
      { type: "HS_GRAD_YEAR", minValue: -1, maxValue: 5000 },
      { type: "HEIGHT", minValue: -1, maxValue: 5000 },
      { type: "WEIGHT", minValue: -1, maxValue: 5000 },
      { type: "RATING", minValue: -1, maxValue: 5000 },
      { type: "GPA", minValue: -1, maxValue: 5000 },
      { type: "PPG", minValue: -1, maxValue: 5000 },
      { type: "APG", minValue: -1, maxValue: 5000 },
      { type: "RPG", minValue: -1, maxValue: 5000 },
      { type: "BPG", minValue: -1, maxValue: 5000 },
      { type: "SPG", minValue: -1, maxValue: 5000 },
      { type: "CRAM", minValue: -1, maxValue: 5000 },
      { type: "RAM", minValue: -1, maxValue: 5000 },
      { type: "FG_PCT", minValue: -1, maxValue: 5000 },
      { type: "FT_PCT", minValue: -1, maxValue: 5000 },
      { type: "THREE_PCT", minValue: -1, maxValue: 5000 },
      { type: "IS_JUCO", comparand: [] },
      { type: "IS_REDSHIRT", comparand: [] },
      { type: "POSITION", comparand: [] },
      { type: "STATUS", comparand: [] },
      { type: "TRANSFER_FROM_TO", comparand: [] },
      { type: "TRANSFER_FROM_TO_CONFERENCE", comparand: [] },
      { type: "STATE", comparand: [] },
      { type: "IS_PLAYER_PLUS", comparand: [] },
      { type: "ELIGIBILITY_YEAR", comparand: [] },
    ],
  }),
});

const allPlayers = await res.json();
console.log(`Fetched ${allPlayers.length} total portal entries\n`);

function editDistance(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function normalizeSchool(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\bst\b/g, "state")
    .replace(/\bno\b/g, "north")
    .replace(/\buniv\b/g, "university")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolMatches(a, b) {
  if (editDistance(a, b) <= 3) return true;
  if (a.length <= 6 && b.replace(/\s/g, "").includes(a.replace(/\s/g, ""))) return true;
  if (b.length <= 6 && a.replace(/\s/g, "").includes(b.replace(/\s/g, ""))) return true;
  return editDistance(normalizeSchool(a), normalizeSchool(b)) <= 3;
}

function isCommittedTransfer(p) {
  const to = String(p.toSchoolName ?? "").trim();
  if (!to) return false;
  const status = String(p.transferStatusName ?? p.transferStatus ?? "").trim().toLowerCase();
  const decision = String(p.transferDecisionType ?? "").trim().toLowerCase();
  if (status.includes("portal") && !/commit|sign|nli|enroll/i.test(status)) return false;
  if (/verbally committed|committed|\bsigned\b|enrolled|\bnli\b|signed nli/i.test(status)) return true;
  if (/verbally|committed|signed|enrolled|nli/i.test(decision)) return true;
  return true;
}

const committed = allPlayers.filter(isCommittedTransfer);
console.log(`Committed transfers: ${committed.length}`);

const returnees = committed.filter(p =>
  schoolMatches(
    String(p.fromSchoolName ?? "").trim(),
    String(p.toSchoolName ?? "").trim()
  )
);

const pct = committed.length ? ((returnees.length / committed.length) * 100).toFixed(1) : "N/A";

console.log(`Committed back to original school: ${returnees.length}`);
console.log(`Percentage: ${pct}%\n`);

if (returnees.length > 0) {
  console.log("Players who committed back to their original school:");
  for (const p of returnees) {
    const name = `${p.playerFirstName ?? ""} ${p.playerLastName ?? ""}`.trim();
    console.log(`  ${name} — ${p.fromSchoolName} → ${p.toSchoolName}`);
  }
}
