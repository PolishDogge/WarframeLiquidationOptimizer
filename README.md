# Warframe Liquidation Optimizer

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform: Node.js / Python](https://img.shields.io/badge/Platform-Node.js%20%7C%20Python-emerald.svg)](#prerequisites)


A high-performance local web application that analyzes live **Warframe.market API v2** order books and 24-hour transaction statistics to calculate the most profitable Syndicate and Open-World Trader offerings for standing liquidation into platinum.

---

## ✨ Features

- **Syndicates & Open-World Traders**:
  - **6 Core Factions**: Steel Meridian, Arbiters of Hexis, Cephalon Suda, The Perrin Sequence, Red Veil, and New Loka (136 verified tradeable offerings).
  - **6 Open-World Hubs**:
    - **Earth (Cetus)**: Hok (Zaw Exodias), Old Man Suumbaat (Gems & Lenses), The Quills (Operator/Amp Arcanes)
    - **Venus (Fortuna)**: Rude Zuud (Pax Arcanes), Smokefinger (Gems), Little Duck / Vox Solaris (Operator/Amp Arcanes)
    - **Deimos (Necralisk)**: Father (Archon Mods & Theorem/Residual Arcanes), Otak (Gems)
    - **Zariman (Chrysalith)**: Cavalero (Holdfasts Arcanes)
    - **Sanctum Anatomica (Deimos)**: Bird 3 & Loid (Melee & Legendary Arcanes)
    - **1999 Höllvania**: The Hex Syndicate Offerings (Bellicose, Impetus, Crux, Enervate, etc.)
- **On-Demand Lazy Loading**:
  - Planet hubs and syndicates load strictly on demand when selected, never flooding the API with bulk requests all at once.
- **Dual View Modes**:
  - **Tiles View**: High-density responsive card grid showcasing local item thumbnails, standing cost, units affordable, Lowest Sell price, Instant Buyout price, 24h sales velocity badges, and one-click in-game whisper action.
  - **Lines View**: Detailed sortable data table with standing efficiency ratios (`Plat / 1k Standing`), live seller/buyer depth, and multi-buyer book analysis.
- **Dual-Mode Ticking Down Progress Bar**:
  - **Scan Phase**: Fills smoothly from 0% to 100% with animated stripes as items are queried.
  - **Countdown Phase**: Once data is loaded, active stripes disappear and the bar **smoothly ticks down from 100% to 0%** as the timer elapses toward the next refresh, auto-refreshing at 0%.
- **Local Offline Asset Pipeline (`./assets/`)**:
  - All **239 item thumbnails** and **12 official faction emblems** pre-downloaded and stored locally in `./assets/` for zero-latency offline browsing.
  - Automatic on-demand disk caching via `/api/image/:slug` with 24-hour cache headers in both Node.js and Python servers.
- **Strict Rate-Limiting & API v2 Compliance**:
  - Fully migrated to Warframe Market API v2 (`/v2/items/:slug`, `/v2/orders/item/:slug`).
  - Strictly enforces $\ge 500\text{ ms}$ delay per request to guarantee compliance and prevent HTTP 429 rate limits.
- **Standing Calculator & Crossplay Support**:
  - Enter custom standing or click preset chips to instantly calculate exact affordable units and total projected platinum.
  - Filter order books by Crossplay, PC, PlayStation, or Xbox.

---

## 📋 Prerequisites

- **Node.js 18+** (for `server.js`) **or** **Python 3.8+** (for `server.py`)
- Any modern web browser (Chrome, Edge, Firefox, Safari)
- **Zero external package dependencies** (no `npm install` or `pip install` required!)

---

## 🚀 Installation & Quickstart

### Node.js Backend

```bash
git clone https://github.com/PolishDogge/SyndicateChecker.git
cd SyndicateChecker
npm start
```

### Python Backend

```bash
git clone https://github.com/PolishDogge/SyndicateChecker.git
cd SyndicateChecker
python server.py
```

Open **`http://localhost:3000`** in your browser.

---

## 💡 Usage Guide

1. **Choose Category**: Use the top-bar navigation tabs to switch between **Syndicates** and **Traders**.
2. **Select Faction or Hub**: Click any of the 6 syndicate cards or 6 open-world planet cards to begin on-demand scanning (or load from local cache).
3. **Toggle View**: Switch between **`[ Tiles ]`** (visual cards) and **`[ Lines ]`** (detailed table) via the toolbar toggle.
4. **Enter Standing**: Enter your current standing in the liquidation calculator or click a quick preset chip (`25k`, `50k`, `100k`, `125k`, `132k`). The app automatically calculates how many units you can afford and your total projected platinum.
5. **Analyze & Sort**:
   - **Lowest Sell**: Best current competitive listing price on the market.
   - **Instant Buyout**: Top live in-game/online buyer waiting to purchase immediately.
   - **Plat / 1k Standing**: Efficiency ratio to maximize platinum per standing point.
   - **24h Sales**: Real market volume (High, Moderate, Low) with average price and last sold timestamp.
6. **One-Click Whisper**: Click **"Whisper Instant Sell"** on any item with an active buyer to copy the formatted trade command (e.g. `/w BuyerName Hi! I want to sell: [Item Name] for 15 platinum. (warframe.market)`) directly to your clipboard.

---

## 🛠️ Offline Assets Pre-Downloader

All 239 tradeable thumbnails are pre-downloaded in `./assets/`. If you need to re-download or update assets:

```bash
# Download all assets (Syndicates + Traders) with >= 500ms rate limit
node scripts/download-assets.js

# Download only Open World & The Hex trader items (103 items)
node scripts/download-assets.js --traders

# Download only Core Syndicate items (136 items)
node scripts/download-assets.js --syndicates

# Force re-download even if already cached locally
node scripts/download-assets.js --force
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the local HTTP server and proxy listen. |

### API Proxy Endpoints

The local proxy routes bypass browser Cross-Origin Resource Sharing (CORS) restrictions and maintain an in-memory cache with configurable TTL:

| Endpoint | Description |
|---|---|
| `GET /api/orders/:slug` | Proxies Warframe Market v2 orders (`/v2/orders/item/:slug`). Supports platform filters. |
| `GET /api/statistics/:slug` | Proxies Warframe Market v1 statistics (`/v1/items/:slug/statistics`). |
| `GET /api/image/:slug` | Serves local thumbnail from `./assets/` or fetches from Warframe Market, caches to disk, and serves with 24-hour cache header. |
| `GET /assets/*` | Serves local static images with automatic `.webp` $\leftrightarrow$ `.png` extension resolution. |
| `GET /api/clear-cache` | Wipes the server-side in-memory orders cache. |

---

## 📜 Disclaimer & License

This fan-made tool is not affiliated with, endorsed by, or sponsored by **Digital Extremes Ltd.** or **Warframe.market**. All Warframe assets and trademarks belong to Digital Extremes Ltd.

Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [LICENSE](LICENSE) for details.
