# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
npm run dev          # nodemon hot-reload dev server
npm run test         # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run test:ui      # vitest UI dashboard
node src/main.js     # direct start
```

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server (proxies /api → localhost:3000)
npm run build        # production build → frontend/dist
npm run lint         # ESLint
npm run test         # vitest
npm run preview      # preview production build
```

### Production (Railway)
```bash
npm run build   # builds frontend (root-level)
npm start       # starts backend (root-level)
```

### Data Sync Scripts (run from backend/)
```bash
node src/seedPlayers.js    # CSV → MongoDB
node src/syncPortal.js     # transfer portal flags (also runs via cron every 2h)
node src/syncESPN.js       # PPG/RPG/APG from ESPN
node src/syncBPR.js        # BPR fields
node src/syncTop100.js     # Top-100 competition stats
```

## Architecture

This is a college basketball analytics platform — monorepo with Express backend, React frontend, and a Discord bot.

### Structure
```
backend/src/
  main.js              # Express init, MongoDB connect, cron, bot start
  routes/              # playerRoutes, authRoutes, watchlistRoutes
  models/              # Mongoose schemas (Player, User, etc.)
  bot/                 # Discord bot (slash commands, portal, depth chart)
  utils/               # playerSimilarity, depthChart, playerRadarPng, etc.
  sync*.js / seed*.js  # One-off and cron data sync scripts

frontend/src/
  App.jsx              # Route definitions
  pages/               # 11 page components
  components/          # Header, PlayerRadarChart
  context/AuthContext.jsx

shared/
  radarAreas.js        # 8-area radar spec — used by both web app and Discord PNG rendering
```

### Key Design Points

**Player ranking** (`playerRoutes.js`): Multi-stat percentile scoring — up to 6 stats combined. Secondary sort uses raw stats. Some stats are "lower-is-better" (TO, FC40, DRTG) and must be handled accordingly.

**Player similarity** (`utils/playerSimilarity.js`): Z-score normalization per stat, then Euclidean distance. Returns top 3 similar players with a 0–100% similarity score.

**Depth charts** (`utils/depthChart.js`, `utils/teamDepthProfile.js`): 5 position slots per team, sorted by minute %. Class labels are bumped one year for display (Fr→So, etc.) but the stored `year` value is unchanged. Seniors are excluded from depth chart display.

**Discord bot** (`bot/index.js`): 11+ slash commands. Commands can be ephemeral (private) or channel (shared). Radar PNGs are generated server-side via `@napi-rs/canvas` and attached to Discord embeds. `shared/radarAreas.js` is the single source of truth for radar layout used by both the web `PlayerRadarChart` component and the PNG renderer.

**Auth**: JWT + bcrypt. Discord OAuth creates/links accounts. `middleware/auth.js` verifies JWT on protected routes.

**Data flow**: MongoDB is the source of truth. Stats are stored as a `Map` on the `Player` model. Sync scripts populate/update stats from external sources on demand or via cron.

### Environment Variables
```
MONGODB_URI=...
JWT_SECRET=...
DISCORD_BOT_TOKEN=...
PORT=3000  (optional)
```
