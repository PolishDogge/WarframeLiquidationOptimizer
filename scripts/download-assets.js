#!/usr/bin/env node
/**
 * Warframe Syndicate & Traders Optimizer — Complete Asset Pre-downloader
 * Downloads item thumbnails directly or via local server proxy to ./assets/
 *
 * Usage:
 *   node scripts/download-assets.js [--syndicates] [--traders] [--port=3000] [--force]
 *
 * Options:
 *   --syndicates : Download only the 6 core syndicate offering thumbnails (136 items)
 *   --traders    : Download only The Hex & Open World traders thumbnails (103 items)
 *   (default)    : Downloads both Syndicates & Traders (239 items)
 *   --force      : Re-download even if already present in ./assets/
 *   --port=3000  : Port of local proxy server if running
 *
 * Respects Warframe.market API v2 rate limiting (enforces >= 500 ms delay).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// CLI Arguments
const portArg = process.argv.find(a => a.startsWith('--port='));
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 3000;
const FORCE = process.argv.includes('--force');
const ONLY_SYNDICATES = process.argv.includes('--syndicates');
const ONLY_TRADERS = process.argv.includes('--traders');
const DELAY = 550; // PLEASE don't set the delay lower, it **WILL** give you time outs

// ── Open World Hubs & The Hex (103 items) ──
const TRADER_SLUGS = [
  // ── Earth (Cetus / Plains of Eidolon) ──
  // Hok (Zaw Exodia Arcanes)
  'exodia_contagion', 'exodia_epidemic', 'exodia_triumph', 'exodia_valor',
  'exodia_might', 'exodia_brave', 'exodia_hunt', 'exodia_force',
  // Old Man Suumbaat (Focus Lenses & Refined Gems)
  'naramon_lens', 'vazarin_lens', 'unairu_lens', 'zenurik_lens', 'madurai_lens',
  'eidolon_naramon_lens', 'eidolon_vazarin_lens', 'eidolon_unairu_lens',
  'eidolon_zenurik_lens', 'eidolon_madurai_lens',
  'radian_sentirum', 'heart_nyth',
  // The Quills / Onkko (Operator & Amp Arcanes)
  'magus_elevate', 'magus_nourish', 'magus_husk', 'magus_vigor',
  'magus_cadence', 'magus_cloud', 'virtuos_fury', 'virtuos_strike',
  'virtuos_shadow', 'virtuos_ghost', 'virtuos_null', 'virtuos_tempo',

  // ── Venus (Fortuna / Orb Vallis) ──
  // Rude Zuud (Pax Arcanes)
  'pax_bolt', 'pax_charge', 'pax_seeker', 'pax_soar',
  // Smokefinger (Refined Gems)
  'star_amarast', 'radiant_zodian', 'marquise_thyst', 'goblite_tears',
  // Little Duck / Vox Solaris (Operator & Amp Arcanes)
  'magus_lockdown', 'magus_repair', 'magus_melt', 'magus_accelerant',
  'magus_overload', 'magus_drive', 'magus_firewall',
  'virtuos_surge', 'virtuos_spike', 'virtuos_trojan', 'virtuos_forge',

  // ── Deimos (Necralisk / Cambion Drift) ──
  // Father (Archon Mods & Theorem/Residual Arcanes)
  'archon_continuity', 'archon_flow', 'archon_intensify', 'archon_stretch', 'archon_vitality',
  'theorem_demulcent', 'theorem_infection', 'theorem_contagion',
  'residual_boils', 'residual_malodor', 'residual_shock', 'residual_viremia',
  // Otak (Refined Gems)
  'purified_heciphron', 'trapezium_xenorhast', 'cabochon_embolos',

  // ── Zariman Ten Zero (The Chrysalith / The Holdfasts) ──
  // Cavalero (Holdfasts Arcanes)
  'molt_augmented', 'molt_efficiency', 'molt_reconstruct', 'molt_vigor',
  'cascadia_flare', 'cascadia_overcharge', 'cascadia_empowered', 'cascadia_accuracy',
  'emergence_dissipate', 'emergence_savior', 'emergence_renewed',
  'arcane_steadfast', 'arcane_blessing',

  // ── Sanctum Anatomica (Deimos / Cavia) ──
  // Bird 3 & Loid (Melee Arcanes & Legendary Arcanes)
  'melee_exposure', 'melee_influence', 'melee_animosity', 'melee_retaliation',
  'melee_vortex', 'melee_fortification', 'melee_crescendo', 'melee_duplicate',
  'arcane_blade_charger', 'arcane_fury', 'arcane_strike', 'arcane_momentum',
  'arcane_avenger', 'arcane_ultimatum', 'arcane_arachne', 'arcane_phantasm',

  // ── 1999 Höllvania (The Hex) ──
  // The Hex Syndicate Offerings
  'arcane_bellicose', 'arcane_camisado', 'arcane_crepuscular', 'arcane_impetus',
  'arcane_truculence', 'melee_doughty', 'primary_crux', 'secondary_enervate'
];

// ── Core Syndicates Offerings (136 items) ──
const SYNDICATE_SLUGS = [
  "accumulating_whipclaw",
  "aegis_gale",
  "afterburn",
  "assimilate",
  "avenging_truth",
  "balefire_surge",
  "biting_frost",
  "blade_of_truth",
  "blazing_pillage",
  "blending_talons",
  "blood_forge",
  "bright_purity",
  "calm_and_frenzy",
  "cataclysmic_continuum",
  "catapult",
  "cathode_current",
  "chaos_sphere",
  "chilling_globe",
  "chromatic_blade",
  "coil_recharge",
  "concentrated_arrow",
  "conductive_sphere",
  "counter_pulse",
  "deadly_sequence",
  "desiccations_curse",
  "disarming_purity",
  "dread_ward",
  "duality",
  "elemental_sandstorm",
  "elusive_retribution",
  "empowered_quiver",
  "endless_lullaby",
  "energy_transfer",
  "entropy_burst",
  "entropy_detonation",
  "entropy_flight",
  "entropy_spike",
  "eroding_blight",
  "everlasting_ward",
  "exothermic",
  "fireball_frenzy",
  "fracturing_crush",
  "freeze_force",
  "furious_javelin",
  "gastro",
  "gilded_truth",
  "gleaming_blight",
  "gourmand",
  "greedy_pull",
  "guardian_armor",
  "guided_effigy",
  "healing_flame",
  "hearty_nourishment",
  "ice_wave_impedance",
  "icy_avalanche",
  "immolated_radiance",
  "infiltrate",
  "jades_judgment",
  "justice_blades",
  "kumihimo_loading",
  "lasting_covenant",
  "lasting_purity",
  "lingering_transmutation",
  "mach_crash",
  "magnetized_discharge",
  "mending_splinters",
  "mind_freak",
  "negation_armor",
  "neutralizing_justice",
  "noctua_swarm",
  "omikujis_fortune",
  "ore_gaze",
  "path_of_statues",
  "peaceful_provocation",
  "piercing_navigator",
  "pilfering_swarm",
  "prismatic_companion",
  "radiant_finish",
  "rakta_ballistica",
  "rakta_cernos",
  "rakta_dark_dagger",
  "razor_mortar",
  "reactive_storm",
  "recrystalize",
  "resonance",
  "reverse_rotorswell",
  "rift_haven",
  "rift_torrent",
  "rising_storm",
  "rousing_plunder",
  "rubble_heap",
  "sancti_castanas",
  "sancti_magistar",
  "sancti_tigris",
  "savage_silence",
  "scattered_justice",
  "secura_dual_cestra",
  "secura_lecta",
  "secura_penta",
  "seeking_shuriken",
  "sequence_burn",
  "shattered_storm",
  "shattering_justice",
  "smoke_shadow",
  "spectral_spirit",
  "spectrosiphon",
  "stinging_truth",
  "stockpiled_blight",
  "surging_dash",
  "swift_bite",
  "synoid_gammacor",
  "synoid_heliocor",
  "synoid_simulor",
  "tectonic_fracture",
  "teleport_rush",
  "telos_akbolto",
  "telos_boltace",
  "telos_boltor",
  "thermal_transfer",
  "tidal_impunity",
  "titanic_rumbler",
  "toxic_blight",
  "toxic_sequence",
  "tribunal",
  "valence_formation",
  "vaykor_hek",
  "vaykor_marelok",
  "vaykor_sydon",
  "vexing_retaliation",
  "viral_tempest",
  "volatile_recompense",
  "voltage_sequence",
  "warding_thurible",
  "warriors_rest",
  "winds_of_purity",
  "wrath_of_ukko"
];

// Determine active slug collection
let SLUGS = [];
if (ONLY_SYNDICATES) {
  SLUGS = SYNDICATE_SLUGS;
} else if (ONLY_TRADERS) {
  SLUGS = TRADER_SLUGS;
} else {
  SLUGS = [...new Set([...TRADER_SLUGS, ...SYNDICATE_SLUGS])];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if local server is listening on port
function isServerRunning() {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${PORT}/api/clear-cache`, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

// Download directly from Warframe Market API v2
async function fetchDirect(slug) {
  const headers = {
    'Accept': 'application/json',
    'Language': 'en',
    'Platform': 'pc',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const metaUrl = `https://api.warframe.market/v2/items/${encodeURIComponent(slug)}`;
  const metaResp = await fetch(metaUrl, { headers });
  if (!metaResp.ok) {
    throw new Error(`Item metadata HTTP ${metaResp.status}`);
  }

  const meta = await metaResp.json();
  const thumb = meta?.data?.i18n?.en?.thumb;
  if (!thumb) {
    throw new Error('No thumbnail found in item metadata');
  }

  const imgUrl = `https://warframe.market/static/assets/${thumb}`;
  const imgResp = await fetch(imgUrl, { headers: { 'User-Agent': headers['User-Agent'] } });
  if (!imgResp.ok) {
    throw new Error(`Thumbnail image HTTP ${imgResp.status}`);
  }

  const buffer = Buffer.from(await imgResp.arrayBuffer());
  const ext = thumb.endsWith('.webp') ? '.webp' : '.png';
  return { buffer, ext };
}

// Download via local proxy server
function fetchViaServer(slug) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}/api/image/${encodeURIComponent(slug)}`, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const ext = (res.headers['content-type'] || '').includes('webp') ? '.webp' : '.png';
        resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), ext });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  console.log('Warframe Syndicate & Traders Optimizer - Complete Asset Downloader');
  console.log('===================================================================');
  console.log(`Assets Directory: ${assetsDir}`);
  console.log(`Target Scope:     ${ONLY_SYNDICATES ? 'Syndicates Only' : (ONLY_TRADERS ? 'Traders Only' : 'All (Syndicates + Traders)')}`);
  console.log(`Total Items:      ${SLUGS.length}`);
  console.log(`Throttle Delay:   ${DELAY} ms`);

  const serverActive = await isServerRunning();
  console.log(`Download Mode:    ${serverActive ? `Local Server Proxy (port ${PORT})` : 'Direct API v2 Download'}\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedList = [];

  for (let i = 0; i < SLUGS.length; i++) {
    const slug = SLUGS[i];
    const prefix = `[${String(i + 1).padStart(3, ' ')}/${SLUGS.length}] ${slug.padEnd(28, ' ')}`;
    process.stdout.write(prefix);

    const pngPath = path.join(assetsDir, `${slug}.png`);
    const webpPath = path.join(assetsDir, `${slug}.webp`);

    if (!FORCE && (fs.existsSync(pngPath) || fs.existsSync(webpPath))) {
      console.log('[cached]');
      skipped++;
      continue;
    }

    let success = false;
    let attempts = 0;

    while (attempts < 2 && !success) {
      attempts++;
      try {
        let result;
        if (serverActive) {
          const res = await fetchViaServer(slug);
          if (res.status === 200 && res.buffer.length > 50) {
            result = { buffer: res.buffer, ext: res.ext };
          } else {
            throw new Error(`Proxy status ${res.status}`);
          }
        } else {
          result = await fetchDirect(slug);
        }

        const savePath = path.join(assetsDir, `${slug}${result.ext}`);
        fs.writeFileSync(savePath, result.buffer);
        console.log(`[ok] (${(result.buffer.length / 1024).toFixed(1)} KB)`);
        downloaded++;
        success = true;
      } catch (err) {
        if (attempts >= 2) {
          console.log(`[fail: ${err.message}]`);
          failedList.push({ slug, error: err.message });
          failed++;
        } else {
          await sleep(1000);
        }
      }
    }

    if (i < SLUGS.length - 1) {
      await sleep(DELAY);
    }
  }

  console.log('\n===================================================================');
  console.log(`Finished: ${downloaded} downloaded, ${skipped} cached, ${failed} failed.`);

  if (failedList.length > 0) {
    console.log('\nFailed Slugs:');
    failedList.forEach(f => console.log(`  - ${f.slug}: ${f.error}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
