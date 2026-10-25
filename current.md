# Current Project Specifications & Feature Inventory

Document updated: 2026-10-04
Branch: beta

## 1. System Overview

Warframe Syndicate Standing Optimizer is a standalone web application designed to compute standing liquidation efficiency for Warframe Syndicates. It queries Warframe.market live order books and 48-hour transaction statistics to evaluate instantaneous cashouts (fulfilling active buy orders) and passive listings (lowest sell asks).

The project contains zero external dependencies. The client is a single HTML5 application, and the backend consists of standalone proxy servers written using Node.js and Python standard libraries.

---

## 2. Server Architecture & Local Proxying

Due to browser Same-Origin Policy (SOP) restrictions, direct browser calls to `api.warframe.market` are blocked unless proxied. The project provides two equivalent backend servers:

### Primary Server (`server.js`)
- Runtime: Node.js 18+ standard library (`http`, `fs`, `path`, native `fetch`).
- Zero npm package dependencies.
- Serves static assets on port `3000` (or `process.env.PORT`).

### Backup Server (`server.py`)
- Runtime: Python 3.8+ standard library (`http.server`, `urllib.request`, `socketserver`).
- Zero pip package dependencies.
- Serves static assets on port `3000` (or `os.environ.get('PORT')`).

### Proxy Routes
Both servers expose identical API endpoints:
- `GET /api/orders/:slug`: Proxies `https://api.warframe.market/v2/orders/item/:slug`. Forwards client `Platform` header and caches responses in memory for 15 minutes (`orders:${platform}:${slug}`).
- `GET /api/statistics/:slug`: Proxies `https://api.warframe.market/v1/items/:slug/statistics`. Forwards client `Platform` header and caches responses in memory for 15 minutes (`stats:${platform}:${slug}`).
- `GET /api/clear-cache`: Purges all cached records from in-memory proxy storage.

### Client Fallback Handling
- Frontend checks local proxy availability first (`/api/orders/...`).
- If running without a local server, attempts direct API requests and displays actionable diagnostics if CORS or network blocks occur.

---

## 3. Data Fetching & Rate Limiting Pipeline

- **Sequential Scan Queue**: Avoids Cloudflare/HTTP 429 rate limit triggers by executing requests sequentially.
- **Queue Cooldown**: Configurable throttle delay between items (default: 380 ms, options: 380ms, 500ms, 750ms, 1000ms).
- **Parallel Endpoint Queries**: For each queued item, orders (`/v2/orders/item/:slug`) and statistics (`/v1/items/:slug/statistics`) are requested concurrently via `Promise.all`.
- **Incremental Row Rendering**: As each item completes, its row in the DOM updates immediately. The UI does not block waiting for the full syndicate scan.
- **HTTP 429 Interception**: Intercepts HTTP 429 responses, displays a top warning banner, pauses queue processing for 3 seconds, and automatically retries the failed item.
- **Cache Persistence**: Successful runs cache data into `localStorage` with configurable TTL (5, 10, 15, or 30 minutes). Incomplete or 429-interrupted runs are never written to persistent cache.

---

## 4. Trading Logic & Filtering Engine

### Strict Rank 0 / Unranked Filtering
- Syndicate standing rewards provide Rank 0 (unranked) mods only.
- In both buy and sell order processing, all orders where `mod_rank !== 0` or `rank !== 0` are discarded.
- Rank 3 (max rank) buy orders are excluded from efficiency ratios and whisper generators.
- Syndicate weapons with earned affinity are untradable and excluded from calculations.

### Demand-Capped Quick Sale Calculations
- Instant buyout calculations evaluate active buyer order depth (`order.quantity`).
- If an active buyer orders 1 unit, instant sell projections cap the sale at 1 unit rather than multiplying total affordable units by that single order price.
- Badges and cards indicate the requested volume (e.g. `1x @ 15p • buyer wants 1`).

### 24-Hour Sales Velocity Tracking
- Queries `/v1/items/:slug/statistics` closed transactions over a rolling 24-hour window (`txTime >= Date.now() - 24 * 60 * 60 * 1000`).
- For augment mods, filters sales strictly to `mod_rank === 0` transactions. Total transactions across all ranks are tracked separately in tooltips.
- Calculates volume-weighted average price and records the timestamp of the latest completed sale.
- Categorizes liquidity into four tiers:
  - High (>= 10 sold / 24h): Bright green badge.
  - Moderate (4 - 9 sold / 24h): Cyan badge.
  - Low (1 - 3 sold / 24h): Amber badge.
  - None (0 sold / 24h): Gray badge.

### Platform & Crossplay Filtering
- Selector in toolbar: Crossplay (default), PC Only, PlayStation, Xbox.
- In Crossplay mode, matches PC players and console players with `user.crossplay === true`.
- Platform switches recalculate and re-filter loaded order datasets in real time without triggering additional API calls.

### Warframe 1999 Atragraph Filter
- By default, filters out signed collector editions (`subtype === 'atragraph'`) so displayed prices reflect standard rank 0 reward cards.
- Toggleable via toolbar and settings modal.

---

## 5. User Interface & Interactive Controls

### Standing Liquidation Calculator
- Input field accepts available standing balance.
- Preset chip selectors: 25,000, 50,000, 100,000, 125,000, 132,000.
- Calculates affordable units per item: `Math.floor(standing / standingCost)`.
- Calculates total projected Platinum yield for both instant cashout and market listings.

### Table Columns & Sorting
1. **Offering / Item Name**: Item name, category badge, and affordable units indicator.
2. **Standing**: Syndicate standing purchase cost.
3. **Lowest Sell**: Lowest active ask price on Warframe.market (online/ingame sellers).
4. **Sell Ratio**: Listing efficiency computed as `(lowest_sell_price / standing_cost) * 1000`.
5. **24h Sales**: Units sold in the last 24 hours, liquidity badge, average realized price, and relative time of last transaction.
6. **Instant Buyout**: Highest active bid price from an online/ingame buyer, capped by requested order quantity.
7. **Live Orders**: Count of active online/ingame sellers and buyers.
8. **Actions**: One-click "Whisper Instant Sell" button.

### In-Game Trade Whisper Generation
- Filters active buyers prioritizing `user.status === 'ingame'`, falling back to `'online'`.
- Copies standard trade text to clipboard:
  `/w {buyer_ingame_name} Hi! I want to sell: [{Item Name}] for {highest_buy_plat} platinum. (warframe.market)`
- Disables button and displays "No active buyer" if no qualifying buyer orders exist.

### Summary Metrics Cards
- **Top Instant Cashout**: Item offering the highest buy ratio, showing projected Platinum yield capped by buyer order quantity.
- **Top Listing Deal**: Item offering the highest sell ratio (Plat / 1k Standing).
- **Syndicate Avg Efficiency**: Arithmetic mean of all item ratios across the syndicate.
- **Active Market Volume**: Total 24-hour confirmed units sold across the syndicate and total active online sellers.

---

## 6. Supported Syndicates

The catalog includes all tradeable offerings for the six core Syndicates:
- Steel Meridian
- Arbiters of Hexis
- Cephalon Suda
- The Perrin Sequence
- Red Veil
- New Loka

---

## 7. Licensing & Standards

- Distributed under the terms of the **GNU General Public License v3.0 (GPLv3)**.
- Full license text located in `LICENSE`.
- No external runtime dependencies, package managers, or compilation steps required.
