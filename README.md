# Warframe Liquidation Optimizer

Turn your hard-earned Syndicate standing and open-world reputation into Platinum with live Warframe.market prices.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-success.svg)](#prerequisites)

---

## Quickstart

### Prerequisites

You only need **one** of the following installed on your computer (no extra libraries, no `npm install` or `pip install` required):

- **Node.js 18+** OR **Python 3.8+**
- Any modern web browser (Chrome, Edge, Firefox, Safari)

### Running Locally

**With Node.js:**
```bash
git clone https://github.com/PolishDogge/WarframeLiquidationOptimizer.git
cd WarframeLiquidationOptimizer
node server.js
```

**With Python:**
```bash
git clone https://github.com/PolishDogge/WarframeLiquidationOptimizer.git
cd WarframeLiquidationOptimizer
python3 server.py
```

Then open **`http://localhost:3000`** in your browser!

---

## What Does This Tool Do?

Figuring out which standing rewards yield the best Platinum return usually requires opening dozens of market tabs. This tool automates the price-checking:

- **Instant Profit Rankings**: Automatically compares standing costs against current market prices so you know exactly which items give the best Platinum return per point of standing.
- **Sell Now or List High**: View live "Instant Buyout" orders to sell to buyers waiting in-game right now, or see the lowest seller listings to set your own competitive price.
- **Standing Calculator**: Enter your current standing (or tap quick presets like `25k` or `125k`) to instantly see how many items you can afford and your total projected earnings.
- **One-Click In-Game Whispers**: Found an active buyer? Tap the whisper button to copy a ready-to-paste trade message directly to your clipboard.
- **All 6 Core Syndicates & 6 Open-World Hubs**: Full coverage for Steel Meridian, Arbiters of Hexis, Cephalon Suda, The Perrin Sequence, Red Veil, and New Loka — as well as Cetus, Fortuna, the Necralisk, Zariman, Sanctum Anatomica, and Höllvania 1999.
- **Crisp Card Previews**: Hover over any card to view enlarged, sharp artwork so you can easily read mod ranks, stats, and polarities.
- **Fast & Responsive**: Clean visual card view (default) and a detailed spreadsheet table view, complete with local image caching so everything loads snappy.

---

## How to Use It

1. **Pick a Category**: Use the top bar to switch between **Syndicates** and **Traders**.
2. **Select a Faction or Hub**: Click any syndicate or planet card to scan live prices.
3. **Set Your Standing**: Type in your available standing or click a preset chip (`25k`, `50k`, `100k`, `125k`, `132k`).
4. **Choose How You Want to Cash Out**:
   - **Need Plat fast?** Look for items with an active **Instant Buyout** price and click **Whisper Instant Sell** to copy the trade command.
   - **Want maximum value?** Sort by **Plat / 1k Standing** or **Lowest Sell** to see what's best to buy and list on the market.
5. **Card or Table View**: Switch between **Tiles** (visual cards) and **Lines** (detailed sortable spreadsheet) anytime using the view toggle.
6. **Download Item Artwork (Optional)**: Open **Settings** (gear icon) and tap **"Download All"**, **"Download Syndicates"**, or **"Download Traders"** to save card images locally for snappy offline browsing with a real-time progress bar.

---

## Developer Notes

For contributors and anyone curious about the technical setup under the hood:

- **Zero External Dependencies**: Both `server.js` and `server.py` rely exclusively on standard libraries (HTTP, FS, URL parsing) — no external package installations needed.
- **CORS & Static Proxying**:
  - The local server proxies Warframe.market API v2 calls (`/v2/orders/item/:slug` and `/v1/items/:slug/statistics`) to bypass browser cross-origin restrictions.
  - Serves local static images and caches freshly downloaded artwork with 24-hour cache headers.
- **Rate-Limiting Compliance**:
  - Requests are automatically paced with a $\ge 500\text{ ms}$ delay to respect Warframe.market's API limits and prevent HTTP 429 throttling.
- **Offline Asset CLI**:
  You can pre-download or force-refresh item artwork directly from your terminal:
  ```bash
  # Download all card artwork
  node scripts/download-assets.js

  # Download only syndicates or traders
  node scripts/download-assets.js --syndicates
  node scripts/download-assets.js --traders

  # Force re-download even if already saved
  node scripts/download-assets.js --force
  ```
- **Modular Project Structure**:
  - Frontend assets and scripts live in `./scripts/` (`style.css`, `app.js`, `syndicates-data.js`, `traders-data.js`).
- **Environment Variables**:
  - `PORT`: Change the listening port (default is `3000`). Example: `PORT=8080 node server.js` or `python3 server.py --port 8080`.

---

## Disclaimer & License

This is an unofficial fan-made project and is not affiliated with, endorsed by, or sponsored by **Digital Extremes Ltd.** or **Warframe.market**. All Warframe assets, names, and trademarks belong to Digital Extremes Ltd.

Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [LICENSE](LICENSE) for details.
