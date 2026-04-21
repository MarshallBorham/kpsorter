import mongoose from "mongoose";
import { appendFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { TeamStat } from "./models/TeamStat.js";
import { getEnvVar } from "./getEnvVar.js";
import { parsePBP } from "./utils/federerEngine.js";
import "dotenv/config";

const __dirname   = dirname(fileURLToPath(import.meta.url));
const ERRORS_FILE = join(__dirname, "errors.txt");

const SEASON         = 2026;
const DELAY_SCHEDULE = 50;  // ms between schedule fetches
const DELAY_PBP      = 60;  // ms between PBP fetches
const BATCH_SIZE     = 50;  // bulkWrite batch size
const DRY_RUN        = process.argv.includes("--dry-run");
const MAX_GAMES      = 50;   // games to process in dry-run mode

// ── Supplemental IDs: D1 teams that may be missing from ESPN's API responses ──
const SUPPLEMENTAL_TEAM_IDS = [
  "2511",   // Queens University Royals (ASUN)
  "399",    // UAlbany Great Danes (America East)
  "62",     // Hawai'i Rainbow Warriors (Big West)
  "85",     // IU Indianapolis Jaguars (Horizon)
  "219",    // Pennsylvania Quakers (Ivy)
  "23",     // San José State Spartans (Mountain West)
  "112358", // Long Island University Sharks (NEC)
  "2815",   // Lindenwood Lions (OVC)
  "88",     // Southern Indiana Screaming Eagles (OVC)
  "2545",   // SE Louisiana Lions (Southland)
  "2900",   // St. Thomas-Minnesota Tommies (Summit League)
  "2433",   // UL Monroe Warhawks (Sun Belt)
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Strength-of-Schedule multipliers (keyed by common team name) ──────────────
const SOS_CONSTANTS = new Map([
  ["Michigan", 1.1755], ["Alabama", 1.1723], ["Kansas", 1.1663],
  ["Kentucky", 1.1636], ["Purdue", 1.1617], ["Tennessee", 1.1597],
  ["Arizona", 1.1588], ["Texas Tech", 1.1557], ["Florida", 1.1533],
  ["Texas", 1.1507], ["Arkansas", 1.1482], ["Illinois", 1.1467],
  ["Maryland", 1.1466], ["Auburn", 1.1466], ["Vanderbilt", 1.1462],
  ["UConn", 1.1432], ["Connecticut", 1.1432], ["BYU", 1.1428], ["Duke", 1.1422],
  ["Arizona St.", 1.1413], ["Arizona State", 1.1413],
  ["Mississippi", 1.1411], ["Ole Miss", 1.1411],
  ["Michigan St.", 1.1404], ["Michigan State", 1.1404],
  ["Ohio St.", 1.1371], ["Ohio State", 1.1371],
  ["Baylor", 1.1364], ["Wisconsin", 1.1359], ["Houston", 1.1356],
  ["Iowa", 1.1342], ["Oklahoma", 1.1314],
  ["Mississippi St.", 1.1304], ["Mississippi State", 1.1304],
  ["Northwestern", 1.1300], ["UCLA", 1.1271],
  ["Kansas St.", 1.1271], ["Kansas State", 1.1271],
  ["Louisville", 1.1264], ["St. John's", 1.1259], ["Saint John's", 1.1259],
  ["Oregon", 1.1242], ["Iowa St.", 1.1239], ["Iowa State", 1.1239],
  ["Nebraska", 1.1212], ["USC", 1.1207],
  ["Texas A&M", 1.1196], ["UCF", 1.1190], ["TCU", 1.1182],
  ["Washington", 1.1182], ["N.C. State", 1.1177], ["NC State", 1.1177], ["North Carolina State", 1.1177],
  ["Utah", 1.1177], ["Missouri", 1.1169], ["Creighton", 1.1164],
  ["Indiana", 1.1160], ["Xavier", 1.1155],
  ["Oklahoma St.", 1.1136], ["Oklahoma State", 1.1136],
  ["North Carolina", 1.1112], ["Marquette", 1.1112],
  ["Providence", 1.1107], ["Georgia", 1.1106], ["Rutgers", 1.1105],
  ["Villanova", 1.1086], ["South Carolina", 1.1077],
  ["Cincinnati", 1.1073], ["Georgetown", 1.1068], ["Colorado", 1.1065],
  ["LSU", 1.1062], ["Penn St.", 1.1057], ["Penn State", 1.1057],
  ["Florida St.", 1.1053], ["Florida State", 1.1053],
  ["Minnesota", 1.1050], ["SMU", 1.1046], ["Clemson", 1.1037],
  ["Pittsburgh", 1.1025], ["Notre Dame", 1.1007], ["Butler", 1.1001],
  ["Wake Forest", 1.0992], ["Virginia", 1.0975], ["Syracuse", 1.0972],
  ["West Virginia", 1.0942],
  ["Virginia Tech", 1.0937], ["Seton Hall", 1.0905],
  ["San Diego St.", 1.0866], ["San Diego State", 1.0866],
  ["Boise St.", 1.0852], ["Boise State", 1.0852],
  ["Stanford", 1.0842], ["Miami FL", 1.0839], ["Miami", 1.0839],
  ["Utah St.", 1.0830], ["Utah State", 1.0830],
  ["DePaul", 1.0813], ["San Jose St.", 1.0719], ["San José State", 1.0719], ["San Jose State", 1.0719],
  ["UNLV", 1.0704], ["Santa Clara", 1.0617], ["Boston College", 1.0610],
  ["Nevada", 1.0603], ["California", 1.0601], ["Cal", 1.0601],
  ["Gonzaga", 1.0584], ["Georgia Tech", 1.0570],
  ["New Mexico", 1.0556], ["Memphis", 1.0551], ["La Salle", 1.0523],
  ["Saint Mary's", 1.0518], ["St. Mary's", 1.0518],
  ["Air Force", 1.0509], ["Dayton", 1.0502], ["VCU", 1.0492],
  ["Colorado St.", 1.0483], ["Colorado State", 1.0483],
  ["Fresno St.", 1.0475], ["Fresno State", 1.0475],
  ["Washington St.", 1.0465], ["Washington State", 1.0465],
  ["Wyoming", 1.0437], ["Evansville", 1.0392],
  ["Grand Canyon", 1.0381], ["South Florida", 1.0381],
  ["San Francisco", 1.0366], ["Portland", 1.0317],
  ["Saint Joseph's", 1.0290], ["St. Joseph's", 1.0290],
  ["Loyola Chicago", 1.0290],
  ["Oregon St.", 1.0269], ["Oregon State", 1.0269],
  ["Duquesne", 1.0265], ["George Washington", 1.0262],
  ["Davidson", 1.0260], ["Pacific", 1.0255], ["Pepperdine", 1.0255],
  ["Wichita St.", 1.0242], ["Wichita State", 1.0242],
  ["Saint Louis", 1.0238], ["St. Louis", 1.0238],
  ["Illinois St.", 1.0203], ["Illinois State", 1.0203],
  ["Florida Atlantic", 1.0196], ["Tulsa", 1.0195],
  ["San Diego", 1.0189], ["Southern Utah", 1.0178], ["Seattle", 1.0176],
  ["Illinois Chicago", 1.0157], ["UIC", 1.0157],
  ["UTSA", 1.0150], ["Northern Iowa", 1.0148], ["Drake", 1.0148],
  ["St. Bonaventure", 1.0144], ["Southern Illinois", 1.0134],
  ["Murray St.", 1.0109], ["Murray State", 1.0109],
  ["UC Riverside", 1.0104], ["North Texas", 1.0103],
  ["Sacramento St.", 1.0092], ["Sacramento State", 1.0092],
  ["Cal St. Fullerton", 1.0084], ["Cal Poly", 1.0081],
  ["Rhode Island", 1.0075], ["Indiana St.", 1.0074], ["Indiana State", 1.0074],
  ["Middle Tennessee", 1.0070], ["Charlotte", 1.0062],
  ["Long Beach St.", 1.0053], ["Long Beach State", 1.0053],
  ["Bradley", 1.0043],
  ["Eastern Washington", 1.0038], ["Tarleton St.", 1.0038], ["Tarleton State", 1.0038],
  ["Utah Tech", 1.0037],
  ["Sam Houston St.", 1.0035], ["Sam Houston State", 1.0035], ["Sam Houston", 1.0035],
  ["George Mason", 1.0035], ["Campbell", 1.0032], ["New Orleans", 1.0032],
  ["Loyola Marymount", 1.0025], ["Tulane", 1.0024], ["Valparaiso", 1.0023],
  ["UT Arlington", 1.0021],
  ["Cal St. Bakersfield", 0.9991], ["CSUB", 0.9991],
  ["Abilene Christian", 0.9989], ["Richmond", 0.9987], ["Penn", 0.9982],
  ["Rice", 0.9972], ["Oakland", 0.9967],
  ["Texas A&M Corpus Chris", 0.9961], ["Texas A&M-Corpus Christi", 0.9961],
  ["Nicholls", 0.9958], ["UTEP", 0.9958],
  ["East Carolina", 0.9955], ["Utah Valley", 0.9954], ["CSUN", 0.9950],
  ["Montana St.", 0.9949], ["Montana State", 0.9949],
  ["Hofstra", 0.9942], ["Montana", 0.9936], ["Belmont", 0.9933],
  ["UC Davis", 0.9932], ["UAB", 0.9929],
  ["Western Kentucky", 0.9919], ["Liberty", 0.9916],
  ["Eastern Michigan", 0.9906],
  ["East Texas A&M", 0.9896], ["Texas A&M-Commerce", 0.9896],
  ["UC Irvine", 0.9891], ["Idaho St.", 0.9884], ["Idaho State", 0.9884],
  ["Southeastern Louisiana", 0.9883], ["SE Louisiana", 0.9883],
  ["Northwestern St.", 0.9883], ["Northwestern State", 0.9883],
  ["Toledo", 0.9880], ["Princeton", 0.9871],
  ["Gardner Webb", 0.9866], ["Gardner-Webb", 0.9866],
  ["McNeese", 0.9866], ["McNeese State", 0.9866],
  ["Towson", 0.9864], ["New Mexico St.", 0.9863], ["New Mexico State", 0.9863],
  ["FIU", 0.9860], ["Florida International", 0.9860], ["Florida Intl", 0.9860], ["Yale", 0.9857],
  ["UT Rio Grande Valley", 0.9854], ["UTRGV", 0.9854],
  ["Temple", 0.9851], ["UC San Diego", 0.9851], ["UCSD", 0.9851],
  ["UC Santa Barbara", 0.9851], ["UCSB", 0.9851],
  ["Northern Illinois", 0.9849], ["Idaho", 0.9849],
  ["Northern Arizona", 0.9841],
  ["Kennesaw St.", 0.9840], ["Kennesaw State", 0.9840],
  ["Cal Baptist", 0.9836], ["Missouri St.", 0.9830], ["Missouri State", 0.9830],
  ["Western Michigan", 0.9829], ["Incarnate Word", 0.9828],
  ["Ohio", 0.9827], ["Cornell", 0.9817], ["Milwaukee", 0.9816],
  ["Purdue Fort Wayne", 0.9802],
  ["Central Michigan", 0.9798], ["Northeastern", 0.9782],
  ["Cleveland St.", 0.9782], ["Cleveland State", 0.9782],
  ["Fordham", 0.9782], ["Kansas City", 0.9781], ["UMKC", 0.9781],
  ["Denver", 0.9780], ["Oral Roberts", 0.9778], ["Green Bay", 0.9763],
  ["Charleston", 0.9753], ["William & Mary", 0.9752],
  ["Weber St.", 0.9752], ["Weber State", 0.9752],
  ["Portland St.", 0.9751], ["Portland State", 0.9751],
  ["Detroit Mercy", 0.9744],
  ["Kent St.", 0.9743], ["Kent State", 0.9743],
  ["Northern Colorado", 0.9738], ["Dartmouth", 0.9737],
  ["Houston Christian", 0.9731], ["Elon", 0.9725], ["Troy", 0.9721],
  ["Delaware", 0.9716], ["Monmouth", 0.9705],
  ["Jacksonville St.", 0.9701], ["Jacksonville State", 0.9701],
  ["Lamar", 0.9700], ["Louisiana Tech", 0.9697], ["Hawaii", 0.9688], ["Hawai'i", 0.9688], ["Hawaiʻi", 0.9688],
  ["Stephen F. Austin", 0.9675], ["SFA", 0.9675],
  ["Stony Brook", 0.9668], ["Old Dominion", 0.9667],
  ["Nebraska Omaha", 0.9665], ["Akron", 0.9656],
  ["Wright St.", 0.9639], ["Wright State", 0.9639],
  ["IU Indy", 0.9637], ["North Florida", 0.9636],
  ["South Dakota St.", 0.9632], ["South Dakota State", 0.9632],
  ["Bowling Green", 0.9627],
  ["UNC Asheville", 0.9624], ["Harvard", 0.9624], ["Columbia", 0.9613],
  ["Youngstown St.", 0.9606], ["Youngstown State", 0.9606],
  ["Buffalo", 0.9604], ["Southern Miss", 0.9601],
  ["Louisiana Monroe", 0.9599], ["UL Monroe", 0.9599],
  ["Massachusetts", 0.9597], ["UMass", 0.9597],
  ["North Carolina A&T", 0.9592], ["NC A&T", 0.9592],
  ["Western Carolina", 0.9592], ["Stetson", 0.9591],
  ["Arkansas St.", 0.9587], ["Arkansas State", 0.9587],
  ["Hampton", 0.9584], ["North Dakota", 0.9579], ["Georgia St.", 0.9576], ["Georgia State", 0.9576],
  ["Brown", 0.9570], ["Eastern Kentucky", 0.9570], ["Jacksonville", 0.9567],
  ["Miami OH", 0.9567], ["Miami (OH)", 0.9567], ["Miami University", 0.9567],
  ["UNC Wilmington", 0.9553], ["UNCW", 0.9553],
  ["Ball St.", 0.9550], ["Ball State", 0.9550],
  ["Marshall", 0.9550], ["Northern Kentucky", 0.9542],
  ["Drexel", 0.9525], ["Robert Morris", 0.9524], ["Chicago St.", 0.9522], ["Chicago State", 0.9522],
  ["Winthrop", 0.9519], ["Louisiana", 0.9516], ["UL Lafayette", 0.9516],
  ["Rider", 0.9503], ["Presbyterian", 0.9500],
  ["North Alabama", 0.9495], ["Bellarmine", 0.9492], ["Queens", 0.9490],
  ["Coastal Carolina", 0.9483], ["James Madison", 0.9481],
  ["Alcorn St.", 0.9474], ["Alcorn State", 0.9474],
  ["Lipscomb", 0.9452], ["Mercer", 0.9450], ["South Alabama", 0.9445],
  ["USC Upstate", 0.9439],
  ["North Dakota St.", 0.9437], ["North Dakota State", 0.9437],
  ["St. Thomas", 0.9436], ["Saint Thomas", 0.9436],
  ["Furman", 0.9434],
  ["Arkansas Pine Bluff", 0.9431], ["UAPB", 0.9431],
  ["Central Arkansas", 0.9427],
  ["Appalachian St.", 0.9425], ["Appalachian State", 0.9425], ["App State", 0.9425],
  ["The Citadel", 0.9422], ["Citadel", 0.9422],
  ["Merrimack", 0.9419], ["VMI", 0.9416],
  ["Georgia Southern", 0.9395], ["Samford", 0.9394],
  ["Florida Gulf Coast", 0.9392], ["FGCU", 0.9392],
  ["South Dakota", 0.9378], ["UNC Greensboro", 0.9376],
  ["Bucknell", 0.9363], ["Jackson St.", 0.9362], ["Jackson State", 0.9362],
  ["Southern", 0.9357], ["Charleston Southern", 0.9354],
  ["Eastern Illinois", 0.9351], ["Little Rock", 0.9322], ["Arkansas Little Rock", 0.9322],
  ["Austin Peay", 0.9313],
  ["Alabama St.", 0.9307], ["Alabama State", 0.9307],
  ["West Georgia", 0.9300], ["Saint Francis", 0.9297], ["St. Francis", 0.9297],
  ["Texas St.", 0.9289], ["Texas State", 0.9289],
  ["Chattanooga", 0.9283], ["UT Chattanooga", 0.9283],
  ["Mount St. Mary's", 0.9277], ["Radford", 0.9275],
  ["Mississippi Valley St.", 0.9274], ["Mississippi Valley State", 0.9274],
  ["Bethune Cookman", 0.9273], ["Bethune-Cookman", 0.9273],
  ["Colgate", 0.9267], ["Morehead St.", 0.9262], ["Morehead State", 0.9262],
  ["Holy Cross", 0.9258], ["Quinnipiac", 0.9247],
  ["Albany", 0.9243], ["UAlbany", 0.9243],
  ["Coppin St.", 0.9241], ["Coppin State", 0.9241],
  ["Sacred Heart", 0.9240], ["Wofford", 0.9228],
  ["Tennessee St.", 0.9226], ["Tennessee State", 0.9226],
  ["Canisius", 0.9217], ["High Point", 0.9215],
  ["Tennessee Tech", 0.9207], ["Lafayette", 0.9206],
  ["Saint Peter's", 0.9198], ["St. Peter's", 0.9198],
  ["Western Illinois", 0.9195],
  ["East Tennessee St.", 0.9190], ["East Tennessee State", 0.9190], ["ETSU", 0.9190],
  ["Bryant", 0.9184], ["Niagara", 0.9180], ["Manhattan", 0.9180], ["Army", 0.9180],
  ["American", 0.9173], ["New Hampshire", 0.9167],
  ["Southeast Missouri", 0.9158], ["SEMO", 0.9158],
  ["Longwood", 0.9156], ["Southern Indiana", 0.9138], ["Iona", 0.9125],
  ["Texas Southern", 0.9125],
  ["Fairleigh Dickinson", 0.9124], ["FDU", 0.9124],
  ["Siena", 0.9118], ["Boston University", 0.9106], ["BU", 0.9106],
  ["Florida A&M", 0.9102], ["FAMU", 0.9102],
  ["Prairie View A&M", 0.9102], ["Prairie View", 0.9102],
  ["Marist", 0.9101], ["South Carolina St.", 0.9100], ["South Carolina State", 0.9100],
  ["Lehigh", 0.9099],
  ["Tennessee Martin", 0.9092], ["UT Martin", 0.9092],
  ["Wagner", 0.9082], ["Lindenwood", 0.9081],
  ["Grambling St.", 0.9067], ["Grambling", 0.9067],
  ["Maryland Eastern Shore", 0.9062], ["UMES", 0.9062],
  ["Maine", 0.9060], ["LIU", 0.9058], ["Long Island", 0.9058],
  ["UMass Lowell", 0.9058], ["NJIT", 0.9053],
  ["Loyola MD", 0.9038], ["Loyola Maryland", 0.9038],
  ["Fairfield", 0.9036], ["New Haven", 0.9035],
  ["North Carolina Central", 0.8961], ["NCCU", 0.8961],
  ["Stonehill", 0.8946], ["Le Moyne", 0.8918], ["Mercyhurst", 0.8902],
  ["Alabama A&M", 0.8901],
  ["SIUE", 0.8887], ["Southern Illinois Edwardsville", 0.8887],
  ["Vermont", 0.8883],
  ["Central Connecticut", 0.8868], ["CCSU", 0.8868],
  ["Delaware St.", 0.8827], ["Delaware State", 0.8827],
  ["Navy", 0.8824], ["Norfolk St.", 0.8798], ["Norfolk State", 0.8798],
  ["Binghamton", 0.8747], ["Morgan St.", 0.8712], ["Morgan State", 0.8712],
  ["Howard", 0.8665], ["UMBC", 0.8538],
]);

/**
 * Look up SOS multiplier by team name.
 * Tries exact match first, then case-insensitive exact, then checks whether
 * the ESPN display name (e.g. "Arizona Wildcats") starts with a key
 * (e.g. "Arizona"), and finally whether a key starts with the name.
 */
// Pre-sorted by key length descending so longer/more-specific keys (e.g.
// "Miami (OH)") are checked before shorter ones (e.g. "Miami") in starts-with passes.
const SOS_ENTRIES_BY_LENGTH = [...SOS_CONSTANTS.entries()].sort((a, b) => b[0].length - a[0].length);

function getSosMultiplier(teamName) {
  if (!teamName) return null;
  if (SOS_CONSTANTS.has(teamName)) return SOS_CONSTANTS.get(teamName);
  const lower = teamName.toLowerCase();
  // Case-insensitive exact
  for (const [key, val] of SOS_CONSTANTS) {
    if (key.toLowerCase() === lower) return val;
  }
  // ESPN name starts with SOS key — longest keys checked first to avoid
  // "Miami" stealing "Miami (OH) RedHawks" before the specific key matches.
  for (const [key, val] of SOS_ENTRIES_BY_LENGTH) {
    if (lower.startsWith(key.toLowerCase() + " ")) return val;
  }
  // SOS key starts with ESPN name (reverse safety)
  for (const [key, val] of SOS_ENTRIES_BY_LENGTH) {
    if (key.toLowerCase().startsWith(lower + " ")) return val;
  }
  return null;
}

// ── Connect ───────────────────────────────────────────────────────────────────
const MONGO_URI = getEnvVar("MONGODB_URI");
await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

// ── Known non-D1 teams to exclude (NCCAA / NAIA schools in ESPN's DB) ─────────
const NON_D1_PATTERNS = [
  "champion christian",
  "nobel knight",
  "college of biblical studies",
  "mid-atlantic christian",
  "bethesda",
  "virginia lynchburg",
  "lincoln oaklander",
  "ecclesia royal",
];

function isNonD1(teamName) {
  const lower = (teamName ?? "").toLowerCase();
  return NON_D1_PATTERNS.some(p => lower.includes(p));
}

// ── Step 1: Fetch all D1 team IDs ─────────────────────────────────────────────
console.log("Fetching all D1 teams...");
let allTeamIds = [];
let page = 1;
while (true) {
  const res  = await fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/${SEASON}/teams?limit=500&page=${page}`);
  const data = await res.json();
  const refs = data.items || [];
  if (refs.length === 0) break;
  allTeamIds = allTeamIds.concat(
    refs.map(r => { const m = r["$ref"].match(/teams\/(\d+)/); return m ? m[1] : null; })
        .filter(Boolean)
  );
  if (allTeamIds.length >= data.count) break;
  page++;
}
console.log(`Core API: ${allTeamIds.length} teams`);

const allTeamIdSet = new Set(allTeamIds);

// Supplement with site API — uses a different source and may include teams
// missing from the core API (e.g. recently reclassified D1 programs)
try {
  const siteRes   = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000`);
  const siteData  = await siteRes.json();
  const siteTeams = siteData.sports?.[0]?.leagues?.[0]?.teams ?? [];
  let added = 0;
  for (const t of siteTeams) {
    const id = String(t.team?.id ?? "");
    if (id && !allTeamIdSet.has(id)) {
      allTeamIds.push(id);
      allTeamIdSet.add(id);
      added++;
    }
  }
  console.log(`Site API: +${added} additional teams → ${allTeamIds.length} total`);
} catch (err) {
  console.error("  Failed to fetch site API teams:", err.message);
}

let suppAdded = 0;
for (const id of SUPPLEMENTAL_TEAM_IDS) {
  if (!allTeamIdSet.has(id)) {
    allTeamIds.push(id);
    allTeamIdSet.add(id);
    suppAdded++;
  }
}
if (suppAdded > 0) console.log(`Supplemental: +${suppAdded} hardcoded IDs → ${allTeamIds.length} total`);

// ── Step 2: Fetch schedules for each team → collect unique D1 game IDs ────────
// Fetch both regular season (type 2) and postseason (type 3) to capture
// conference tournaments, March Madness, NIT, The Crown, etc.
console.log("Fetching schedules (regular season + postseason)...");
// gameId → { homeTeamId, awayTeamId, homeTeamName, awayTeamName }
const gameMap = new Map();

async function collectGamesFromSchedule(teamId, seasontype) {
  const res  = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule?seasontype=${seasontype}`
  );
  const data = await res.json();

  for (const event of data.events || []) {
    const comp = event.competitions?.[0];
    if (!comp?.status?.type?.completed) continue;

    const gameId = String(event.id);
    if (gameMap.has(gameId)) continue;

    const competitors = comp.competitors || [];
    // Neutral-site games still have homeAway set; fall back to first two if needed
    const home = competitors.find(c => c.homeAway === "home") ?? competitors[0];
    const away = competitors.find(c => c.homeAway === "away") ?? competitors[1];
    if (!home || !away) continue;

    const homeId       = String(home.id);
    const awayId       = String(away.id);
    const homeTeamName = home.team?.displayName ?? home.team?.name ?? homeId;
    const awayTeamName = away.team?.displayName ?? away.team?.name ?? awayId;

    // Only D1 vs D1 games — exclude known non-D1 schools and unrecognized IDs
    if (!allTeamIdSet.has(homeId) || !allTeamIdSet.has(awayId)) continue;
    if (isNonD1(homeTeamName) || isNonD1(awayTeamName)) continue;

    gameMap.set(gameId, { homeTeamId: homeId, awayTeamId: awayId, homeTeamName, awayTeamName });
  }
}

const teamsToProcess = DRY_RUN ? allTeamIds.slice(0, MAX_GAMES) : allTeamIds;
for (let i = 0; i < teamsToProcess.length; i++) {
  const teamId = teamsToProcess[i];
  try {
    await collectGamesFromSchedule(teamId, 2); // regular season
    await delay(DELAY_SCHEDULE);
    await collectGamesFromSchedule(teamId, 3); // postseason (conf tourneys, March Madness, NIT, etc.)
    await delay(DELAY_SCHEDULE);
  } catch (err) {
    console.error(`  Failed schedule for team ${teamId}:`, err.message);
  }
  if ((i + 1) % 50 === 0) {
    console.log(`  Schedules: ${i + 1}/${teamsToProcess.length} teams, ${gameMap.size} unique games`);
  }
}
console.log(`Total unique D1 games: ${gameMap.size}`);

// ── Step 3: Per-team exchange accumulators ────────────────────────────────────
// teamId → { won, lost, tied, games, name }
const teamExchanges = new Map();

function getOrCreate(teamId, teamName) {
  if (!teamExchanges.has(teamId)) {
    teamExchanges.set(teamId, { won: 0, lost: 0, tied: 0, trueWins: 0, trueLosses: 0, games: 0, name: teamName });
  }
  return teamExchanges.get(teamId);
}

// ── Step 4: Fetch PBP for each unique game ────────────────────────────────────
const gameIds = [...gameMap.keys()];
console.log(`\nFetching PBP for ${gameIds.length} games...`);
writeFileSync(ERRORS_FILE, `=== syncFederer run: ${new Date().toISOString()} ===\n`);

let firstFailedGame = null;
let failedGames     = 0;
let totalGames      = 0;

for (let i = 0; i < gameIds.length; i++) {
  const gameId = gameIds[i];
  const { homeTeamId, awayTeamId, homeTeamName, awayTeamName } = gameMap.get(gameId);

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${gameId}`
    );
    if (!res.ok) {
      await delay(DELAY_PBP);
      continue;
    }

    const data   = await res.json();

    // DEBUG: dump first 30 plays of the first game so we can inspect ESPN's field structure
    if (i === 0 && process.argv.includes("--debug-pbp")) {
      const plays = (data.plays ?? []).slice(0, 30);
      for (const p of plays) {
        console.log({
          typeText:   p.type?.text,
          typeId:     p.type?.id,
          text:       p.text,
          scoreValue: p.scoreValue,
          teamId:     p.team?.id,
          sequenceNumber: p.sequenceNumber,
        });
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    const parsed = parsePBP(data);
    if (!parsed) {
      await delay(DELAY_PBP);
      continue;
    }

    if (parsed.sameTeamErrors?.length > 0) {
      const { homeName, awayName } = parsed;
      for (const err of parsed.sameTeamErrors) {
        const lines = [
          `\n--- SAME-TEAM EXCHANGE | game ${gameId} | ${homeName} vs ${awayName} ---`,
          `  legA: team=${err.legA.teamId} pts=${err.legA.points}`,
          `  legB: team=${err.legB.teamId} pts=${err.legB.points}`,
          `  PBP context (${err.plays.length} plays):`,
          ...err.plays.map(p =>
            `    [seq ${p.sequenceNumber ?? "?"}] period=${p.period?.number ?? "?"} ` +
            `clock=${p.clock?.displayValue ?? "?"} team=${p.team?.id ?? "?"} ` +
            `type="${p.type?.text ?? "?"}" text="${p.text ?? ""}"`
          ),
          "",
        ];
        appendFileSync(ERRORS_FILE, lines.join("\n"));
      }
    }

    const { gameResult, homeId, awayId } = parsed;
    const hr = gameResult[homeId];
    const ar = gameResult[awayId];

    // ── Validation ────────────────────────────────────────────────────────────
    totalGames++;

    // 1. Both teams must have the same tied count for this game
    const tiesMatch = hr.tied === ar.tied;

    // 2. Wins and losses must be inverse
    const inverseMatch = hr.won === ar.lost && hr.lost === ar.won;

    // 3. |trueW - trueL| must equal the actual score margin
    const competitors = data.header?.competitions?.[0]?.competitors ?? [];
    const homeComp    = competitors.find(c => c.homeAway === "home");
    const awayComp    = competitors.find(c => c.homeAway === "away");
    const actualMargin   = homeComp && awayComp ? Math.abs(Number(homeComp.score ?? 0) - Number(awayComp.score ?? 0)) : null;
    const computedMargin = Math.abs(hr.trueWins - hr.trueLosses);
    const marginMatch    = actualMargin === null || computedMargin === actualMargin;

    if (!tiesMatch || !inverseMatch || !marginMatch) {
      failedGames++;
      if (!firstFailedGame) firstFailedGame = gameId;
      const reasons = [];
      if (!tiesMatch)    reasons.push(`ties mismatch (home=${hr.tied} away=${ar.tied})`);
      if (!inverseMatch) reasons.push(`W/L not inverse (home=${hr.won}W/${hr.lost}L away=${ar.won}W/${ar.lost}L)`);
      if (!marginMatch)  reasons.push(`margin mismatch (computed=${computedMargin} actual=${actualMargin} homeScore=${homeComp?.score} awayScore=${awayComp?.score})`);
      console.warn(`  [FAIL] game ${gameId}: ${reasons.join(", ")}`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    for (const [teamId, result] of Object.entries(gameResult)) {
      const name = teamId === homeTeamId ? homeTeamName : awayTeamName;
      const acc  = getOrCreate(teamId, name);
      acc.won       += result.won;
      acc.lost      += result.lost;
      acc.tied      += result.tied;
      acc.trueWins  += result.trueWins;
      acc.trueLosses += result.trueLosses;
      acc.games++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  PBP: ${i + 1}/${gameIds.length} games processed`);
    }
    await delay(DELAY_PBP);
  } catch (err) {
    console.error(`  Failed PBP for game ${gameId}:`, err.message);
    await delay(DELAY_PBP);
  }
}

// ── Step 5: Compute FEDERER and write to DB ───────────────────────────────────
if (DRY_RUN) {
  const rows = [...teamExchanges.entries()]
    .map(([, acc]) => {
      const total = acc.won + acc.lost + acc.tied;
      const federerNet     = total > 0 ? ((acc.won - acc.lost) / total).toFixed(4) : null;
      const trueFedererPct = total > 0 ? ((acc.trueWins - acc.trueLosses) / total).toFixed(4) : null;
      const federerElo     = trueFedererPct !== null ? (100 + parseFloat(trueFedererPct) * 100).toFixed(2) : null;
      const sosMult        = getSosMultiplier(acc.name);
      const sosAdjustedElo = federerElo !== null && sosMult !== null ? (parseFloat(federerElo) * sosMult).toFixed(2) : null;
      return { team: acc.name, W: acc.won, L: acc.lost, T: acc.tied, trueWins: acc.trueWins, trueLosses: acc.trueLosses, federerNet, trueFedererPct, federerElo, sosAdjustedElo };
    })
    .sort((a, b) => b.W - a.W);
  console.table(rows);
  const failPct  = totalGames > 0 ? ((failedGames / totalGames) * 100).toFixed(2) : "0.00";
  const firstBad = firstFailedGame ? " — first bad game: " + firstFailedGame : "";
  console.log("\nValidation: " + failedGames + "/" + totalGames + " games failed (" + failPct + "%)" + firstBad);
  await mongoose.disconnect();
  process.exit(0);
}

console.log("\nWriting to database...");
const bulkOps = [];

for (const [espnTeamId, acc] of teamExchanges.entries()) {
  const total    = acc.won + acc.lost + acc.tied;
  const wl       = acc.won + acc.lost;
  const federerPct         = total > 0 ? acc.won / total                  : null;
  const federerPctExclTies = wl    > 0 ? acc.won / wl                     : null;
  const federerNet         = total > 0 ? (acc.won - acc.lost) / total     : null;
  const trueFedererPct     = total > 0 ? (acc.trueWins - acc.trueLosses) / total : null;
  const federerElo         = trueFedererPct !== null ? 100 + trueFedererPct * 100 : null;
  const sosMult            = getSosMultiplier(acc.name);
  const sosAdjustedElo     = federerElo !== null && sosMult !== null ? federerElo * sosMult : null;

  bulkOps.push({
    updateOne: {
      filter: { espnTeamId, season: SEASON },
      update: {
        $set: {
          teamName:           acc.name,
          season:             SEASON,
          exchangesWon:       acc.won,
          exchangesLost:      acc.lost,
          exchangesTied:      acc.tied,
          federerPct,
          federerPctExclTies,
          federerNet,
          trueWins:           acc.trueWins,
          trueLosses:         acc.trueLosses,
          trueFedererPct,
          federerElo,
          sosAdjustedElo,
          gamesProcessed:     acc.games,
          lastSyncedAt:       new Date(),
        },
      },
      upsert: true,
    },
  });
}

for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
  await TeamStat.bulkWrite(bulkOps.slice(i, i + BATCH_SIZE));
}

console.log(`Written ${bulkOps.length} team records`);
const failPct  = totalGames > 0 ? ((failedGames / totalGames) * 100).toFixed(2) : "0.00";
const firstBad = firstFailedGame ? " — first bad game: " + firstFailedGame : "";
console.log("\nValidation: " + failedGames + "/" + totalGames + " games failed (" + failPct + "%)" + firstBad);
await mongoose.disconnect();
console.log("Done");
