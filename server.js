/**
 * Warframe Liquidation Optimizer - Local Proxy Server
 * Copyright (C) 2026 polishdogge
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const CACHE = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes server-side cache

let activeDownloadProcess = null;
let DOWNLOAD_STATE = {
  active: false,
  scope: 'all',
  total: 239,
  completed: 0,
  downloaded: 0,
  cached: 0,
  failed: 0,
  currentSlug: '',
  done: false,
  message: 'Idle'
};

const server = http.createServer(async (req, res) => {
  // Enable CORS on all responses so both same-origin and file:/// can access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url, `http://${host}`);
  const pathname = url.pathname;

  // 1. API Proxy Route: /api/orders/:slug
  if (pathname.startsWith('/api/orders/')) {
    const slug = pathname.replace('/api/orders/', '').trim();
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Item slug is required' }));
      return;
    }

    const platform = (req.headers['platform'] || url.searchParams.get('platform') || 'pc').toLowerCase();
    const cacheKey = `orders:${platform}:${slug}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Proxy-Cache': 'HIT'
      });
      res.end(cached.data);
      return;
    }

    try {
      const targetUrl = `https://api.warframe.market/v2/orders/item/${encodeURIComponent(slug)}`;
      const apiResp = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'Platform': platform,
          'Language': 'en',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const bodyText = await apiResp.text();

      if (apiResp.status === 429) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Warframe.market rate limit hit (HTTP 429)' }));
        return;
      }

      if (!apiResp.ok) {
        res.writeHead(apiResp.status, { 'Content-Type': 'application/json' });
        res.end(bodyText || JSON.stringify({ error: `HTTP ${apiResp.status}` }));
        return;
      }

      // Cache valid order data
      CACHE.set(`orders:${platform}:${slug}`, { timestamp: now, data: bodyText });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Proxy-Cache': 'MISS'
      });
      res.end(bodyText);
    } catch (err) {
      console.error(`[Server Proxy Error] ${slug}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to connect to Warframe.market', details: err.message }));
    }
    return;
  }

  // 2. API Proxy Route: /api/statistics/:slug
  if (pathname.startsWith('/api/statistics/') || pathname.startsWith('/api/stats/')) {
    const slug = pathname.replace(/^\/api\/(statistics|stats)\//, '').trim();
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Item slug is required' }));
      return;
    }

    const platform = (req.headers['platform'] || url.searchParams.get('platform') || 'pc').toLowerCase();
    const cacheKey = `stats:${platform}:${slug}`;
    const now = Date.now();
    const cached = CACHE.get(cacheKey);
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Proxy-Cache': 'HIT'
      });
      res.end(cached.data);
      return;
    }

    try {
      const targetUrl = `https://api.warframe.market/v1/items/${encodeURIComponent(slug)}/statistics`;
      const apiResp = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'Platform': platform,
          'Language': 'en',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const bodyText = await apiResp.text();

      if (apiResp.status === 429) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Warframe.market rate limit hit (HTTP 429)' }));
        return;
      }

      if (!apiResp.ok) {
        res.writeHead(apiResp.status, { 'Content-Type': 'application/json' });
        res.end(bodyText || JSON.stringify({ error: `HTTP ${apiResp.status}` }));
        return;
      }

      CACHE.set(cacheKey, { timestamp: now, data: bodyText });

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Proxy-Cache': 'MISS'
      });
      res.end(bodyText);
    } catch (err) {
      console.error(`[Server Stats Proxy Error] ${slug}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to connect to Warframe.market statistics', details: err.message }));
    }
    return;
  }

  // 3. Image Proxy / Cache Route: /api/image/:slug
  if (pathname.startsWith('/api/image/')) {
    const slug = pathname.replace('/api/image/', '').replace(/[^a-z0-9_-]/gi, '');
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad slug' }));
      return;
    }

    const assetsDir = path.join(__dirname, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    const localPathPng  = path.join(assetsDir, `${slug}.png`);
    const localPathWebp = path.join(assetsDir, `${slug}.webp`);

    function isLowRes(filePath) {
      try {
        const buf = fs.readFileSync(filePath);
        if (filePath.endsWith('.png') && buf.length >= 24) {
          const w = buf.readUInt32BE(16);
          const h = buf.readUInt32BE(20);
          return w <= 128 && h <= 128;
        }
      } catch (e) {}
      return false;
    }

    // Serve from local assets if available and not an old low-res thumbnail
    if (fs.existsSync(localPathWebp) && !isLowRes(localPathWebp)) {
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(localPathWebp).pipe(res);
      return;
    }
    if (fs.existsSync(localPathPng) && !isLowRes(localPathPng)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(localPathPng).pipe(res);
      return;
    }

    // Fallback / Upgrade: fetch high-res icon from Warframe Market API v2, cache locally, and serve
    const WM_HEADERS = {
      'Accept': 'application/json',
      'Language': 'en',
      'Platform': 'pc',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
      const metaResp = await fetch(`https://api.warframe.market/v2/items/${encodeURIComponent(slug)}`, {
        headers: WM_HEADERS
      });
      if (!metaResp.ok) {
        res.writeHead(metaResp.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `WM item metadata ${metaResp.status}` }));
        return;
      }
      const meta = await metaResp.json();
      const imgPath = meta?.data?.i18n?.en?.icon || meta?.data?.i18n?.en?.thumb;
      if (!imgPath) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Image asset not found on WM' }));
        return;
      }

      const imgUrl = `https://warframe.market/static/assets/${imgPath}`;
      const imgResp = await fetch(imgUrl, { headers: { 'User-Agent': WM_HEADERS['User-Agent'] } });
      if (!imgResp.ok) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Image download failed' }));
        return;
      }

      const buf = Buffer.from(await imgResp.arrayBuffer());
      const ext = imgPath.endsWith('.webp') ? '.webp' : '.png';
      const imgContentType = ext === '.webp' ? 'image/webp' : 'image/png';
      const cachePath = path.join(assetsDir, `${slug}${ext}`);

      try {
        fs.writeFileSync(cachePath, buf);
      } catch (writeErr) {
        console.warn(`[Image Cache Write Warning] ${slug}:`, writeErr.message);
      }

      res.writeHead(200, { 'Content-Type': imgContentType, 'Cache-Control': 'public, max-age=86400' });
      res.end(buf);
    } catch (err) {
      console.error(`[Image Proxy Error] ${slug}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Image proxy error', details: err.message }));
    }
    return;
  }

  // 4. Clear Cache Route: /api/clear-cache
  if (pathname === '/api/clear-cache') {
    CACHE.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Server cache cleared' }));
    return;
  }

  // 4b. Download Assets Status Route: /api/download-status
  if (pathname === '/api/download-status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(DOWNLOAD_STATE));
    return;
  }

  // 4c. Download Assets Stop Route: /api/download-stop
  if (pathname === '/api/download-stop') {
    if (activeDownloadProcess) {
      try {
        activeDownloadProcess.kill();
      } catch (e) {}
      activeDownloadProcess = null;
    }
    DOWNLOAD_STATE.active = false;
    DOWNLOAD_STATE.message = 'Download stopped by user';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Download stopped', state: DOWNLOAD_STATE }));
    return;
  }

  // 4d. Trigger Asset Downloader Route: /api/download-assets
  if (pathname === '/api/download-assets') {
    const scope = (url.searchParams.get('scope') || 'all').toLowerCase();
    const force = url.searchParams.get('force') === 'true';

    if (DOWNLOAD_STATE.active) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Download already running', state: DOWNLOAD_STATE }));
      return;
    }

    const scriptPath = path.join(__dirname, 'scripts', 'download-assets.js');
    const args = [scriptPath, `--port=${PORT}`];
    if (scope === 'syndicates') args.push('--syndicates');
    if (scope === 'traders') args.push('--traders');
    if (force) args.push('--force');

    DOWNLOAD_STATE = {
      active: true,
      scope,
      force,
      total: scope === 'syndicates' ? 136 : (scope === 'traders' ? 103 : 239),
      completed: 0,
      downloaded: 0,
      cached: 0,
      failed: 0,
      currentSlug: 'Initializing...',
      done: false,
      message: 'Starting asset downloader...'
    };

    try {
      activeDownloadProcess = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      activeDownloadProcess.stdout.on('data', chunk => {
        const text = chunk.toString();
        // Parse lines like "[  5/239] exodia_might   [ok] (23.2 KB)"
        const match = text.match(/\[\s*(\d+)\s*\/\s*(\d+)\]\s+([a-z0-9_-]+)\s+\[(ok|cached|fail)/i);
        if (match) {
          DOWNLOAD_STATE.completed = parseInt(match[1], 10);
          DOWNLOAD_STATE.total = parseInt(match[2], 10);
          DOWNLOAD_STATE.currentSlug = match[3];
          const status = match[4].toLowerCase();
          if (status === 'ok') DOWNLOAD_STATE.downloaded++;
          else if (status === 'cached') DOWNLOAD_STATE.cached++;
          else if (status.startsWith('fail')) DOWNLOAD_STATE.failed++;
        }
      });

      activeDownloadProcess.stderr.on('data', chunk => {
        console.error('[Asset Downloader]', chunk.toString());
      });

      activeDownloadProcess.on('close', code => {
        DOWNLOAD_STATE.active = false;
        DOWNLOAD_STATE.done = true;
        DOWNLOAD_STATE.message = code === 0 ? 'Download completed successfully' : `Finished with exit code ${code}`;
        activeDownloadProcess = null;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Download started', state: DOWNLOAD_STATE }));
    } catch (err) {
      DOWNLOAD_STATE.active = false;
      DOWNLOAD_STATE.message = `Failed to start downloader: ${err.message}`;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 5. Static Assets (/assets/*) with Automatic Extension Resolution
  if (pathname.startsWith('/assets/')) {
    const rawFilename = pathname.replace('/assets/', '').trim();
    const assetsDir = path.join(__dirname, 'assets');
    const exactPath = path.join(assetsDir, rawFilename);

    if (fs.existsSync(exactPath) && !fs.statSync(exactPath).isDirectory()) {
      const ext = path.extname(exactPath).toLowerCase();
      const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.webp' ? 'image/webp' : (ext === '.png' ? 'image/png' : 'application/octet-stream'));
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(exactPath).pipe(res);
      return;
    }

    // Check alternate extension (e.g. .webp instead of .png, or vice versa)
    const baseSlug = path.basename(rawFilename, path.extname(rawFilename));
    const altPng = path.join(assetsDir, `${baseSlug}.png`);
    const altWebp = path.join(assetsDir, `${baseSlug}.webp`);

    if (fs.existsSync(altWebp)) {
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(altWebp).pipe(res);
      return;
    }
    if (fs.existsSync(altPng)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(altPng).pipe(res);
      return;
    }

    // Asset not found locally: return 404 (do NOT fall back to index.html for images)
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Asset not found');
    return;
  }

  // 6. General Static Files (Serves index.html or other static root assets)
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error reading ' + pathname);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Warframe Syndicate Standing Optimizer`);
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`CORS Proxy: http://localhost:${PORT}/api/orders/:slug`);
  console.log(`Image Proxy: http://localhost:${PORT}/api/image/:slug`);
  console.log(`======================================================\n`);
});
