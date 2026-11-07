/* ─── Application State ─── */
    const STATE = {
      activeTab: 'syndicates', // 'syndicates' | 'traders'
      currentSyndicate: null,
      currentPlanet: null,
      syndicateItems: {},
      planetItems: {},
      scanInProgress: false,
      scanSessionId: 0,
      activeFilter: 'all',
      searchQuery: '',
      sortColumn: 'sellRatio',
      sortAsc: false,
      excludeAtragraphs: true,
      platform: 'crossplay',
      availableStanding: 125000,
      viewMode: 'tiles', // 'tiles' | 'lines'
      settings: {
        ttlMinutes: 15,
        delayMs: 500, // strictly >= 500 ms default
        excludeAtragraphs: true,
        platform: 'crossplay',
        availableStanding: 125000,
        viewMode: 'tiles'
      },
      countdownInterval: null
    };

    /* ─── Active Dataset & Cache Helpers ────────────────────────────────────────── */
    function getActiveDataset() {
      if (STATE.activeTab === 'traders') {
        const pId = STATE.currentPlanet;
        return {
          isTrader: true,
          id: pId,
          meta: pId ? TRADERS_DATA[pId] : null,
          items: pId ? (STATE.planetItems[pId] || []) : []
        };
      }
      const sId = STATE.currentSyndicate;
      return {
        isTrader: false,
        id: sId,
        meta: sId ? SYNDICATES_DATA[sId] : null,
        items: sId ? (STATE.syndicateItems[sId] || []) : []
      };
    }

    function getCacheKey(targetId) {
      const p = STATE.platform || 'crossplay';
      const a = STATE.excludeAtragraphs ? '1' : '0';
      const prefix = STATE.activeTab === 'traders' ? 'wf_planet' : 'wf_syndicate';
      return `${prefix}_${targetId}_${p}_${a}`;
    }

    function getCachedData(targetId) {
      try {
        const raw = localStorage.getItem(getCacheKey(targetId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const ttlMs = STATE.settings.ttlMinutes * 60 * 1000;
        const age = Date.now() - parsed.timestamp;
        if (age < ttlMs && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Cache parse error', e);
      }
      return null;
    }

    function setCachedData(targetId, items) {
      try {
        const payload = {
          timestamp: Date.now(),
          target: targetId,
          tab: STATE.activeTab,
          items: items
        };
        localStorage.setItem(getCacheKey(targetId), JSON.stringify(payload));
      } catch (e) {
        console.warn('Cache write error', e);
      }
    }

    function getCachedSyndicateData(sid) { return getCachedData(sid); }
    function setCachedSyndicateData(sid, items) { return setCachedData(sid, items); }

    /* ─── Settings Persistence ──────────────────────────────────────────────── */
    function loadSettings() {
      try {
        const saved = localStorage.getItem('wf_syndicate_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          STATE.settings.ttlMinutes = parsed.ttlMinutes || 15;
          STATE.settings.delayMs = Math.max(500, parsed.delayMs || 500);
          if (parsed.viewMode) { STATE.settings.viewMode = parsed.viewMode; STATE.viewMode = parsed.viewMode; }
          if (parsed.excludeAtragraphs !== undefined) {
            STATE.settings.excludeAtragraphs = parsed.excludeAtragraphs !== false;
            STATE.excludeAtragraphs = STATE.settings.excludeAtragraphs;
          }
          if (parsed.platform) {
            STATE.settings.platform = parsed.platform;
            STATE.platform = parsed.platform;
          }
          if (parsed.availableStanding !== undefined) {
            STATE.settings.availableStanding = parseInt(parsed.availableStanding, 10) || 125000;
            STATE.availableStanding = STATE.settings.availableStanding;
          }
        }
      } catch (e) {
        console.warn('Could not read settings from localStorage', e);
      }
    }

    function saveSettings() {
      try {
        localStorage.setItem('wf_syndicate_settings', JSON.stringify(STATE.settings));
      } catch (e) {}
    }

    /* ─── LocalStorage Cache Utilities ─── */
    function getCacheKey(syndicateId) {
      return `wf_syndicate_cache_${syndicateId}`;
    }

    function getCachedSyndicateData(syndicateId) {
      try {
        const raw = localStorage.getItem(getCacheKey(syndicateId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const ttlMs = STATE.settings.ttlMinutes * 60 * 1000;
        const age = Date.now() - parsed.timestamp;
        if (age < ttlMs && Array.isArray(parsed.items) && parsed.items.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Cache parse error', e);
      }
      return null;
    }

    function setCachedSyndicateData(syndicateId, items) {
      try {
        const payload = {
          timestamp: Date.now(),
          syndicate: syndicateId,
          items: items
        };
        localStorage.setItem(getCacheKey(syndicateId), JSON.stringify(payload));
      } catch (e) {
        console.warn('Cache write error', e);
      }
    }

    /* ─── Warning & Error Banner ─── */
    function showErrorBanner(messageHtml) {
      const banner = document.getElementById('error-banner');
      const textEl = document.getElementById('error-banner-text');
      if (banner && textEl) {
        textEl.innerHTML = messageHtml;
        banner.classList.add('visible');
      }
    }

    function hideErrorBanner() {
      const banner = document.getElementById('error-banner');
      if (banner) {
        banner.classList.remove('visible');
      }
    }

    /* ─── Syndicate Selector Grid ─── */
    function initSyndicateSelector() {
      const container = document.getElementById('syndicate-selector');
      container.innerHTML = '';

      Object.values(SYNDICATES_DATA).forEach(syn => {
        const card = document.createElement('div');
        card.className = `syn-card ${syn.id === STATE.currentSyndicate ? 'active' : ''}`;
        card.dataset.synId = syn.id;
        card.style.setProperty('--syn-card-color', syn.color);
        card.style.setProperty('--syn-card-glow', `${syn.color}35`);

        card.innerHTML = `
          <img class="syn-logo-img" src="${syn.logo}" alt="${escapeAttr(syn.name)} Emblem" loading="lazy" />
          <div class="syn-title">${escapeHtml(syn.name)}</div>
          <div class="syn-count">${syn.items.length} rewards</div>
        `;

        card.addEventListener('click', () => selectSyndicate(syn.id));
        container.appendChild(card);
      });
    }

    /* ─── Select Syndicate (On-Demand & Clean Reset) ─── */
    function selectSyndicate(syndicateId) {
      if (STATE.currentSyndicate === syndicateId && STATE.syndicateItems[syndicateId] && !STATE.scanInProgress) {
        return;
      }

      // 1. Cancel any in-progress queue
      STATE.scanSessionId++;
      STATE.scanInProgress = false;
      STATE.currentSyndicate = syndicateId;

      // 2. Clear error banner & reset status indicators
      hideErrorBanner();
      updateProgressBar(0, 1);
      setStatus('Ready', false);

      // 3. Update Card Active Classes
      document.querySelectorAll('.syn-card').forEach(c => {
        c.classList.toggle('active', c.dataset.synId === syndicateId);
      });

      // 4. Reveal Dashboard, Hide Initial Empty State
      document.getElementById('empty-state-panel').style.display = 'none';
      const dash = document.getElementById('dashboard-content');
      dash.classList.add('visible');
      document.getElementById('btn-force-refresh').style.display = 'inline-flex';

      // 5. Update Theme Accent Colors
      const currentSyn = SYNDICATES_DATA[syndicateId];
      if (currentSyn) {
        document.documentElement.style.setProperty('--syn-active-color', currentSyn.color);
        document.documentElement.style.setProperty('--syn-active-glow', `${currentSyn.color}40`);
      }

      // 6. Check Cache
      const cached = getCachedSyndicateData(syndicateId);
      if (cached) {
        STATE.syndicateItems[syndicateId] = cached.items;
        STATE.syndicateItems[syndicateId].forEach(it => {
          if (it.rawOrders) applyItemMetrics(it);
        });
        renderCurrentView();
        updateSummaryMetrics();
        startCountdownTimer(cached.timestamp);
        setStatus(`Using cached data from ${formatTimeAgo(cached.timestamp)}`, false);
        setApiBadge('Cached', false);
        return;
      }

      // 7. Reset and initialize item list in pending state
      STATE.syndicateItems[syndicateId] = currentSyn.items.map(it => ({
        ...it,
        lowestSellPrice: null,
        sellRatio: null,
        sellSeller: null,
        sellStatus: 'offline',
        ingameSellers: 0,
        onlineSellers: 0,
        highestBuyPrice: null,
        buyRatio: null,
        buyerName: null,
        buyerStatus: 'offline',
        ingameBuyers: 0,
        onlineBuyers: 0,
        rawOrders: [],
        updatedAt: null,
        _scanned: false,
        _loading: true
      }));

      // Render items immediately so user sees items right away while scan runs
      renderCurrentView();
      updateSummaryMetrics();

      // Launch sequential throttled scan
      startScan(syndicateId);
    }

    /* ─── Sequential Rate-Limited Fetch Queue (Prevent 429s) ─── */
    async function startScan(targetId) {
      if (!targetId) return;

      const sessionId = ++STATE.scanSessionId;
      STATE.scanInProgress = true;
      hideErrorBanner();
      setApiBadge('Scanning...', true);

      const active = getActiveDataset();
      const meta = active.meta;
      const items = active.items;
      if (!meta || !items || !items.length) return;

      const total = items.length;
      // Strictly enforce >= 500 ms delay between sequential requests
      const delay = Math.max(500, parseInt(STATE.settings.delayMs, 10) || 500);
      let failedCount = 0;

      updateProgressBar(0, total);
      setStatus(`Scanning ${meta.name}: 0/${total} items...`, true);

      for (let i = 0; i < total; i++) {
        if (sessionId !== STATE.scanSessionId) return;

        const item = items[i];
        setStatus(`Scanning ${meta.name}: ${i + 1}/${total} items (${item.name})...`, true);
        updateProgressBar(i, total);

        let retries = 0;
        let success = false;

        while (retries <= 2) {
          if (sessionId !== STATE.scanSessionId) return;
          try {
            const [orderData, statsData] = await Promise.all([
              fetchOrdersForItem(item.slug),
              fetchStatisticsForItem(item.slug).catch(err => {
                console.warn(`[WF Stats] Failed stats for ${item.slug}:`, err);
                return null;
              })
            ]);
            if (sessionId !== STATE.scanSessionId) return;

            parseAndApplyOrders(targetId, item.slug, orderData);
            if (statsData) {
              parseAndApplyStatistics(targetId, item.slug, statsData);
            }
            item._scanned = true;
            item._loading = false;

            // Live incremental update: update row / tile immediately
            updateItemRow(targetId, item.slug);
            updateSummaryMetrics();
            hideErrorBanner();
            success = true;
            break;
          } catch (err) {
            if (sessionId !== STATE.scanSessionId) return;

            if (err.status === 429) {
              showErrorBanner(`<strong>Warframe.market rate limit hit (HTTP 429).</strong> Pausing queue for 3 seconds...`);
              await new Promise(r => setTimeout(r, 3000));
              if (sessionId !== STATE.scanSessionId) return;
              retries++;
            } else if (err.isCors || (err.message && (err.message.includes('NetworkError') || err.message.includes('Cross-Origin')))) {
              console.warn(`[WF API] CORS error fetching ${item.slug}:`, err);
              showErrorBanner(`<strong>Cross-Origin Request Blocked (CORS):</strong> Run <code>npm start</code> or <code>python server.py</code> to launch without CORS restrictions!`);
              break;
            } else {
              console.warn(`[WF API] Error fetching ${item.slug}:`, err);
              showErrorBanner(`<strong>Network error connecting to Warframe.market.</strong> (${escapeHtml(err.message || 'check internet connection')}).`);
              break;
            }
          }
        }

        if (!success) {
          failedCount++;
          item._loading = false;
          item._scanned = true;
          updateItemRow(targetId, item.slug);
        }

        // Enforce safe >= 500 ms delay
        if (i < total - 1 && sessionId === STATE.scanSessionId) {
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (sessionId !== STATE.scanSessionId) return;

      updateProgressBar(total, total);
      STATE.scanInProgress = false;
      setApiBadge('Live', false);

      if (failedCount === 0) {
        setCachedData(targetId, items);
        startCountdownTimer(Date.now());
        hideErrorBanner();
        setStatus(`Scan complete for ${meta.name} (${total} items)`, false);
      } else {
        setStatus(`Scan finished with ${failedCount} item error(s) — ${meta.name} (not cached)`, false);
      }

      updateSummaryMetrics();
      renderCurrentView();
      showToast(`Scan complete for ${meta.name}`);
    }

    /* ─── API Fetcher with Local Proxy & CORS Support ───────────────────────── */
async function fetchOrdersForItem(slug) {
      const endpoints = [];

      // 1. Same-origin local proxy route (when served from node/python server)
      const isHttp = (typeof window !== 'undefined' && window.location && typeof window.location.protocol === 'string' && window.location.protocol.startsWith('http'));
      if (isHttp) {
        endpoints.push(`/api/orders/${encodeURIComponent(slug)}`);
      }

      // 2. Local proxy on port 3000 (when opened via file:/// with local server running)
      endpoints.push(`http://localhost:3000/api/orders/${encodeURIComponent(slug)}`);

      // 3. Direct warframe.market endpoint (fallback)
      endpoints.push(`https://api.warframe.market/v2/orders/item/${encodeURIComponent(slug)}`);

      let lastError = null;
      for (const endpoint of endpoints) {
        try {
          const resp = await fetch(endpoint, {
            headers: { 'Accept': 'application/json' }
          });

          if (resp.status === 429) {
            const err = new Error('Warframe.market rate limit hit (HTTP 429)');
            err.status = 429;
            throw err;
          }

          if (!resp.ok) {
            const err = new Error(`HTTP ${resp.status}`);
            err.status = resp.status;
            throw err;
          }

          return await resp.json();
        } catch (err) {
          if (err.status === 429) {
            throw err;
          }
          lastError = err;
        }
      }

      const corsErr = new Error('Cross-Origin Request Blocked by browser');
      corsErr.isCors = true;
      throw corsErr;
    }

    async function fetchStatisticsForItem(slug) {
      const endpoints = [];
      const platform = STATE.platform || 'crossplay';
      const platParam = platform !== 'crossplay' ? `?platform=${encodeURIComponent(platform)}` : '';

      const isHttp = (typeof window !== 'undefined' && window.location && typeof window.location.protocol === 'string' && window.location.protocol.startsWith('http'));
      if (isHttp) {
        endpoints.push(`/api/statistics/${encodeURIComponent(slug)}${platParam}`);
      }

      endpoints.push(`http://localhost:3000/api/statistics/${encodeURIComponent(slug)}${platParam}`);
      endpoints.push(`https://api.warframe.market/v1/items/${encodeURIComponent(slug)}/statistics`);

      for (const endpoint of endpoints) {
        try {
          const headers = { 'Accept': 'application/json' };
          if (platform && platform !== 'crossplay') {
            headers['Platform'] = platform;
          }
          const resp = await fetch(endpoint, { headers });
          if (resp.status === 429) {
            const err = new Error('Warframe.market rate limit hit (HTTP 429)');
            err.status = 429;
            throw err;
          }
          if (!resp.ok) continue;
          return await resp.json();
        } catch (err) {
          if (err.status === 429) throw err;
        }
      }
      return null;
    }

    function parseAndApplyStatistics(syndicateId, slug, rawJson) {
      const itemsList = STATE.syndicateItems[syndicateId] || STATE.planetItems[syndicateId];
      if (!itemsList) return;
      const item = itemsList.find(i => i.slug === slug);
      if (!item) return;

      applyStatisticsMetrics(item, rawJson);
    }

    function applyStatisticsMetrics(item, rawStats) {
      if (!rawStats || !rawStats.payload) {
        item.volume24h = item.volume24h !== undefined ? item.volume24h : 0;
        item.volume24hTotal = item.volume24hTotal !== undefined ? item.volume24hTotal : 0;
        item.avgPrice24h = item.avgPrice24h !== undefined ? item.avgPrice24h : null;
        item.lastSoldAgo = item.lastSoldAgo !== undefined ? item.lastSoldAgo : null;
        item.velocityTier = item.velocityTier !== undefined ? item.velocityTier : 'none';
        return;
      }

      const closed = rawStats.payload.statistics_closed || {};
      const list48 = closed['48hours'] || [];
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      let volRank0 = 0;
      let volTotal = 0;
      let totalPriceVolume = 0;
      let latestTxTime = null;

      const isMod = item.type && item.type.includes('Augment');

      for (const entry of list48) {
        const txTime = new Date(entry.datetime).getTime();
        if (isNaN(txTime)) continue;

        if (latestTxTime === null || txTime > latestTxTime) {
          latestTxTime = txTime;
        }

        if (txTime >= oneDayAgo) {
          const vol = (typeof entry.volume === 'number' && entry.volume > 0) ? entry.volume : 0;
          volTotal += vol;

          // For augment mods, track Rank 0 specifically (syndicate items are unranked)
          const isRank0 = (entry.mod_rank === 0 || entry.mod_rank === undefined);
          if (isRank0 || !isMod) {
            volRank0 += vol;
            const price = entry.wa_price || entry.median || entry.avg_price || entry.closed_price || 0;
            totalPriceVolume += price * vol;
          }
        }
      }

      // For mods, volume24h is rank 0 volume; for weapons, it's total volume
      item.volume24h = isMod ? volRank0 : volTotal;
      item.volume24hTotal = volTotal;
      item.avgPrice24h = (volRank0 > 0 && totalPriceVolume > 0) ? parseFloat((totalPriceVolume / volRank0).toFixed(1)) : null;

      // Relative time of last recorded sale
      if (latestTxTime) {
        const diffMs = now - latestTxTime;
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        if (diffHours < 1) {
          item.lastSoldAgo = '<1h ago';
        } else if (diffHours < 24) {
          item.lastSoldAgo = `${diffHours}h ago`;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          item.lastSoldAgo = `${diffDays}d ago`;
        }
      } else {
        item.lastSoldAgo = null;
      }

      // Velocity Tier
      const v = item.volume24h;
      if (v >= 10) {
        item.velocityTier = 'high';
      } else if (v >= 4) {
        item.velocityTier = 'med';
      } else if (v >= 1) {
        item.velocityTier = 'low';
      } else {
        item.velocityTier = 'none';
      }

      item.rawStatistics = rawStats;
    }

    /* ─── Order Parser & Real Buyer Extraction ─── */
    function parseAndApplyOrders(syndicateId, slug, rawJson) {
      const itemsList = STATE.syndicateItems[syndicateId] || STATE.planetItems[syndicateId];
      if (!itemsList) return;

      const item = itemsList.find(it => it.slug === slug);
      if (!item) return;

      item._loading = false;

      let orders = [];
      if (rawJson && Array.isArray(rawJson.data)) {
        orders = rawJson.data;
      } else if (rawJson && rawJson.payload && Array.isArray(rawJson.payload.orders)) {
        orders = rawJson.payload.orders;
      }

      if (!orders || orders.length === 0) {
        item.rawOrders = [];
        applyItemMetrics(item);
        item.updatedAt = Date.now();
        return;
      }

      // Normalize orders
      const normalized = orders.map(o => {
        const orderType = (o.type || o.order_type || '').toLowerCase();
        const rawRank = (o.rank !== undefined) ? o.rank : ((o.mod_rank !== undefined) ? o.mod_rank : 0);
        const rank = (typeof rawRank === 'number') ? rawRank : 0;
        const user = o.user || {};
        const userName = user.ingame_name || user.ingameName || null;
        const userStatus = (user.status || 'offline').toLowerCase();
        const userPlatform = (user.platform || 'pc').toLowerCase();
        const userCrossplay = user.crossplay === true;
        const platinum = typeof o.platinum === 'number' ? o.platinum : 0;
        const rawQty = (typeof o.quantity === 'number' && o.quantity > 0) ? Math.floor(o.quantity) : 1;
        const quantity = rawQty >= 1 ? rawQty : 1;
        const visible = o.visible !== false;
        const subtype = (o.subtype || '').toLowerCase();
        const isAtragraph = subtype.includes('atra');

        return { orderType, rank, userName, userStatus, userPlatform, userCrossplay, platinum, quantity, visible, subtype, isAtragraph };
      });

      item.rawOrders = normalized;
      applyItemMetrics(item);
      item.updatedAt = Date.now();
    }

    function orderMatchesPlatform(o) {
      const p = STATE.platform || 'crossplay';
      if (p === 'crossplay') {
        // In Crossplay mode, accept orders from PC players as well as players with user.crossplay === true
        return o.userPlatform === 'pc' || o.userCrossplay === true;
      }
      if (p === 'pc') {
        return o.userPlatform === 'pc';
      }
      if (p === 'playstation') {
        return o.userPlatform === 'ps4' || o.userPlatform === 'playstation';
      }
      if (p === 'xbox') {
        return o.userPlatform === 'xbox';
      }
      return true;
    }

    function applyItemMetrics(item) {
      if (!item.rawOrders) return;

      const isMod = item.type.includes('Augment');
      const excludeAtragraphs = STATE.excludeAtragraphs !== false;

      // Filter based on visibility, strict rank 0 / unranked, atragraph flag, and platform
      const validOrders = item.rawOrders.filter(o => {
        if (!o.visible) return false;

        // Strict Mod Rank 0 Enforcement (discard any mod orders where rank !== 0 or max rank)
        if (isMod) {
          if (o.rank !== 0) return false;
        } else {
          // Weapon Unranked Enforcement: weapons with affinity/rank cannot be traded
          if (o.rank !== 0 && o.rank !== undefined) return false;
        }

        // Atragraph collector cards exclusion
        if (excludeAtragraphs && o.isAtragraph) return false;

        // Platform / Crossplay filtering
        if (!orderMatchesPlatform(o)) return false;

        return true;
      });

      // 1. BUY ORDERS (Instant Buyout to liquidate standing)
      const buyOrders = validOrders.filter(o => o.orderType === 'buy');
      const ingameBuys = buyOrders.filter(o => o.userStatus === 'ingame');
      const onlineBuys = buyOrders.filter(o => o.userStatus === 'online');

      item.ingameBuyers = ingameBuys.length;
      item.onlineBuyers = onlineBuys.length;

      const activeBuys = (ingameBuys.length > 0) ? ingameBuys : onlineBuys;
      if (activeBuys.length > 0) {
        activeBuys.sort((a, b) => b.platinum - a.platinum);
        const chosenBuy = activeBuys[0];
        item.highestBuyPrice = chosenBuy.platinum;
        item.buyerName = chosenBuy.userName;
        item.buyerStatus = (ingameBuys.length > 0) ? 'ingame' : 'online';
        item.buyerQuantity = chosenBuy.quantity || 1;
        item.buyRatio = parseFloat(((chosenBuy.platinum / item.standing) * 1000).toFixed(2));

        item.totalBuyDemand = activeBuys.reduce((sum, o) => sum + (o.quantity || 1), 0);
        item.activeBuyOrdersCount = activeBuys.length;
        item.activeBuyOrders = activeBuys;
      } else {
        item.highestBuyPrice = null;
        item.buyerName = null;
        item.buyRatio = null;
        item.buyerStatus = 'offline';
        item.buyerQuantity = 0;
        item.totalBuyDemand = 0;
        item.activeBuyOrdersCount = 0;
        item.activeBuyOrders = [];
      }

      // 2. SELL ORDERS (Lowest market sell listing)
      const sellOrders = validOrders.filter(o => o.orderType === 'sell');
      const ingameSells = sellOrders.filter(o => o.userStatus === 'ingame');
      const onlineSells = sellOrders.filter(o => o.userStatus === 'online');

      item.ingameSellers = ingameSells.length;
      item.onlineSellers = onlineSells.length;

      const activeSells = (ingameSells.length > 0) ? ingameSells : onlineSells;
      if (activeSells.length > 0) {
        activeSells.sort((a, b) => a.platinum - b.platinum);
        const chosenSell = activeSells[0];
        item.lowestSellPrice = chosenSell.platinum;
        item.sellSeller = chosenSell.userName;
        item.sellStatus = (ingameSells.length > 0) ? 'ingame' : 'online';
        item.sellRatio = parseFloat(((chosenSell.platinum / item.standing) * 1000).toFixed(2));
      } else {
        item.lowestSellPrice = null;
        item.sellSeller = null;
        item.sellRatio = null;
        item.sellStatus = 'offline';
      }
    }

    function getQuickSaleMetrics(item, availableStanding) {
      if (!item || item.highestBuyPrice == null || !item.buyerName) {
        return null;
      }
      const affordable = item.standing > 0 ? Math.floor(availableStanding / item.standing) : 0;
      const buyerWants = item.buyerQuantity || 1;
      const totalDemand = item.totalBuyDemand || buyerWants;
      const activeCount = item.activeBuyOrdersCount || 1;

      if (affordable <= 0) {
        return {
          affordable: 0,
          buyerWants,
          totalDemand,
          activeCount,
          sellableToTopBuyer: 0,
          topBuyerPlat: 0,
          bookFilledUnits: 0,
          bookTotalPlat: 0,
          hasExcessAffordable: false
        };
      }

      // Sellable to top buyer (the one whispered)
      const sellableToTopBuyer = Math.min(affordable, buyerWants);
      const topBuyerPlat = sellableToTopBuyer * item.highestBuyPrice;

      // Order book simulation across all active buyers (ingame > online)
      let remaining = affordable;
      let bookFilledUnits = 0;
      let bookTotalPlat = 0;
      const activeOrders = item.activeBuyOrders || [];
      for (const o of activeOrders) {
        if (remaining <= 0) break;
        const q = o.quantity || 1;
        const take = Math.min(remaining, q);
        bookFilledUnits += take;
        bookTotalPlat += take * o.platinum;
        remaining -= take;
      }

      const hasExcessAffordable = affordable > buyerWants;

      return {
        affordable,
        buyerWants,
        totalDemand,
        activeCount,
        sellableToTopBuyer,
        topBuyerPlat,
        bookFilledUnits,
        bookTotalPlat,
        hasExcessAffordable
      };
    }

    function setPlatformFilter(platform) {
      STATE.platform = platform;
      STATE.settings.platform = platform;
      saveSettings();

      const sel = document.getElementById('select-platform');
      if (sel) sel.value = platform;
      const modalSel = document.getElementById('setting-platform');
      if (modalSel) modalSel.value = platform;

      const activeObj = getActiveDataset();
      if (activeObj.items && activeObj.items.length > 0) {
        activeObj.items.forEach(it => {
          if (it.rawOrders) applyItemMetrics(it);
        });
        renderCurrentView();
        updateSummaryMetrics();
      }

      showToast(`Platform filtered to ${platform === 'crossplay' ? 'Crossplay' : platform.toUpperCase()}`);
    }

    function setAvailableStanding(amount) {
      const val = Math.max(0, parseInt(amount, 10) || 0);
      STATE.availableStanding = val;
      STATE.settings.availableStanding = val;
      saveSettings();

      const inputEl = document.getElementById('input-available-standing');
      if (inputEl && parseInt(inputEl.value, 10) !== val) {
        inputEl.value = val;
      }

      document.querySelectorAll('#standing-preset-chips .preset-chip').forEach(chip => {
        const chipVal = parseInt(chip.dataset.standing, 10);
        chip.classList.toggle('active', chipVal === val);
      });

      renderCurrentView();
      updateSummaryMetrics();
    }

    function setAtragraphFilter(exclude) {
      STATE.excludeAtragraphs = !!exclude;
      STATE.settings.excludeAtragraphs = !!exclude;
      saveSettings();

      const toggle = document.getElementById('toggle-exclude-atragraphs');
      if (toggle) toggle.checked = STATE.excludeAtragraphs;

      const settingSelect = document.getElementById('setting-exclude-atragraphs');
      if (settingSelect) settingSelect.value = String(STATE.excludeAtragraphs);

      // Recompute metrics for active dataset items
      const activeObj = getActiveDataset();
      if (activeObj.items && activeObj.items.length > 0) {
        activeObj.items.forEach(it => {
          if (it.rawOrders) {
            applyItemMetrics(it);
          }
        });
        renderCurrentView();
        updateSummaryMetrics();
      }

      showToast(STATE.excludeAtragraphs ? 'Atragraph cards excluded (Regular only)' : 'Atragraph cards included');
    }

    function renderSalesCellHtml(item) {
      if (item.volume24h == null) {
        return `<span style="color: var(--text-dim)">&mdash;</span>`;
      }
      const v = item.volume24h;
      const tier = item.velocityTier || (v >= 10 ? 'high' : (v >= 4 ? 'med' : (v >= 1 ? 'low' : 'none')));
      const tierLabel = tier === 'high' ? 'High' : (tier === 'med' ? 'Moderate' : (tier === 'low' ? 'Low' : 'None'));

      const subParts = [];
      if (item.avgPrice24h != null) subParts.push(`avg ${item.avgPrice24h}p`);
      if (item.lastSoldAgo) subParts.push(item.lastSoldAgo);
      const subTextHtml = subParts.map(escapeHtml).join(' <span style="opacity: 0.6">&bull;</span> ');

      const isMod = item.type && item.type.includes('Augment');
      const modNote = (isMod && item.volume24hTotal > v) ? ` (${item.volume24hTotal} total incl. rank 3)` : '';
      const tooltip = `${v} sold in last 24h${modNote}.${item.avgPrice24h != null ? ` Avg price: ${item.avgPrice24h}p.` : ''}${item.lastSoldAgo ? ` Last transaction: ${item.lastSoldAgo}.` : ''} Liquidity tier: ${tierLabel}.`;

      return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.15rem;" title="${escapeAttr(tooltip)}">
          <span class="velocity-badge ${tier}">
            ${v > 0 ? `${v} sold` : '0 sold'}
          </span>
          ${subParts.length > 0 ? `<span class="velocity-subtext">${subTextHtml}</span>` : ''}
        </div>
      `;
    }

    /* ─── Live Incremental Table Row DOM Update ─── */
    function updateItemRow(syndicateId, slug) {
      if (STATE.viewMode === 'tiles') {
        renderTilesGrid();
        return;
      }

      const tbody = document.getElementById('table-body');
      if (!tbody) return;

      const row = document.getElementById(`row-${slug}`) || tbody.querySelector(`tr[data-slug="${slug}"]`);
      if (!row) {
        renderTable();
        return;
      }

      const list = STATE.syndicateItems[syndicateId] || STATE.planetItems[syndicateId];
      if (!list) return;
      const item = list.find(it => it.slug === slug);
      if (!item) return;

      const cells = row.querySelectorAll('td');
      if (cells.length < 8) {
        renderTable();
        return;
      }

      const platIcon = `<svg class="plat-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
      const dash = `<span style="color: var(--text-dim)">&mdash;</span>`;

      const avail = STATE.availableStanding || 0;
      const units = item.standing > 0 ? Math.floor(avail / item.standing) : 0;

      // Cell 1: Standing Cost & Affordability
      cells[1].innerHTML = `
        <div>${item.standing.toLocaleString()}</div>
        <div class="units-badge ${units > 0 ? 'affordable' : 'unaffordable'}">
          ${units > 0 ? `${units}x affordable` : '0 affordable'}
        </div>
      `;

      // Cell 2: Lowest Sell
      cells[2].innerHTML = item.lowestSellPrice != null
        ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem;">
             <span class="plat-val">${platIcon}${item.lowestSellPrice}</span>
             ${units > 0 ? `<span class="projected-plat sell" title="${units} units listed &times; ${item.lowestSellPrice}p = ${units * item.lowestSellPrice}p (market listing)">${units}x &rarr; <strong>${units * item.lowestSellPrice}p</strong></span>` : ''}
           </div>`
        : dash;

      // Cell 3: Plat / 1k Standing
      const sellRatioClass = (item.sellRatio >= 0.55) ? 'top-tier' : (item.sellRatio >= 0.45 ? 'mid-tier' : '');
      cells[3].innerHTML = item.sellRatio != null
        ? `<span class="ratio-badge ${sellRatioClass}">${item.sellRatio.toFixed(2)}</span>`
        : dash;

      // Cell 4: 24h Sales (New)
      cells[4].innerHTML = renderSalesCellHtml(item);

      // Cell 5: Instant Buyout
      if (item.highestBuyPrice != null) {
        const qs = getQuickSaleMetrics(item, avail);
        let buyoutSubHtml = '';
        if (qs && qs.affordable > 0) {
          const sUnits = qs.sellableToTopBuyer;
          const sPlat = qs.topBuyerPlat;

          if (qs.hasExcessAffordable) {
            const noteText = qs.totalDemand > qs.buyerWants
              ? `buyer wants ${qs.buyerWants} (${qs.totalDemand} in market)`
              : `buyer wants ${qs.buyerWants}`;
            const tipText = `You afford ${qs.affordable}x, but top buyer (${item.buyerName}) only wants ${qs.buyerWants}x. Instant yield: ${sUnits} &times; ${item.highestBuyPrice}p = ${sPlat}p.${qs.totalDemand > qs.buyerWants ? ` Market total: ${qs.bookFilledUnits}x across ${qs.activeCount} buyers for ${qs.bookTotalPlat}p.` : ''}`;

            buyoutSubHtml = `
              <div class="projected-plat buyout" title="${escapeAttr(tipText)}">
                <span>${sUnits}x &rarr; <strong>${sPlat}p</strong></span>
                <span class="buyer-demand-note limited">${escapeHtml(noteText)}</span>
              </div>
            `;
          } else {
            const tipText = `${sUnits} unit(s) &times; ${item.highestBuyPrice}p = ${sPlat}p (buyer wants ${qs.buyerWants})`;
            buyoutSubHtml = `
              <div class="projected-plat buyout" title="${escapeAttr(tipText)}">
                <span>${sUnits}x &rarr; <strong>${sPlat}p</strong></span>
                ${qs.buyerWants > 1 ? `<span class="buyer-demand-note">buyer wants ${qs.buyerWants}</span>` : ''}
              </div>
            `;
          }
        }

        cells[5].innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem;">
            <span class="plat-val" style="color: var(--cyan-primary)">${platIcon}${item.highestBuyPrice}</span>
            ${item.buyRatio != null ? `<span style="font-size: 0.7rem; color: var(--text-dim);">(${item.buyRatio.toFixed(2)} / 1k)</span>` : ''}
            ${buyoutSubHtml}
          </div>
        `;
      } else {
        cells[5].innerHTML = dash;
      }

      // Cell 6: Sellers / Live Orders
      const sellersTotal = (item.ingameSellers || 0) + (item.onlineSellers || 0);
      cells[6].innerHTML = (sellersTotal > 0)
        ? `<div class="orders-badge">
             <span class="seller-dot ${item.ingameSellers > 0 ? '' : 'offline'}"></span>
             <span>${item.ingameSellers} active (${item.onlineSellers} online)</span>
           </div>`
        : `<span style="color: var(--text-dim); font-size: 0.78rem;">0 active</span>`;

      // Cell 7: Actions (Whisper Instant Sell)
      if (item.highestBuyPrice != null && item.buyerName) {
        cells[7].innerHTML = `
          <div class="action-btn-wrap">
            <button class="btn-whisper" onclick="copyInstantSellWhisper('${escapeAttr(item.slug)}', this)" title="Instantly sell to ${escapeHtml(item.buyerName)} for ${item.highestBuyPrice} plat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
              <span>Whisper Instant Sell</span>
            </button>
          </div>
        `;
      } else {
        cells[7].innerHTML = `
          <div class="action-btn-wrap">
            <button class="btn-whisper disabled" disabled title="No active buyer online/in-game">
              <span>No active buyer</span>
            </button>
          </div>
        `;
      }
    }

    /* ─── Full Table Render (Sorting, Filtering & State Presentation) ─── */
    
    /* ─── Planet Selector Grid (Traders Tab) ─────────────────────────────────── */
    function getPlanetIconSvg(iconKey) {
      const key = (iconKey || '').toLowerCase();
      
      // Venus (Fortuna): Solaris United (Exact 3-pillar banner matching authentic faction crest)
      if (key === 'venus' || key === 'solaris' || key.includes('fortuna')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <polygon points="12,12 36,28 36,54 12,41" />
          <polygon points="12,47 36,60 36,65 12,52" />
          <polygon points="12,58 36,71 36,78 28,82 8,69 8,63 5,61 5,59 12,58" />
          <polygon points="43,30 50,36 57,30 57,74 50,80 43,74" />
          <polygon points="43,78 50,84 57,78 57,83 50,96 43,83" />
          <polygon points="88,12 64,28 64,59 88,46" />
          <polygon points="88,52 64,65 64,78 72,82 92,69 92,63 95,61 95,59 88,52" />
        </svg>`;
      }

      // Earth (Cetus): Ostron (Artisan Sun Crest of Cetus)
      if (key === 'earth' || key === 'ostron' || key.includes('cetus')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <circle cx="50" cy="50" r="10" />
          <circle cx="50" cy="50" r="17" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="8 4" />
          <path d="M 50,6 Q 54,20 50,30 Q 46,20 50,6 Z" />
          <path d="M 94,50 Q 80,54 70,50 Q 80,46 94,50 Z" />
          <path d="M 50,94 Q 46,80 50,70 Q 54,80 50,94 Z" />
          <path d="M 6,50 Q 20,46 30,50 Q 20,54 6,50 Z" />
          <path d="M 81,19 Q 71,32 64,36 Q 74,40 81,19 Z" />
          <path d="M 81,81 Q 68,71 64,64 Q 60,74 81,81 Z" />
          <path d="M 19,81 Q 29,68 36,64 Q 26,60 19,81 Z" />
          <path d="M 19,19 Q 32,29 36,36 Q 40,26 19,19 Z" />
        </svg>`;
      }

      // Deimos (Necralisk): Entrati (Orokin Royal Sceptre & Lotus Crown)
      if (key === 'deimos' || key === 'entrati' || key.includes('necralisk')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <polygon points="50,6 54,24 50,28 46,24" />
          <polygon points="50,32 53,50 50,68 47,50" />
          <polygon points="50,72 54,92 50,96 46,92" />
          <polygon points="50,40 60,50 50,60 40,50" />
          <path d="M 46,20 C 34,14 26,24 30,36 C 34,28 42,26 46,20 Z" />
          <path d="M 54,20 C 66,14 74,24 70,36 C 66,28 58,26 54,20 Z" />
          <path d="M 40,48 C 22,42 14,56 18,74 C 24,76 32,70 34,62 C 26,66 22,54 36,52 Z" />
          <path d="M 60,48 C 78,42 86,56 82,74 C 76,76 68,70 66,62 C 74,66 78,54 64,52 Z" />
        </svg>`;
      }

      // Zariman (Chrysalith): The Holdfasts (Void-Angel Winged Spearhead)
      if (key === 'zariman' || key === 'holdfasts' || key.includes('chrysalith')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <polygon points="50,8 57,28 50,24 43,28" />
          <polygon points="50,30 56,58 50,84 44,58" />
          <polygon points="46,24 16,74 27,74 45,36" />
          <polygon points="21,79 12,79 33,44 38,44" />
          <polygon points="54,24 84,74 73,74 55,36" />
          <polygon points="79,79 88,79 67,44 62,44" />
          <polygon points="50,88 56,94 50,91 44,94" />
        </svg>`;
      }

      // Sanctum Anatomica: Cavia (Orokin Eye & Animal Mind Halo)
      if (key === 'cavia' || key.includes('sanctum')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <path d="M 10,50 C 26,28 74,28 90,50 C 74,72 26,72 10,50 Z M 16,50 C 30,66 70,66 84,50 C 70,34 30,34 16,50 Z" />
          <circle cx="50" cy="50" r="12" />
          <ellipse cx="50" cy="50" rx="6" ry="2.5" fill="#0d121c" />
          <path d="M 32,22 C 34,14 42,10 46,8 C 44,14 40,20 38,24 Z" />
          <path d="M 50,6 L 52,18 L 48,18 Z" />
          <path d="M 68,22 C 66,14 58,10 54,8 C 56,14 60,20 62,24 Z" />
          <path d="M 28,78 C 42,88 58,88 72,78 C 58,83 42,83 28,78 Z" />
        </svg>`;
      }

      // Höllvania (1999): The Hex (Cybernetic 1999 Hex Monolith)
      if (key === 'hex' || key.includes('hollvania') || key.includes('1999')) {
        return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
          <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round" />
          <polygon points="28,26 38,26 38,74 28,74" />
          <polygon points="62,26 72,26 72,74 62,74" />
          <polygon points="38,44 62,44 62,49 46,49 43,56 38,56" />
          <polygon points="44,51 62,51 62,56 54,56 51,51" />
          <polygon points="50,33 54,38 50,43 46,38" />
        </svg>`;
      }

      // Default fallback: The Hex
      return `<svg viewBox="0 0 100 100" width="34" height="34" fill="currentColor">
        <polygon points="50,8 88,29 88,71 50,92 12,71 12,29" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round" />
        <polygon points="28,26 38,26 38,74 28,74" />
        <polygon points="62,26 72,26 72,74 62,74" />
        <polygon points="38,44 62,44 62,49 46,49 43,56 38,56" />
        <polygon points="44,51 62,51 62,56 54,56 51,51" />
        <polygon points="50,33 54,38 50,43 46,38" />
      </svg>`;
    }

    function initPlanetSelector() {
      const container = document.getElementById('planet-selector');
      if (!container) return;
      container.innerHTML = '';

      Object.values(TRADERS_DATA).forEach(planet => {
        const card = document.createElement('div');
        card.className = `planet-card ${planet.id === STATE.currentPlanet ? 'active' : ''}`;
        card.dataset.planetId = planet.id;
        card.style.setProperty('--planet-color', planet.color);
        card.style.setProperty('--planet-glow', `${planet.color}35`);

        const iconSvg = getPlanetIconSvg(planet.icon || planet.id);
        const tradersList = planet.traders ? planet.traders.join(' • ') : '';
        const logoSrc = planet.logo || `assets/trader_${planet.id}.webp`;

        card.innerHTML = `
          <div class="planet-icon-wrap" title="${escapeAttr(planet.faction || planet.name)}">
            <img class="planet-logo-img" src="${logoSrc}" alt="${escapeAttr(planet.faction || planet.name)}" loading="lazy" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" />
            <div class="planet-icon-svg" style="display: none;">${iconSvg}</div>
          </div>
          <div class="planet-title">${escapeHtml(planet.name)}</div>
          <div class="planet-hub">${escapeHtml(planet.hub)}</div>
          <div class="planet-count">${planet.items.length} tradeable offerings</div>
          ${tradersList ? `<div class="planet-traders-tag">${escapeHtml(tradersList)}</div>` : ''}
        `;

        card.addEventListener('click', () => selectPlanet(planet.id));
        container.appendChild(card);
      });
    }

    /* ─── Switch Top-Bar Navigation Tab (Syndicates vs Traders) ──────────────── */
    function switchTab(tab) {
      if (STATE.activeTab === tab) return;

      // Cancel any current scan in progress
      STATE.scanSessionId++;
      STATE.scanInProgress = false;
      STATE.activeTab = tab;
      STATE.activeFilter = 'all';
      STATE.searchQuery = '';

      // Clear search input
      const sInput = document.getElementById('search-input');
      if (sInput) sInput.value = '';

      // Update Nav Buttons
      document.getElementById('tab-btn-syndicates').classList.toggle('active', tab === 'syndicates');
      document.getElementById('tab-btn-traders').classList.toggle('active', tab === 'traders');

      // Toggle Sections
      const synSection = document.getElementById('syndicates-section');
      const traderSection = document.getElementById('traders-section');
      if (synSection) synSection.style.display = (tab === 'syndicates') ? 'block' : 'none';
      if (traderSection) {
        traderSection.style.display = (tab === 'traders') ? 'block' : 'none';
        const pSel = document.getElementById('planet-selector');
        if (pSel && !pSel.hasChildNodes()) {
          initPlanetSelector();
        }
      }

      hideErrorBanner();
      updateProgressBar(0, 1);
      setStatus('Ready', false);

      const activeObj = getActiveDataset();
      const emptyPanel = document.getElementById('empty-state-panel');
      const dash = document.getElementById('dashboard-content');
      const refreshBtn = document.getElementById('btn-force-refresh');

      if (!activeObj.id || !activeObj.items || activeObj.items.length === 0) {
        if (emptyPanel) {
          emptyPanel.style.display = 'block';
          const titleEl = emptyPanel.querySelector('.empty-state-title');
          const descEl = emptyPanel.querySelector('.empty-state-desc');
          if (titleEl) {
            titleEl.textContent = tab === 'traders'
              ? 'Select an open world planet or hub to scan trader market data'
              : 'Select a syndicate to scan market data';
          }
          if (descEl) {
            descEl.textContent = tab === 'traders'
              ? 'Click any of the six locations above (Plains of Eidolon, Orb Vallis, Necralisk, Zariman, Cavia, or 1999) to query real-time Warframe Market listings for verified tradeable items.'
              : 'Click any of the six factions above to query real-time Warframe Market listings, standing-to-platinum efficiency ratios, and instant buyouts.';
          }
        }
        if (dash) dash.classList.remove('visible');
        if (refreshBtn) refreshBtn.style.display = 'none';
      } else {
        if (emptyPanel) emptyPanel.style.display = 'none';
        if (dash) dash.classList.add('visible');
        if (refreshBtn) refreshBtn.style.display = 'inline-flex';

        if (activeObj.meta) {
          document.documentElement.style.setProperty('--syn-active-color', activeObj.meta.color);
          document.documentElement.style.setProperty('--syn-active-glow', `${activeObj.meta.color}40`);
        }

        updateTypeFilterChips();
        renderCurrentView();
        updateSummaryMetrics();
      }
    }

    /* ─── Select Planet (On-Demand Loading & Scanning) ────────────────────────── */
    function selectPlanet(planetId) {
      if (STATE.currentPlanet === planetId && STATE.planetItems[planetId] && !STATE.scanInProgress) {
        return;
      }

      // 1. Cancel any in-progress queue
      STATE.scanSessionId++;
      STATE.scanInProgress = false;
      STATE.currentPlanet = planetId;

      // 2. Clear error banner & reset status indicators
      hideErrorBanner();
      updateProgressBar(0, 1);
      setStatus('Ready', false);

      // 3. Update Card Active Classes
      document.querySelectorAll('.planet-card').forEach(c => {
        c.classList.toggle('active', c.dataset.planetId === planetId);
      });

      // 4. Reveal Dashboard, Hide Initial Empty State
      const emptyPanel = document.getElementById('empty-state-panel');
      if (emptyPanel) emptyPanel.style.display = 'none';
      const dash = document.getElementById('dashboard-content');
      if (dash) dash.classList.add('visible');
      const refreshBtn = document.getElementById('btn-force-refresh');
      if (refreshBtn) refreshBtn.style.display = 'inline-flex';

      // 5. Update Theme Accent Colors
      const currentPlanetMeta = TRADERS_DATA[planetId];
      if (currentPlanetMeta) {
        document.documentElement.style.setProperty('--syn-active-color', currentPlanetMeta.color);
        document.documentElement.style.setProperty('--syn-active-glow', `${currentPlanetMeta.color}40`);
      }

      updateTypeFilterChips();

      // 6. Check Cache
      const cached = getCachedData(planetId);
      if (cached) {
        STATE.planetItems[planetId] = cached.items;
        STATE.planetItems[planetId].forEach(it => {
          if (it.rawOrders) applyItemMetrics(it);
        });
        renderCurrentView();
        updateSummaryMetrics();
        startCountdownTimer(cached.timestamp);
        setStatus(`Using cached data from ${formatTimeAgo(cached.timestamp)}`, false);
        setApiBadge('Cached', false);
        return;
      }

      // 7. Reset and initialize item list in pending state
      STATE.planetItems[planetId] = currentPlanetMeta.items.map(it => ({
        ...it,
        lowestSellPrice: null,
        sellRatio: null,
        sellSeller: null,
        sellStatus: 'offline',
        ingameSellers: 0,
        onlineSellers: 0,
        highestBuyPrice: null,
        buyRatio: null,
        buyerName: null,
        buyerStatus: 'offline',
        ingameBuyers: 0,
        onlineBuyers: 0,
        rawOrders: [],
        updatedAt: null,
        _scanned: false,
        _loading: true
      }));

      // Render rows immediately so user sees items right away while scan runs
      renderCurrentView();
      updateSummaryMetrics();

      // Launch sequential throttled scan
      startScan(planetId);
    }

    /* ─── Update Toolbar Filter Chips ───────────────────────────────────────── */
    function updateTypeFilterChips() {
      const container = document.getElementById('type-filters');
      if (!container) return;

      if (STATE.activeTab === 'traders') {
        const planetMeta = TRADERS_DATA[STATE.currentPlanet];
        const items = STATE.planetItems[STATE.currentPlanet] || (planetMeta ? planetMeta.items : []);
        const traders = planetMeta && planetMeta.traders ? planetMeta.traders : [];

        let chipsHtml = `<button class="pill-btn ${STATE.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All (<span id="count-all">${items.length}</span>)</button>`;
        traders.forEach(tr => {
          const count = items.filter(i => i.trader === tr).length;
          const isActive = STATE.activeFilter === tr;
          chipsHtml += `<button class="pill-btn ${isActive ? 'active' : ''}" data-filter="${escapeAttr(tr)}">${escapeHtml(tr)} (<span>${count}</span>)</button>`;
        });
        container.innerHTML = chipsHtml;
      } else {
        const items = (STATE.currentSyndicate && STATE.syndicateItems[STATE.currentSyndicate]) || [];
        const countWf = items.filter(i => i.type === 'Warframe Augment').length;
        const countWpAug = items.filter(i => i.type === 'Weapon Augment').length;
        const countWp = items.filter(i => i.type === 'Syndicate Weapon').length;

        container.innerHTML = `
          <button class="pill-btn ${STATE.activeFilter === 'all' ? 'active' : ''}" data-filter="all">All (<span id="count-all">${items.length}</span>)</button>
          <button class="pill-btn ${STATE.activeFilter === 'warframe-aug' ? 'active' : ''}" data-filter="warframe-aug">Warframe Augments (<span id="count-warframe-augs">${countWf}</span>)</button>
          <button class="pill-btn ${STATE.activeFilter === 'weapon-aug' ? 'active' : ''}" data-filter="weapon-aug">Weapon Augments (<span id="count-weapon-augs">${countWpAug}</span>)</button>
          <button class="pill-btn ${STATE.activeFilter === 'weapon' ? 'active' : ''}" data-filter="weapon">Weapons (<span id="count-weapons">${countWp}</span>)</button>
        `;
      }

      // Re-bind click events on pill buttons
      container.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          STATE.activeFilter = btn.dataset.filter;
          renderCurrentView();
        });
      });
    }

    /* ─── View Mode Switcher (Tiles vs Lines) ─────────────────────────────────── */
    function setViewMode(mode) {
      STATE.viewMode = mode;
      STATE.settings.viewMode = mode;
      saveSettings();

      const btnTiles = document.getElementById('view-btn-tiles');
      const btnLines = document.getElementById('view-btn-lines');
      if (btnTiles) btnTiles.classList.toggle('active', mode === 'tiles');
      if (btnLines) btnLines.classList.toggle('active', mode === 'lines');

      renderCurrentView();
    }

    function renderCurrentView() {
      const tilesContainer = document.getElementById('tiles-grid');
      const tableContainer = document.getElementById('table-container');

      if (STATE.viewMode === 'tiles') {
        if (tilesContainer) tilesContainer.style.display = 'grid';
        if (tableContainer) tableContainer.style.display = 'none';
        renderTilesGrid();
      } else {
        if (tilesContainer) tilesContainer.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'block';
        renderTable();
      }
    }

    /* ─── Render Tiles Grid (Card Visibility with Small Images & 24h Sales) ─── */
    function renderTilesGrid() {
      const container = document.getElementById('tiles-grid');
      if (!container) return;

      const active = getActiveDataset();
      const items = active.items;

      if (!items || items.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-dim);">No items loaded.</div>`;
        return;
      }

      // Filter items
      let filtered = items.filter(it => {
        if (STATE.activeTab === 'traders') {
          if (STATE.activeFilter !== 'all' && it.trader !== STATE.activeFilter) return false;
        } else {
          if (STATE.activeFilter === 'warframe-aug' && it.type !== 'Warframe Augment') return false;
          if (STATE.activeFilter === 'weapon-aug' && it.type !== 'Weapon Augment') return false;
          if (STATE.activeFilter === 'weapon' && it.type !== 'Syndicate Weapon') return false;
        }

        if (STATE.searchQuery) {
          const q = STATE.searchQuery.toLowerCase();
          const matchName = it.name.toLowerCase().includes(q);
          const matchWf = it.warframe && it.warframe.toLowerCase().includes(q);
          const matchType = it.type && it.type.toLowerCase().includes(q);
          const matchTrader = it.trader && it.trader.toLowerCase().includes(q);
          if (!matchName && !matchWf && !matchType && !matchTrader) return false;
        }
        return true;
      });

      // Sort items
      filtered.sort((a, b) => {
        if (STATE.sortColumn === 'name') {
          return STATE.sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        let valA, valB;
        if (STATE.sortColumn === 'standing') {
          valA = a.standing || 0;
          valB = b.standing || 0;
        } else if (STATE.sortColumn === 'sellPrice') {
          valA = a.lowestSellPrice;
          valB = b.lowestSellPrice;
        } else if (STATE.sortColumn === 'sellRatio') {
          valA = a.sellRatio;
          valB = b.sellRatio;
        } else if (STATE.sortColumn === 'buyPrice') {
          valA = a.highestBuyPrice;
          valB = b.highestBuyPrice;
        } else if (STATE.sortColumn === 'sales24h') {
          valA = a.volume24h != null ? a.volume24h : -1;
          valB = b.volume24h != null ? b.volume24h : -1;
        } else if (STATE.sortColumn === 'sellers') {
          valA = (a.ingameSellers || 0) + (a.onlineSellers || 0);
          valB = (b.ingameSellers || 0) + (b.onlineSellers || 0);
        } else {
          valA = a[STATE.sortColumn];
          valB = b[STATE.sortColumn];
        }

        if (valA == null && valB == null) return a.name.localeCompare(b.name);
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA === valB) return a.name.localeCompare(b.name);
        return STATE.sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });

      if (filtered.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-dim);">No items match your search or filter criteria.</div>`;
        return;
      }

      const platIcon = `<svg class="plat-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
      const avail = STATE.availableStanding || 0;

      container.innerHTML = filtered.map(item => {
        const units = (item.standing > 0 && avail > 0) ? Math.floor(avail / item.standing) : 0;
        const lowestSellHtml = item.lowestSellPrice != null
          ? `<span class="tile-price-val sell">${platIcon}${item.lowestSellPrice}p</span>`
          : `<span style="color: var(--text-dim)">—</span>`;

        const buyHtml = item.highestBuyPrice != null
          ? `<span class="tile-price-val buy">${platIcon}${item.highestBuyPrice}p</span>`
          : `<span style="color: var(--text-dim)">—</span>`;

        // 24h sales velocity
        let velBadgeClass = 'none';
        let velText = '0 sold / 24h';
        const v = item.volume24h || 0;
        if (v >= 10) { velBadgeClass = 'high'; velText = `${v} sold (High Vol)`; }
        else if (v >= 4) { velBadgeClass = 'med'; velText = `${v} sold (Moderate)`; }
        else if (v >= 1) { velBadgeClass = 'low'; velText = `${v} sold (Low Vol)`; }

        const actionBtn = (item.highestBuyPrice != null && item.buyerName)
          ? `<button class="btn-whisper" onclick="copyInstantSellWhisper('${escapeAttr(item.slug)}', this)" title="Instantly sell to ${escapeHtml(item.buyerName)} for ${item.highestBuyPrice}p">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
               <span>Whisper Instant Sell</span>
             </button>`
          : `<button class="btn-whisper disabled" disabled><span>No active buyer</span></button>`;

        const subTag = item.trader ? item.trader : (item.warframe ? `[${item.warframe}] Mod` : item.type);

        return `
          <div class="item-tile-card" id="tile-${escapeAttr(item.slug)}" data-slug="${escapeAttr(item.slug)}">
            <div class="tile-header-wrap">
              <div class="tile-thumb-box" data-slug="${escapeAttr(item.slug)}" title="Click to enlarge image">
                <img class="tile-thumb-img" src="assets/${escapeAttr(item.slug)}.png" onerror="this.onerror=null;this.src='/api/image/${escapeAttr(item.slug)}';" alt="${escapeAttr(item.name)}" loading="lazy" />
              </div>
              <div class="tile-meta">
                <div class="tile-title" title="${escapeAttr(item.name)}">${escapeHtml(item.name)}</div>
                <div class="tile-badges">
                  <span class="tile-badge trader">${escapeHtml(subTag)}</span>
                  <span class="tile-badge standing">${item.standing.toLocaleString()} pts</span>
                  ${units > 0 ? `<span class="tile-badge" style="background: rgba(16,185,129,0.15); color: #10b981; border-color: rgba(16,185,129,0.3);">${units}x affordable</span>` : ''}
                </div>
              </div>
            </div>

            <div class="tile-prices-grid">
              <div class="tile-price-col">
                <span class="tile-price-label">Lowest Sell</span>
                ${lowestSellHtml}
                ${units > 0 && item.lowestSellPrice != null ? `<span class="tile-price-sub">${units}x → ${units * item.lowestSellPrice}p</span>` : ''}
              </div>
              <div class="tile-price-col">
                <span class="tile-price-label">Instant Buyout</span>
                ${buyHtml}
                ${item.buyerQuantity > 1 ? `<span class="tile-price-sub">wants ${item.buyerQuantity}x</span>` : ''}
              </div>
            </div>

            <div class="tile-velocity-bar">
              <span class="velocity-badge ${velBadgeClass}">${velText}</span>
              ${item.lastSoldAgo ? `<span style="color: var(--text-dim); font-size: 0.7rem;">Last: ${item.lastSoldAgo}</span>` : ''}
            </div>

            <div class="tile-action-wrap">
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');
    }

    function renderTable() {
      const active = getActiveDataset();
      const items = active.items || [];
      const tbody = document.getElementById('table-body');
      if (!tbody) return;

      // Filter items
      let filtered = items.filter(it => {
        if (STATE.activeTab === 'traders') {
          if (STATE.activeFilter !== 'all' && it.trader !== STATE.activeFilter) return false;
        } else {
          if (STATE.activeFilter === 'warframe-aug' && it.type !== 'Warframe Augment') return false;
          if (STATE.activeFilter === 'weapon-aug' && it.type !== 'Weapon Augment') return false;
          if (STATE.activeFilter === 'weapon' && it.type !== 'Syndicate Weapon') return false;
        }
        if (STATE.searchQuery) {
          const q = STATE.searchQuery.toLowerCase();
          const matchName = it.name.toLowerCase().includes(q);
          const matchWf = it.warframe && it.warframe.toLowerCase().includes(q);
          const matchType = it.type && it.type.toLowerCase().includes(q);
          const matchTrader = it.trader && it.trader.toLowerCase().includes(q);
          if (!matchName && !matchWf && !matchType && !matchTrader) return false;
        }
        return true;
      });

      // Update Counts safely
      const elAll = document.getElementById('count-all');
      if (elAll) elAll.textContent = items.length;
      const elWf = document.getElementById('count-warframe-augs');
      if (elWf) elWf.textContent = items.filter(i => i.type === 'Warframe Augment').length;
      const elWpAug = document.getElementById('count-weapon-augs');
      if (elWpAug) elWpAug.textContent = items.filter(i => i.type === 'Weapon Augment').length;
      const elWp = document.getElementById('count-weapons');
      if (elWp) elWp.textContent = items.filter(i => i.type === 'Syndicate Weapon').length;

      // Sort items
      filtered.sort((a, b) => {
        if (STATE.sortColumn === 'name') {
          return STATE.sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }

        let valA, valB;
        if (STATE.sortColumn === 'standing') {
          valA = a.standing || 0;
          valB = b.standing || 0;
        } else if (STATE.sortColumn === 'sellPrice') {
          valA = a.lowestSellPrice;
          valB = b.lowestSellPrice;
        } else if (STATE.sortColumn === 'sellRatio') {
          valA = a.sellRatio;
          valB = b.sellRatio;
        } else if (STATE.sortColumn === 'buyPrice') {
          valA = a.highestBuyPrice;
          valB = b.highestBuyPrice;
        } else if (STATE.sortColumn === 'sales24h') {
          valA = a.volume24h != null ? a.volume24h : -1;
          valB = b.volume24h != null ? b.volume24h : -1;
        } else if (STATE.sortColumn === 'sellers') {
          valA = (a.ingameSellers || 0) + (a.onlineSellers || 0);
          valB = (b.ingameSellers || 0) + (b.onlineSellers || 0);
        } else {
          valA = a[STATE.sortColumn];
          valB = b[STATE.sortColumn];
        }

        // Nulls sort to bottom
        if (valA == null && valB == null) return a.name.localeCompare(b.name);
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (valA === valB) {
          if (STATE.sortColumn === 'sales24h' && a.volume24hTotal !== b.volume24hTotal) {
            return (b.volume24hTotal || 0) - (a.volume24hTotal || 0);
          }
          if (STATE.sortColumn === 'buyPrice' && a.buyRatio !== b.buyRatio && a.buyRatio != null && b.buyRatio != null) {
            return b.buyRatio - a.buyRatio;
          }
          return a.name.localeCompare(b.name);
        }
        return STATE.sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
              No items match your search or filter criteria.
            </td>
          </tr>
        `;
        return;
      }

      const platIcon = `<svg class="plat-icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
      const dash = `<span style="color: var(--text-dim)">&mdash;</span>`;

      tbody.innerHTML = filtered.map(item => {
        let subBadgeClass = 'warframe';
        let subText = item.warframe ? `[${item.warframe}] Warframe Mod` : (item.type || 'Offer');
        if (item.type === 'Weapon Augment') {
          subBadgeClass = 'weapon-mod';
          subText = item.warframe ? `[${item.warframe}] Weapon Mod` : 'Weapon Mod';
        } else if (item.type === 'Syndicate Weapon') {
          subBadgeClass = 'syndicate-weapon';
          subText = 'Syndicate Weapon';
        } else if (item.trader) {
          subBadgeClass = 'trader';
          subText = `[${item.trader}] ${item.type || 'Item'}`;
        }

        const sellRatioClass = (item.sellRatio >= 0.55) ? 'top-tier' : (item.sellRatio >= 0.45 ? 'mid-tier' : '');
        const avail = STATE.availableStanding || 0;
        const units = item.standing > 0 ? Math.floor(avail / item.standing) : 0;

        const lowestCell = item.lowestSellPrice != null
          ? `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem;">
               <span class="plat-val">${platIcon}${item.lowestSellPrice}</span>
               ${units > 0 ? `<span class="projected-plat sell" title="${units} units listed &times; ${item.lowestSellPrice}p = ${units * item.lowestSellPrice}p (market listing)">${units}x &rarr; <strong>${units * item.lowestSellPrice}p</strong></span>` : ''}
             </div>`
          : dash;

        const sellRatioCell = item.sellRatio != null
          ? `<span class="ratio-badge ${sellRatioClass}">${item.sellRatio.toFixed(2)}</span>`
          : dash;

        const salesCell = renderSalesCellHtml(item);

        let buyoutCell = dash;
        if (item.highestBuyPrice != null) {
          const qs = getQuickSaleMetrics(item, avail);
          let buyoutSubHtml = '';
          if (qs && qs.affordable > 0) {
            const sUnits = qs.sellableToTopBuyer;
            const sPlat = qs.topBuyerPlat;

            if (qs.hasExcessAffordable) {
              const noteText = qs.totalDemand > qs.buyerWants
                ? `buyer wants ${qs.buyerWants} (${qs.totalDemand} in market)`
                : `buyer wants ${qs.buyerWants}`;
              const tipText = `You afford ${qs.affordable}x, but top buyer (${item.buyerName}) only wants ${qs.buyerWants}x. Instant yield: ${sUnits} &times; ${item.highestBuyPrice}p = ${sPlat}p.${qs.totalDemand > qs.buyerWants ? ` Market total: ${qs.bookFilledUnits}x across ${qs.activeCount} buyers for ${qs.bookTotalPlat}p.` : ''}`;

              buyoutSubHtml = `
                <div class="projected-plat buyout" title="${escapeAttr(tipText)}">
                  <span>${sUnits}x &rarr; <strong>${sPlat}p</strong></span>
                  <span class="buyer-demand-note limited">${escapeHtml(noteText)}</span>
                </div>
              `;
            } else {
              const tipText = `${sUnits} unit(s) &times; ${item.highestBuyPrice}p = ${sPlat}p (buyer wants ${qs.buyerWants})`;
              buyoutSubHtml = `
                <div class="projected-plat buyout" title="${escapeAttr(tipText)}">
                  <span>${sUnits}x &rarr; <strong>${sPlat}p</strong></span>
                  ${qs.buyerWants > 1 ? `<span class="buyer-demand-note">buyer wants ${qs.buyerWants}</span>` : ''}
                </div>
              `;
            }
          }

          buyoutCell = `
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem;">
              <span class="plat-val" style="color: var(--cyan-primary)">${platIcon}${item.highestBuyPrice}</span>
              ${item.buyRatio != null ? `<span style="font-size: 0.7rem; color: var(--text-dim);">(${item.buyRatio.toFixed(2)} / 1k)</span>` : ''}
              ${buyoutSubHtml}
            </div>
          `;
        }

        const sellersTotal = (item.ingameSellers || 0) + (item.onlineSellers || 0);
        const sellersCell = (sellersTotal > 0)
          ? `<div class="orders-badge">
               <span class="seller-dot ${item.ingameSellers > 0 ? '' : 'offline'}"></span>
               <span>${item.ingameSellers} active (${item.onlineSellers} online)</span>
             </div>`
          : `<span style="color: var(--text-dim); font-size: 0.78rem;">0 active</span>`;

        const actionCell = (item.highestBuyPrice != null && item.buyerName)
          ? `<button class="btn-whisper" onclick="copyInstantSellWhisper('${escapeAttr(item.slug)}', this)" title="Instantly sell to ${escapeHtml(item.buyerName)} for ${item.highestBuyPrice} plat">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
               <span>Whisper Instant Sell</span>
             </button>`
          : `<button class="btn-whisper disabled" disabled title="No active buyer online/in-game">
               <span>No active buyer</span>
             </button>`;

        return `
          <tr id="row-${escapeAttr(item.slug)}" data-slug="${escapeAttr(item.slug)}">
            <td>
              <div class="item-cell-wrap" style="flex-direction: row; align-items: center; gap: 0.6rem;">
                <div class="table-thumb-box" data-slug="${escapeAttr(item.slug)}" title="Click to enlarge image">
                  <img class="table-item-thumb" src="assets/${escapeAttr(item.slug)}.png" onerror="this.onerror=null;this.src='/api/image/${escapeAttr(item.slug)}';" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:4px;background:rgba(255,255,255,0.03);flex-shrink:0;cursor:zoom-in;" />
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.15rem; min-width: 0;">
                  <span class="item-title-text">${escapeHtml(item.name)}</span>
                  <div class="item-subtag">
                    <span class="sub-badge ${subBadgeClass}">${escapeHtml(subText)}</span>
                  </div>
                </div>
              </div>
            </td>
            <td class="mono-cell align-center">
              <div>${item.standing.toLocaleString()}</div>
              <div class="units-badge ${units > 0 ? 'affordable' : 'unaffordable'}">
                ${units > 0 ? `${units}x affordable` : '0 affordable'}
              </div>
            </td>
            <td class="mono-cell align-right">
              ${lowestCell}
            </td>
            <td class="align-right">
              ${sellRatioCell}
            </td>
            <td class="align-center">
              ${salesCell}
            </td>
            <td class="mono-cell align-right">
              ${buyoutCell}
            </td>
            <td class="align-center">
              ${sellersCell}
            </td>
            <td class="align-right">
              <div class="action-btn-wrap">
                ${actionCell}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    /* ─── Summary Metric Cards (Dynamic Leaders & Real Stats) ─── */
    function updateSummaryMetrics() {
      const active = getActiveDataset();
      const items = active.items || [];
      if (!items.length) return;

      // 1. Top Instant Cashout: (highest_buy_price / standing_cost) * 1000
      const withBuy = items.filter(it => it.buyRatio != null && it.highestBuyPrice != null);
      if (withBuy.length > 0) {
        withBuy.sort((a, b) => b.buyRatio - a.buyRatio);
        const topBuy = withBuy[0];
        document.getElementById('metric-top-buy-ratio').textContent = topBuy.buyRatio.toFixed(2);

        const avail = STATE.availableStanding || 0;
        const qs = getQuickSaleMetrics(topBuy, avail);

        if (avail > 0 && qs && qs.affordable > 0) {
          if (qs.hasExcessAffordable) {
            document.getElementById('metric-top-buy-name').textContent =
              `${topBuy.name} \u2022 ${qs.topBuyerPlat}p (${qs.sellableToTopBuyer}x @ ${topBuy.highestBuyPrice}p \u2022 buyer wants ${qs.buyerWants})`;
          } else {
            document.getElementById('metric-top-buy-name').textContent =
              `${topBuy.name} \u2022 ${qs.topBuyerPlat}p total (${qs.sellableToTopBuyer}x @ ${topBuy.highestBuyPrice}p)`;
          }
        } else if (avail > 0 && qs && qs.affordable === 0) {
          document.getElementById('metric-top-buy-name').textContent =
            `${topBuy.name} (${topBuy.highestBuyPrice}p) \u2022 Need ${(topBuy.standing - avail).toLocaleString()} more standing`;
        } else {
          document.getElementById('metric-top-buy-name').textContent =
            `${topBuy.name} (${topBuy.highestBuyPrice}p \u2022 buyer wants ${topBuy.buyerQuantity || 1})`;
        }
      } else {
        document.getElementById('metric-top-buy-ratio').textContent = '--';
        document.getElementById('metric-top-buy-name').textContent = STATE.scanInProgress ? 'Scanning buyers...' : 'No instant buyers found';
      }

      // 2. Top Listing Deal: (lowest_sell_price / standing_cost) * 1000
      const withSell = items.filter(it => it.sellRatio != null && it.lowestSellPrice != null);
      if (withSell.length > 0) {
        withSell.sort((a, b) => b.sellRatio - a.sellRatio);
        const topSell = withSell[0];
        document.getElementById('metric-top-sell-ratio').textContent = topSell.sellRatio.toFixed(2);

        const avail = STATE.availableStanding || 0;
        const topSellUnits = topSell.standing > 0 ? Math.floor(avail / topSell.standing) : 0;
        const topSellTotalPlat = topSellUnits * topSell.lowestSellPrice;

        if (avail > 0 && topSellUnits > 0) {
          document.getElementById('metric-top-sell-name').textContent = `${topSell.name} \u2022 ${topSellTotalPlat}p total (${topSellUnits}x @ ${topSell.lowestSellPrice}p)`;
        } else {
          document.getElementById('metric-top-sell-name').textContent = `${topSell.name} (${topSell.lowestSellPrice}p)`;
        }
      } else {
        document.getElementById('metric-top-sell-ratio').textContent = '--';
        document.getElementById('metric-top-sell-name').textContent = STATE.scanInProgress ? 'Scanning offers...' : 'No listings found';
      }

      // 3. Syndicate Avg Efficiency: Real mathematical mean of all valid item ratios
      if (withSell.length > 0) {
        const sum = withSell.reduce((acc, it) => acc + it.sellRatio, 0);
        const avg = sum / withSell.length;
        document.getElementById('metric-avg-ratio').textContent = avg.toFixed(2);
      } else {
        document.getElementById('metric-avg-ratio').textContent = '--';
      }

      // 4. Active Sellers Found & Syndicate Sales Volume
      const totalSellers = items.reduce((acc, it) => acc + (it.ingameSellers || 0) + (it.onlineSellers || 0), 0);
      const totalVolume24h = items.reduce((acc, it) => acc + (it.volume24h || 0), 0);
      document.getElementById('metric-sellers-count').textContent = totalSellers.toLocaleString();
      const sellersSub = document.getElementById('metric-sellers-sub');
      if (sellersSub) {
        sellersSub.textContent = totalVolume24h > 0
          ? `${totalVolume24h} sold in 24h`
          : 'In-game & online traders';
      }
    }

    /* ─── Whisper Instant Sell Clipboard Handler ─── */
    window.copyInstantSellWhisper = function(slugOrBuyer, btnOrItemName, maybePrice, maybeBtn) {
      let buyerName = slugOrBuyer;
      let itemName = btnOrItemName;
      let price = maybePrice;
      let btnEl = maybeBtn;

      // Handle (slug, btnEl) signature
      if (typeof btnOrItemName !== 'string') {
        btnEl = btnOrItemName;
        const slug = slugOrBuyer;
        const items = getActiveDataset().items;
        const item = items ? items.find(i => i.slug === slug) : null;
        if (item && item.buyerName && item.highestBuyPrice != null) {
          buyerName = item.buyerName;
          itemName = item.name;
          price = item.highestBuyPrice;
        } else {
          return;
        }
      }

      // Required Format: /w {buyer_ingame_name} Hi! I want to sell: [{Item Name}] for {highest_buy_plat} platinum. (warframe.market)
      const message = `/w ${buyerName} Hi! I want to sell: [${itemName}] for ${price} platinum. (warframe.market)`;
      copyToClipboard(message, btnEl, `Copied: ${message}`);
    };

    function copyToClipboard(text, btnEl, toastMsg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showCopySuccess(btnEl, toastMsg);
        }).catch(() => fallbackCopy(text, btnEl, toastMsg));
      } else {
        fallbackCopy(text, btnEl, toastMsg);
      }
    }

    function fallbackCopy(text, btnEl, toastMsg) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showCopySuccess(btnEl, toastMsg);
      } catch (err) {
        showToast('Failed to copy to clipboard');
      }
      document.body.removeChild(ta);
    }

    function showCopySuccess(btnEl, toastMsg) {
      if (!btnEl) return;
      const origHtml = btnEl.innerHTML;
      btnEl.classList.add('copied');
      btnEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>Copied!</span>
      `;
      showToast(toastMsg || 'Whisper copied to clipboard!');
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.innerHTML = origHtml;
      }, 1800);
    }

    /* ─── Toast Notification ─── */
    function showToast(message) {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold-primary)"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
        <span>${escapeHtml(message)}</span>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    /* ─── Live Countdown Timer & Auto-Refresh (Ticking Down Progress Bar) ─── */
    function startCountdownTimer(cacheTimestamp) {
      if (STATE.countdownInterval) {
        clearInterval(STATE.countdownInterval);
      }

      const ttlMs = STATE.settings.ttlMinutes * 60 * 1000;
      const expiry = cacheTimestamp + ttlMs;

      function tick() {
        const remaining = expiry - Date.now();
        const timerEl = document.getElementById('status-timer');
        const bar = document.getElementById('progress-bar');

        if (remaining <= 0) {
          if (timerEl) timerEl.textContent = 'Refreshing...';
          if (bar) {
            bar.style.width = '0%';
            bar.classList.remove('active');
          }
          clearInterval(STATE.countdownInterval);

          if (!document.hidden && !STATE.scanInProgress) {
            const active = getActiveDataset();
            if (active.id) {
              if (STATE.activeTab === 'traders') selectPlanet(active.id);
              else selectSyndicate(active.id);
            }
          }
          return;
        }

        // Smoothly tick down from 100% to 0% as remaining time approaches 0
        const pct = Math.max(0, Math.min(100, (remaining / ttlMs) * 100));
        if (bar) {
          bar.style.width = `${pct}%`;
          bar.classList.remove('active');
        }

        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        if (timerEl) {
          timerEl.textContent = `Refreshes in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }

      tick();
      STATE.countdownInterval = setInterval(tick, 1000);
    }

    document.addEventListener('visibilitychange', () => {
      // When returning to the tab, restart countdown and sync the tick-down bar
      if (!document.hidden) {
        const active = getActiveDataset();
        if (active.id) {
          const cached = getCachedData(active.id);
          if (cached) {
            startCountdownTimer(cached.timestamp);
          }
        }
      }
    });

    /* ─── Progress & Status Helpers ─── */
    function updateProgressBar(current, total) {
      const bar = document.getElementById('progress-bar');
      const pct = total > 0 ? (current / total) * 100 : 0;
      bar.style.width = `${pct}%`;
      bar.classList.toggle('active', current < total && STATE.scanInProgress);
    }

    function setStatus(text, isBusy) {
      const el = document.getElementById('status-text');
      if (el) el.textContent = text;
    }

    function setApiBadge(text, isScanning) {
      document.getElementById('api-status-text').textContent = text;
      const dot = document.getElementById('api-status-dot');
      dot.className = `badge-dot ${isScanning ? 'scanning' : 'active'}`;
    }

    function formatTimeAgo(timestamp) {
      const diffSecs = Math.floor((Date.now() - timestamp) / 1000);
      if (diffSecs < 60) return `${diffSecs}s ago`;
      const diffMins = Math.floor(diffSecs / 60);
      return `${diffMins}m ago`;
    }

    /* ─── Escape Helpers ─── */
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/'/g, "\'");
    }

    /* ─── Image Zoom & Lightbox Preview ─────────────────────────────────────── */
    function findItemBySlug(slug) {
      if (!slug) return null;
      const active = getActiveDataset();
      if (active && active.items) {
        const found = active.items.find(i => i.slug === slug);
        if (found) return found;
      }
      for (const s of Object.values(SYNDICATES_DATA)) {
        if (s.items) {
          const found = s.items.find(i => i.slug === slug);
          if (found) return found;
        }
      }
      for (const p of Object.values(TRADERS_DATA)) {
        if (p.items) {
          const found = p.items.find(i => i.slug === slug);
          if (found) return found;
        }
      }
      return null;
    }

    function openImageLightbox(slug) {
      const item = findItemBySlug(slug);
      if (!item) return;

      hideHoverPopover();

      const modal = document.getElementById('image-lightbox-modal');
      const titleEl = document.getElementById('lightbox-item-title');
      const badgeEl = document.getElementById('lightbox-item-badge');
      const imgEl = document.getElementById('lightbox-img');
      const standingEl = document.getElementById('lightbox-standing');
      const lowestEl = document.getElementById('lightbox-lowest');
      const ratioEl = document.getElementById('lightbox-ratio');
      const wmLink = document.getElementById('lightbox-wm-link');

      if (titleEl) titleEl.textContent = item.name;
      if (badgeEl) {
        const tag = item.trader ? item.trader : (item.warframe ? `[${item.warframe}] Mod` : item.type || 'Offering');
        badgeEl.textContent = tag;
      }

      if (standingEl) standingEl.textContent = item.standing ? `${item.standing.toLocaleString()} pts` : '—';
      if (lowestEl) lowestEl.textContent = item.lowestSellPrice != null ? `${item.lowestSellPrice}p` : '—';
      if (ratioEl) ratioEl.textContent = item.sellRatio != null ? item.sellRatio.toFixed(2) : '—';

      if (imgEl) {
        imgEl.src = `assets/${item.slug}.png`;
        imgEl.onerror = function() {
          this.onerror = null;
          this.src = `/api/image/${item.slug}`;
        };
      }

      if (wmLink) {
        wmLink.href = `https://warframe.market/items/${item.slug}`;
      }

      if (modal) modal.classList.add('open');
    }

    function closeImageLightbox() {
      const modal = document.getElementById('image-lightbox-modal');
      if (modal) modal.classList.remove('open');
    }

    let hoverPopoverTimer = null;
    function showHoverPopover(slug, targetEl) {
      if (!slug || !targetEl) return;
      const item = findItemBySlug(slug);
      if (!item) return;

      clearTimeout(hoverPopoverTimer);
      hoverPopoverTimer = setTimeout(() => {
        const popover = document.getElementById('image-hover-popover');
        const popImg = document.getElementById('hover-popover-img');
        const popTitle = document.getElementById('hover-popover-title');
        if (!popover || !popImg || !popTitle) return;

        popTitle.textContent = item.name;
        popImg.src = `assets/${item.slug}.png`;
        popImg.onerror = function() {
          this.onerror = null;
          this.src = `/api/image/${item.slug}`;
        };

        const rect = targetEl.getBoundingClientRect();
        const popWidth = 250;
        const popHeight = 360;
        let left = rect.right + 12;
        if (left + popWidth > window.innerWidth - 10) {
          left = rect.left - popWidth - 12;
        }
        if (left < 10) left = 10;

        let top = rect.top - 10;
        if (top + popHeight > window.innerHeight - 10) {
          top = window.innerHeight - popHeight - 10;
        }
        if (top < 10) top = 10;

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        popover.classList.add('visible');
      }, 120);
    }

    function hideHoverPopover() {
      clearTimeout(hoverPopoverTimer);
      const popover = document.getElementById('image-hover-popover');
      if (popover) popover.classList.remove('visible');
    }

    /* ─── Asset Pre-Downloader Controller ─── */
    let assetDownloadPollTimer = null;
    let clientAssetDownloadCancelled = false;

    async function triggerAssetDownload(scope = 'all', force = false) {
      const statusBox = document.getElementById('asset-dl-progress-box');
      const statusLabel = document.getElementById('asset-dl-label');
      const countsEl = document.getElementById('asset-dl-counts');
      const barEl = document.getElementById('asset-dl-bar');
      const currentItemEl = document.getElementById('asset-dl-current-item');
      const headerStatus = document.getElementById('asset-cache-status');

      if (statusBox) statusBox.style.display = 'block';
      if (barEl) barEl.style.width = '0%';
      if (countsEl) countsEl.textContent = '0 / 0';
      if (statusLabel) statusLabel.textContent = force ? 'Force downloading assets...' : `Downloading ${scope}...`;
      if (currentItemEl) currentItemEl.textContent = 'Connecting...';
      if (headerStatus) {
        headerStatus.textContent = 'Running';
        headerStatus.style.color = 'var(--cyan-primary)';
      }

      // Check if local server is available
      let serverAvailable = false;
      try {
        const pingResp = await fetch('/api/download-status', { cache: 'no-store' });
        if (pingResp.ok) serverAvailable = true;
      } catch (e) {
        serverAvailable = false;
      }

      if (serverAvailable) {
        // Trigger server-side background task
        try {
          const req = await fetch(`/api/download-assets?scope=${encodeURIComponent(scope)}&force=${force}`, {
            method: 'POST'
          });
          const res = await req.json();
          if (!req.ok && !res.success) {
            showToast(res.message || 'Download could not start');
          }
          startAssetDownloadPolling();
        } catch (err) {
          showToast(`Server download error: ${err.message}`);
          stopAssetDownloadPolling();
        }
      } else {
        // Client-side fallback: Pre-warm browser cache via direct API queries
        runClientSideAssetPrewarm(scope, force);
      }
    }

    function startAssetDownloadPolling() {
      clearInterval(assetDownloadPollTimer);
      assetDownloadPollTimer = setInterval(async () => {
        try {
          const resp = await fetch('/api/download-status', { cache: 'no-store' });
          if (!resp.ok) return;
          const state = await resp.json();

          const barEl = document.getElementById('asset-dl-bar');
          const countsEl = document.getElementById('asset-dl-counts');
          const currentItemEl = document.getElementById('asset-dl-current-item');
          const statusLabel = document.getElementById('asset-dl-label');
          const headerStatus = document.getElementById('asset-cache-status');

          const completed = state.completed || 0;
          const total = state.total || 1;
          const pct = Math.min(100, Math.round((completed / total) * 100));

          if (barEl) barEl.style.width = `${pct}%`;
          if (countsEl) countsEl.textContent = `${completed} / ${total} (${pct}%)`;
          if (currentItemEl) {
            currentItemEl.textContent = state.currentSlug ? `Item: ${state.currentSlug}` : (state.message || 'Processing...');
          }

          if (!state.active) {
            stopAssetDownloadPolling();
            if (statusLabel) statusLabel.textContent = state.done ? 'Download completed!' : (state.message || 'Idle');
            if (headerStatus) {
              headerStatus.textContent = 'Done';
              headerStatus.style.color = '#4ade80';
            }
            showToast(state.message || 'Assets download finished');
          }
        } catch (e) {
          stopAssetDownloadPolling();
        }
      }, 400);
    }

    function stopAssetDownloadPolling() {
      clearInterval(assetDownloadPollTimer);
      assetDownloadPollTimer = null;
    }

    async function stopAssetDownload() {
      stopAssetDownloadPolling();
      clientAssetDownloadCancelled = true;

      try {
        await fetch('/api/download-stop', { method: 'POST' });
      } catch (e) {}

      const statusLabel = document.getElementById('asset-dl-label');
      const headerStatus = document.getElementById('asset-cache-status');
      if (statusLabel) statusLabel.textContent = 'Download cancelled';
      if (headerStatus) {
        headerStatus.textContent = 'Cancelled';
        headerStatus.style.color = 'var(--text-muted)';
      }
      showToast('Asset download cancelled');
    }

    // Client-side fallback if server is not present (e.g. GitHub Pages)
    async function runClientSideAssetPrewarm(scope, force) {
      clientAssetDownloadCancelled = false;
      const slugs = [];
      if (scope === 'all' || scope === 'syndicates') {
        Object.values(SYNDICATES_DATA).forEach(syn => {
          (syn.items || []).forEach(it => { if (it.slug && !slugs.includes(it.slug)) slugs.push(it.slug); });
        });
      }
      if (scope === 'all' || scope === 'traders') {
        Object.values(TRADERS_DATA).forEach(trd => {
          (trd.items || []).forEach(it => { if (it.slug && !slugs.includes(it.slug)) slugs.push(it.slug); });
        });
      }

      const total = slugs.length;
      let completed = 0;
      const barEl = document.getElementById('asset-dl-bar');
      const countsEl = document.getElementById('asset-dl-counts');
      const currentItemEl = document.getElementById('asset-dl-current-item');
      const statusLabel = document.getElementById('asset-dl-label');
      const headerStatus = document.getElementById('asset-cache-status');

      for (let i = 0; i < total; i++) {
        if (clientAssetDownloadCancelled) break;
        const slug = slugs[i];
        if (currentItemEl) currentItemEl.textContent = `Pre-warming: ${slug}`;
        
        // Pre-warm browser image cache
        const img = new Image();
        img.src = `assets/${slug}.png`;
        img.onerror = () => {
          img.src = `/api/image/${slug}`;
        };

        completed++;
        const pct = Math.min(100, Math.round((completed / total) * 100));
        if (barEl) barEl.style.width = `${pct}%`;
        if (countsEl) countsEl.textContent = `${completed} / ${total} (${pct}%)`;

        await new Promise(r => setTimeout(r, 60));
      }

      if (statusLabel) statusLabel.textContent = clientAssetDownloadCancelled ? 'Stopped' : 'Pre-warming complete!';
      if (headerStatus) {
        headerStatus.textContent = clientAssetDownloadCancelled ? 'Cancelled' : 'Ready';
        headerStatus.style.color = clientAssetDownloadCancelled ? 'var(--text-muted)' : '#4ade80';
      }
      showToast(clientAssetDownloadCancelled ? 'Asset pre-warming cancelled' : 'Asset pre-warming complete');
    }

    /* ─── Event Listeners ─── */
    function bindEvents() {
      // Force Refresh Button: wipes cache and triggers clean throttled scan
      document.getElementById('btn-force-refresh').addEventListener('click', () => {
        if (STATE.activeTab === 'traders') {
          if (!STATE.currentPlanet) return;
          const pid = STATE.currentPlanet;
          try {
            localStorage.removeItem(getCacheKey(pid));
          } catch (e) {}
          STATE.currentPlanet = null;
          STATE.planetItems[pid] = null;
          selectPlanet(pid);
        } else {
          if (!STATE.currentSyndicate) return;
          const sid = STATE.currentSyndicate;
          try {
            localStorage.removeItem(getCacheKey(sid));
          } catch (e) {}
          STATE.currentSyndicate = null;
          STATE.syndicateItems[sid] = null;
          selectSyndicate(sid);
        }
      });

      // Search Input
      // Navigation Tabs (Syndicates vs Traders)
      const tabSyn = document.getElementById('tab-btn-syndicates');
      const tabTrd = document.getElementById('tab-btn-traders');
      if (tabSyn) tabSyn.addEventListener('click', () => switchTab('syndicates'));
      if (tabTrd) tabTrd.addEventListener('click', () => switchTab('traders'));

      // View Mode Toggle (Tiles vs Lines)
      const btnViewTiles = document.getElementById('view-btn-tiles');
      const btnViewLines = document.getElementById('view-btn-lines');
      if (btnViewTiles) btnViewTiles.addEventListener('click', () => setViewMode('tiles'));
      if (btnViewLines) btnViewLines.addEventListener('click', () => setViewMode('lines'));

      document.getElementById('search-input').addEventListener('input', (e) => {
        STATE.searchQuery = e.target.value.trim();
        renderCurrentView();
      });

      // Type Filter Buttons
      document.querySelectorAll('#type-filters .pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#type-filters .pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          STATE.activeFilter = btn.dataset.filter;
          renderCurrentView();
        });
      });

      // Table Header Sorting
      document.querySelectorAll('#market-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (STATE.sortColumn === col) {
            STATE.sortAsc = !STATE.sortAsc;
          } else {
            STATE.sortColumn = col;
            STATE.sortAsc = (col === 'name');
          }

          document.querySelectorAll('#market-table th').forEach(h => {
            h.classList.remove('sorted');
            const arrow = h.querySelector('.sort-arrow');
            if (arrow) arrow.textContent = '↕';
          });

          th.classList.add('sorted');
          const arrow = th.querySelector('.sort-arrow');
          if (arrow) arrow.textContent = STATE.sortAsc ? '▲' : '▼';

          renderCurrentView();
        });
      });

      // Platform Filter (Toolbar)
      const platSelect = document.getElementById('select-platform');
      if (platSelect) {
        platSelect.value = STATE.platform || 'crossplay';
        platSelect.addEventListener('change', (e) => {
          setPlatformFilter(e.target.value);
        });
      }

      // Standing Liquidation Calculator
      const standingInput = document.getElementById('input-available-standing');
      if (standingInput) {
        standingInput.value = STATE.availableStanding || 125000;
        standingInput.addEventListener('input', (e) => {
          setAvailableStanding(e.target.value);
        });
      }

      document.querySelectorAll('#standing-preset-chips .preset-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.standing, 10);
          setAvailableStanding(val);
        });
      });

      // Atragraph Filter Toggle (Toolbar)
      const atraToggle = document.getElementById('toggle-exclude-atragraphs');
      if (atraToggle) {
        atraToggle.checked = STATE.excludeAtragraphs;
        atraToggle.addEventListener('change', (e) => {
          setAtragraphFilter(e.target.checked);
        });
      }

      // Settings Modal
      const modal = document.getElementById('settings-modal');
      document.getElementById('btn-open-settings').addEventListener('click', () => {
        document.getElementById('setting-ttl').value = STATE.settings.ttlMinutes;
        document.getElementById('setting-delay').value = STATE.settings.delayMs;
        const setAtra = document.getElementById('setting-exclude-atragraphs');
        if (setAtra) setAtra.value = String(STATE.settings.excludeAtragraphs !== false);
        const setPlat = document.getElementById('setting-platform');
        if (setPlat) setPlat.value = STATE.settings.platform || 'crossplay';
        modal.classList.add('open');

        // Check active asset download status if server is running
        fetch('/api/download-status', { cache: 'no-store' }).then(r => r.json()).then(st => {
          if (st && st.active) {
            const statusBox = document.getElementById('asset-dl-progress-box');
            if (statusBox) statusBox.style.display = 'block';
            startAssetDownloadPolling();
          }
        }).catch(() => {});
      });

      document.getElementById('btn-close-settings').addEventListener('click', () => {
        modal.classList.remove('open');
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });

      document.getElementById('btn-save-settings').addEventListener('click', () => {
        STATE.settings.ttlMinutes = parseInt(document.getElementById('setting-ttl').value, 10);
        STATE.settings.delayMs = Math.max(500, parseInt(document.getElementById('setting-delay').value, 10));
        const setAtra = document.getElementById('setting-exclude-atragraphs');
        if (setAtra) {
          const excludeVal = setAtra.value === 'true';
          setAtragraphFilter(excludeVal);
        }
        const setPlat = document.getElementById('setting-platform');
        if (setPlat) {
          setPlatformFilter(setPlat.value);
        } else {
          saveSettings();
        }
        modal.classList.remove('open');
        showToast('Settings saved successfully');
      });

      document.getElementById('btn-clear-all-cache').addEventListener('click', () => {
        Object.keys(SYNDICATES_DATA).forEach(synId => {
          try { localStorage.removeItem(getCacheKey(synId)); } catch (e) {}
        });
        Object.keys(TRADERS_DATA).forEach(planetId => {
          try { localStorage.removeItem(getCacheKey(planetId)); } catch (e) {}
        });
        showToast('All syndicate and trader caches cleared');
        modal.classList.remove('open');
        if (STATE.activeTab === 'traders' && STATE.currentPlanet) {
          const pid = STATE.currentPlanet;
          STATE.currentPlanet = null;
          STATE.planetItems[pid] = null;
          selectPlanet(pid);
        } else if (STATE.currentSyndicate) {
          const sid = STATE.currentSyndicate;
          STATE.currentSyndicate = null;
          STATE.syndicateItems[sid] = null;
          selectSyndicate(sid);
        }
      });

      // Asset Pre-Downloader Buttons
      const btnDlAll = document.getElementById('btn-dl-all');
      const btnDlSyn = document.getElementById('btn-dl-syndicates');
      const btnDlTrd = document.getElementById('btn-dl-traders');
      const btnDlForce = document.getElementById('btn-dl-force');
      const btnDlCancel = document.getElementById('btn-dl-cancel');

      if (btnDlAll) btnDlAll.addEventListener('click', () => triggerAssetDownload('all', false));
      if (btnDlSyn) btnDlSyn.addEventListener('click', () => triggerAssetDownload('syndicates', false));
      if (btnDlTrd) btnDlTrd.addEventListener('click', () => triggerAssetDownload('traders', false));
      if (btnDlForce) btnDlForce.addEventListener('click', () => triggerAssetDownload('all', true));
      if (btnDlCancel) btnDlCancel.addEventListener('click', stopAssetDownload);

      // Lightbox Modal Controls & Backdrop
      const lightboxModal = document.getElementById('image-lightbox-modal');
      const btnCloseLightbox = document.getElementById('btn-close-lightbox');
      const btnDismissLightbox = document.getElementById('btn-dismiss-lightbox');
      if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeImageLightbox);
      if (btnDismissLightbox) btnDismissLightbox.addEventListener('click', closeImageLightbox);
      if (lightboxModal) {
        lightboxModal.addEventListener('click', (e) => {
          if (e.target === lightboxModal) closeImageLightbox();
        });
      }

      // Escape key handler for lightbox and popovers
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeImageLightbox();
          hideHoverPopover();
        }
      });

      // Window scroll dismisses hover popover
      window.addEventListener('scroll', hideHoverPopover, { passive: true });

      // Click delegation to enlarge card/item image
      document.addEventListener('click', (e) => {
        const thumbBox = e.target.closest('.tile-thumb-box, .table-thumb-box');
        if (thumbBox && thumbBox.dataset.slug) {
          e.preventDefault();
          e.stopPropagation();
          openImageLightbox(thumbBox.dataset.slug);
        }
      });

      // Hover delegation for fast preview popover
      document.addEventListener('mouseover', (e) => {
        const thumbBox = e.target.closest('.tile-thumb-box, .table-thumb-box');
        if (thumbBox && thumbBox.dataset.slug) {
          showHoverPopover(thumbBox.dataset.slug, thumbBox);
        }
      });

      document.addEventListener('mouseout', (e) => {
        const thumbBox = e.target.closest('.tile-thumb-box, .table-thumb-box');
        if (thumbBox) {
          if (!e.relatedTarget || !thumbBox.contains(e.relatedTarget)) {
            hideHoverPopover();
          }
        }
      });
    }

    /* ─── Initialize Application ─── */
    function init() {
      loadSettings();
      const atraToggle = document.getElementById('toggle-exclude-atragraphs');
      if (atraToggle) {
        atraToggle.checked = STATE.excludeAtragraphs !== false;
      }
      const platSelect = document.getElementById('select-platform');
      if (platSelect) {
        platSelect.value = STATE.platform || 'crossplay';
      }
      const standingInput = document.getElementById('input-available-standing');
      if (standingInput) {
        standingInput.value = STATE.availableStanding || 125000;
      }
      document.querySelectorAll('#standing-preset-chips .preset-chip').forEach(chip => {
        const chipVal = parseInt(chip.dataset.standing, 10);
        chip.classList.toggle('active', chipVal === (STATE.availableStanding || 125000));
      });
      initSyndicateSelector();
      initPlanetSelector();
      bindEvents();

      // Ensure Tiles view is default and active
      const isTiles = STATE.viewMode === 'tiles';
      const btnTiles = document.getElementById('view-btn-tiles');
      const btnLines = document.getElementById('view-btn-lines');
      if (btnTiles) btnTiles.classList.toggle('active', isTiles);
      if (btnLines) btnLines.classList.toggle('active', !isTiles);
      const tilesContainer = document.getElementById('tiles-grid');
      const tableContainer = document.getElementById('table-container');
      if (tilesContainer) tilesContainer.style.display = isTiles ? 'grid' : 'none';
      if (tableContainer) tableContainer.style.display = isTiles ? 'none' : 'block';
    }

    document.addEventListener('DOMContentLoaded', init);
