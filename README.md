# CBB Sorter

CBB Sorter is a college basketball analytics tool that helps scouts, coaches, and fans find and compare transfer portal players by advanced stats.

## Features

- **Multi-stat search** — Select as many stats as you want and rank players by their combined percentile score across all selected categories
- **Percentile scoring** — Players are ranked by percentile rather than raw values, so stats with different scales are weighted fairly
- **Min% filter** — On by default, filters out players with less than 15% minute share to exclude garbage time players
- **Advanced filters** — Set minimum or maximum thresholds for any stat to narrow results further. Active filters are displayed on the results page
- **Full stat profiles** — Click any player's name to view their complete statistical profile
- **Watchlist** — Save players to your watchlist and review them later. Each saved entry shows the stats it was saved under
- **Most Saved Players** — The home page displays the top 3 most saved players across all users
- **~5,000 players** — Results default to the top 100 but all qualifying players can be shown

## How to Use

1. Select two or more stats from the dropdown menus
2. Optionally adjust the Min% filter or add advanced filters
3. Click **Find Players**
4. Click a player's name to view their full stat profile
5. Click **Save** to add a player to your watchlist

## Tech Stack

- **Frontend** — React, Vite, React Router
- **Backend** — Node.js, Express
- **Database** — MongoDB Atlas
- **Auth** — JWT
- **Hosting** — Railway
