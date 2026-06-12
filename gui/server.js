/**
 * GUI backend: Express app that serves config API and (later) run() from dist/index.js.
 * Export createApp(configPath) for testing; start.js calls createApp() and listen().
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { loadConfig, loadProjectConfig, getEffectiveConfig, saveConfig } from '../dist/config/ConfigLoader.js';
import { Gallery } from '../dist/gallery/Gallery.js';
import { eventBus } from '../dist/core/EventBus.js';
import { TuiBridgeService } from '../dist/tui-bridge/TuiBridgeService.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig, summarizeBridgeRuntime } from '../dist/tui-bridge/BridgeLauncherConfig.js';
import { LLMClient } from '../dist/llm/LLMClient.js';
import { logSecurityEvent } from '../dist/security/SecurityLogger.js';
import { collectRepositoryOpportunityEvidence, scanGreenSystemOpportunities } from '../dist/improvement/OpportunityScanner.js';
import { buildGuiBridgeInput } from './bridgeInput.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const homeDir = process.env.HOME || '';
const tempDir = os.tmpdir();

const DEFAULTS = {
  loop: { maxIterations: 20, timeoutMinutes: 30 },
  creative: { minQualityScore: 0.7 },
  galleryPath: 'gallery',
};
const STORED_SECRET_SENTINEL = '(stored)';

/**
 * Validate a gallery path to prevent path traversal attacks.
 * Rejects paths containing '..', rejects absolute paths outside cwd/HOME,
 * and resolves relative paths against cwd.
 * @param {string} galleryPath
 * @returns {string} resolved absolute path
 * @throws {Error} on invalid path
 */
function validateGalleryPath(galleryPath) {
  if (!galleryPath || typeof galleryPath !== 'string') {
    throw new Error('Invalid gallery path');
  }
  if (galleryPath.includes('..')) {
    throw new Error('Invalid gallery path');
  }
  const resolved = path.resolve(cwd, galleryPath);
  let canonical;
  try {
    canonical = fs.realpathSync(resolved);
  } catch {
    canonical = resolved;
  }
  const allowedRoots = [cwd, homeDir, tempDir]
    .filter(Boolean)
    .map((root) => {
      try {
        return fs.realpathSync(root);
      } catch {
        return path.resolve(root);
      }
    });
  const insideAllowedRoot = allowedRoots.some((root) => {
    const relative = path.relative(root, canonical);
    return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  });
  if (path.isAbsolute(galleryPath)) {
    if (!insideAllowedRoot) {
      throw new Error('Invalid gallery path');
    }
  } else {
    const relative = path.relative(cwd, canonical);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid gallery path');
    }
  }
  return canonical;
}

function normalizedBpm(value, fallback = 120) {
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : fallback;
}

function safeTraitLabel(value, fallback) {
  const label = typeof value === 'string' ? value.trim() : '';
  return (label || fallback).replace(/[^\w -]/g, '').slice(0, 60) || fallback;
}

function withBpmLine(musicCode, bpm) {
  const cps = bpm / 60;
  const line = `setcps(${cps})`;
  const code = typeof musicCode === 'string' && musicCode.trim()
    ? musicCode.trim()
    : 'n("c4").sound("sine")';
  return /\bsetcps\s*\([^)]*\)/.test(code)
    ? code.replace(/\bsetcps\s*\([^)]*\)/, line)
    : `${line}\n${code}`;
}

function withPaletteComment(visualCode, palette) {
  const code = typeof visualCode === 'string' && visualCode.trim()
    ? visualCode.trim()
    : 'osc(0.2).out();';
  const comment = `// palette: ${palette}`;
  return /^\/\/ palette: .*$/m.test(code)
    ? code.replace(/^\/\/ palette: .*$/m, comment)
    : `${comment}\n${code}`;
}

function deterministicMusicCode(promptLabel) {
  return [
    `// deterministic organism: ${promptLabel}`,
    'stack(',
    '  s("bd ~ hh ~").gain(0.75),',
    '  note("c4 e4 g4 b4").sound("sine").slow(2).gain(0.45)',
    ').room(0.25)',
  ].join('\n');
}

function deterministicVisualCode(bpm) {
  const rate = Math.max(0.05, bpm / 600);
  return [
    `osc(${rate}, 0.08, 0.8)`,
    '  .kaleid(4)',
    '  .color(0.9, 0.45, 0.2)',
    '  .rotate(0.1)',
    '  .modulate(noise(2.5), 0.08)',
    '  .blend(shape(4, 0.35).luma(0.2), 0.25)',
    '  .out(o0);',
  ].join('\n');
}

function buildDeterministicOrganism(prompt, traits = {}, seed = {}) {
  const bpm = normalizedBpm(traits.bpm);
  const palette = safeTraitLabel(traits.palette, 'default');
  const seedMusic = seed.musicCode || '';
  const seedVisual = seed.visualCode || '';
  const promptLabel = safeTraitLabel(prompt, 'ambient');
  const baseMusic = seedMusic || deterministicMusicCode(promptLabel);
  const baseVisual = seedVisual || deterministicVisualCode(bpm);
  return {
    type: 'organism',
    musicCode: withBpmLine(baseMusic, bpm),
    visualCode: withPaletteComment(baseVisual, palette),
  };
}

// In-memory store for "Run in preview" so GET /preview can serve the code
const previewStore = new Map();
const tuiBridge = new TuiBridgeService();

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
const P5_SENSOR_POLICY_SCRIPT = `
  <script>
    (function liminalSensorPolicy() {
      const nativeAddEventListener = window.addEventListener.bind(window);
      window.addEventListener = function(type, listener, options) {
        const eventName = String(type).toLowerCase();
        if (eventName === 'devicemotion' || eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute') return;
        return nativeAddEventListener(type, listener, options);
      };
      try { Object.defineProperty(window, 'DeviceMotionEvent', { value: undefined, configurable: true }); } catch {}
      try { Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined, configurable: true }); } catch {}
    })();
  </script>`;
const STUDIO_HSTS_HEADER = 'max-age=31536000; includeSubDomains';

function setStudioCommonSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', STUDIO_HSTS_HEADER);
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function setPreviewSecurityHeaders(res, options = {}) {
  const organism = options.profile === 'organism';
  setStudioCommonSecurityHeaders(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "upgrade-insecure-requests",
    organism
      ? "script-src 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://unpkg.com"
      : "script-src 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'unsafe-inline'",
    "img-src * data: blob:",
    "media-src * data: blob:",
    "connect-src 'none'",
    "font-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScript(value) {
  return String(value).replace(/<\/script>/gi, '<\\/script>');
}

function parseOrganismPreview(code) {
  try {
    const parsed = JSON.parse(code);
    if (parsed?.type !== 'organism') return null;
    return {
      musicCode: typeof parsed.musicCode === 'string' ? parsed.musicCode : '',
      visualCode: typeof parsed.visualCode === 'string' ? parsed.visualCode : '',
    };
  } catch {
    return null;
  }
}

function renderOrganismPreview({ musicCode, visualCode }, version) {
  const safeMusic = escapeHtml(musicCode || 'No Strudel layer was saved.');
  const safeVisual = escapeHtml(visualCode || 'No Hydra visual layer was saved.');
  const runnableVisual = visualCode ? escapeScript(visualCode) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Permissions-Policy" content="accelerometer=(), gyroscope=(), magnetometer=(), deviceorientation=(), devicemotion=()">
  <title>Organism Preview v${version}</title>
  <script src="https://unpkg.com/hydra-synth"></script>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #05070d; color: #eaf2ff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .organism { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 420px); }
    .visual { position: relative; min-height: 100vh; background: #000; overflow: hidden; }
    #hydra-canvas { width: 100%; height: 100%; display: block; }
    .panel { border-left: 1px solid rgba(143, 166, 210, 0.26); background: rgba(10, 14, 24, 0.92); padding: 22px; display: flex; flex-direction: column; gap: 16px; }
    h1, h2 { margin: 0; }
    h1 { font-size: 20px; }
    h2 { color: #66e7ff; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; padding: 14px; border: 1px solid rgba(143, 166, 210, 0.24); border-radius: 12px; background: rgba(3, 6, 13, 0.84); color: #d8f6ff; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .error { position: absolute; left: 24px; bottom: 24px; max-width: min(640px, calc(100% - 48px)); color: #ff8585; background: rgba(0, 0, 0, 0.82); border: 1px solid rgba(255, 120, 120, 0.42); border-radius: 12px; padding: 12px; font: 12px/1.4 ui-monospace, monospace; display: none; }
  </style>
</head>
<body>
  <main class="organism">
    <section class="visual" aria-label="Hydra visual layer">
      <canvas id="hydra-canvas"></canvas>
      <pre id="hydra-error" class="error"></pre>
    </section>
    <aside class="panel" aria-label="Organism source layers">
      <div>
        <h2>Organism Preview</h2>
        <h1>Strudel + Hydra organism</h1>
      </div>
      <section>
        <h2>Strudel layer</h2>
        <pre>${safeMusic}</pre>
      </section>
      <section>
        <h2>Hydra visual layer</h2>
        <pre>${safeVisual}</pre>
      </section>
    </aside>
  </main>
  <script>
    window.fetch = undefined;
    window.XMLHttpRequest = undefined;
    window.WebSocket = undefined;
    window.EventSource = undefined;
    window.open = undefined;
    const errorEl = document.getElementById('hydra-error');
    try {
      const canvas = document.getElementById('hydra-canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const hydra = new Hydra({ canvas, detectAudio: false, enableStreamCapture: false });
      const go = () => {};
      const o = typeof o0 !== 'undefined' ? o0 : undefined;
      ${runnableVisual}
    } catch (e) {
      errorEl.style.display = 'block';
      errorEl.textContent = 'Hydra preview error: ' + e.message;
    }
  </script>
</body>
</html>`;
}

function resolveGuiBridgeProvider() {
  const providerConfig = resolveBridgeProviderConfig();
  applyBridgeProviderEnv(process.env, providerConfig);
  return providerConfig;
}

function createGuiBridgeLLM() {
  resolveGuiBridgeProvider();
  return new LLMClient({
    role: 'harness',
    temperature: 0.5,
    maxTokens: 4096,
  });
}

function unwrapConfigResult(result) {
  return result && typeof result.match === 'function'
    ? result.match((config) => config, () => null)
    : result;
}

function sanitizeRoles(roles = {}) {
  return Object.fromEntries(Object.entries(roles).map(([role, cfg]) => [role, {
    provider: cfg?.provider,
    baseUrl: cfg?.baseUrl,
    model: cfg?.model,
    apiKeyStored: Boolean(cfg?.apiKey),
  }]));
}

function sanitizeProviders(providers = {}) {
  return Object.fromEntries(Object.entries(providers).map(([provider, cfg]) => [provider, {
    baseUrl: cfg?.baseUrl,
    model: cfg?.model,
    apiKeyStored: Boolean(cfg?.apiKey),
  }]));
}

function sanitizeConfigForClient(config) {
  if (!config) return null;
  return {
    defaultProvider: config.defaultProvider,
    providers: sanitizeProviders(config.providers || {}),
    roles: sanitizeRoles(config.roles || {}),
    loop: config.loop,
    creative: config.creative,
    galleryPath: config.galleryPath,
  };
}

function mergeProviderConfigs(existing = {}, incoming = {}) {
  const merged = { ...existing };
  for (const [name, cfg] of Object.entries(incoming)) {
    const previous = existing[name] || {};
    merged[name] = {
      ...previous,
      ...cfg,
      apiKey: resolveSecretValue(cfg?.apiKey, previous.apiKey, cfg, previous),
    };
  }
  return merged;
}

function mergeRoleConfigs(existing = {}, incoming = {}) {
  const merged = { ...existing };
  for (const [role, cfg] of Object.entries(incoming)) {
    const previous = existing[role] || {};
    merged[role] = {
      ...previous,
      ...cfg,
      apiKey: resolveSecretValue(cfg?.apiKey, previous.apiKey, cfg, previous),
    };
  }
  return merged;
}

function resolveSecretValue(incoming, existing, incomingConfig = {}, existingConfig = {}) {
  if (incoming === STORED_SECRET_SENTINEL || incoming === undefined) {
    return isSameSecretTarget(incomingConfig, existingConfig) ? existing : undefined;
  }
  if (typeof incoming === 'string' && incoming.trim() === '') return undefined;
  return incoming;
}

function isSameSecretTarget(incoming = {}, existing = {}) {
  if (incoming.provider && existing.provider && incoming.provider !== existing.provider) return false;
  if (incoming.baseUrl && existing.baseUrl && incoming.baseUrl !== existing.baseUrl) return false;
  return true;
}

// F5: CSRF protection on SSE endpoints
function validateSSEOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next(); // no origin = non-browser client, allow
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return next();
    }
  } catch { /* invalid URL, deny */ }
  res.status(403).json({ error: 'Forbidden origin' });
}

/**
 * @param {string} [configPath] - Override path to ~/.liminal/config.json (e.g. for tests)
 * @param {number} [port] - Backend port (for preview URL in response)
 * @returns {import('express').Express}
 */
export function createApp(configPath, port = 5174) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    setStudioCommonSecurityHeaders(res);
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // --- B1: Auth middleware for sensitive POST routes ---
  const guiToken = process.env.LIMINAL_GUI_TOKEN;
  if (guiToken) {
    app.use((req, _res, next) => {
      if (req.method !== 'POST') return next();
      // /api/preview/run is exempt (low-sensitivity, iframe-driven)
      if (req.path === '/api/preview/run') return next();
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
      const provided = bearerToken || queryToken;
      if (provided !== guiToken) {
        _res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  // --- B2: Rate limiter for POST routes (30 req/min per IP) ---
  const rateLimitMap = new Map();
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 30;

  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now >= entry.resetAt) rateLimitMap.delete(ip);
    }
  }, 60_000).unref();

  app.use((req, _res, next) => {
    if (req.method !== 'POST') return next();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = rateLimitMap.get(ip);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      rateLimitMap.set(ip, entry);
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      _res.status(429).json({ error: 'Rate limited' });
      return;
    }
    next();
  });

  const getConfigPath = () =>
    // ATELIER_CONFIG_PATH is legacy compatibility for pre-Sinter installs.
    configPath || process.env.LIMINAL_CONFIG_PATH || process.env.ATELIER_CONFIG_PATH || path.join(process.env.HOME || '', '.liminal', 'config.json');

  const backendOrigin = `http://localhost:${port}`;

  app.post('/api/tui/session', (_req, res) => {
    try {
      const providerConfig = resolveGuiBridgeProvider();
      const status = tuiBridge.createSession({
        provider: providerConfig.provider,
        model: providerConfig.model,
        ...summarizeBridgeRuntime(process.env),
      });
      res.status(200).json(status);
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.get('/api/tui/session/:id/status', (req, res) => {
    try {
      res.status(200).json(tuiBridge.getStatus(req.params.id));
    } catch (err) {
      res.status(404).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/tui/session/:id/input', async (req, res) => {
    try {
      const result = await tuiBridge.submitInput(req.params.id, buildGuiBridgeInput(req.body), createGuiBridgeLLM());
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/tui/session/:id/actions/:actionId/confirm', async (req, res) => {
    try {
      await tuiBridge.confirmAction(req.params.id, req.params.actionId, createGuiBridgeLLM());
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/tui/session/:id/actions/:actionId/cancel', (req, res) => {
    try {
      tuiBridge.cancelAction(req.params.id, req.params.actionId);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/tui/session/:id/cancel', (req, res) => {
    try {
      tuiBridge.cancelRun(req.params.id);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.get('/api/tui/session/:id/events', validateSSEOrigin, (req, res) => {
    try {
      const sessionId = req.params.id;
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      setStudioCommonSecurityHeaders(res);
      res.flushHeaders();
      res.write(': connected\n\n');

      const lastEventId = Number(req.headers['last-event-id'] || 0) || 0;

      const replay = tuiBridge.getEventReplay();
      for (const stored of replay.replayAfter(sessionId, lastEventId)) {
        res.write(`id: ${stored.id}\n`);
        res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
      }

      const unsubscribe = replay.subscribeStored(sessionId, (stored) => {
        res.write(`id: ${stored.id}\n`);
        res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
      });
      const heartbeat = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      req.on('close', cleanup);
      req.on('error', cleanup);
      res.on('error', cleanup);
    } catch (err) {
      res.status(400).json({ error: err.message || String(err) });
    }
  });

  app.get('/api/config', async (_req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = unwrapConfigResult(await loadProjectConfig(process.cwd()));
      const effective = await getEffectiveConfig(cfgPath, process.cwd());

      const loop = {
        maxIterations: userConfig?.loop?.maxIterations ?? projectConfig?.loop?.maxIterations ?? DEFAULTS.loop.maxIterations,
        timeoutMinutes: userConfig?.loop?.timeoutMinutes ?? projectConfig?.loop?.timeoutMinutes ?? DEFAULTS.loop.timeoutMinutes,
      };
      const creative = {
        minQualityScore: userConfig?.creative?.minQualityScore ?? projectConfig?.creative?.minQualityScore ?? DEFAULTS.creative.minQualityScore,
      };
      const galleryPath = userConfig?.galleryPath ?? DEFAULTS.galleryPath;

      res.json({
        effective: {
          provider: effective.provider,
          baseUrl: effective.baseUrl ?? '',
          model: effective.model,
          apiKeyStored: Boolean(effective.apiKey),
        },
        loop,
        creative,
        galleryPath,
        roles: sanitizeRoles(userConfig?.roles || {}),
        userConfig: sanitizeConfigForClient(userConfig),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/improve/scan', (_req, res) => {
    try {
      const evidence = collectRepositoryOpportunityEvidence(process.cwd());
      res.status(200).json(scanGreenSystemOpportunities(evidence));
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.get('/api/gallery', async (_req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfigResult = await loadConfig(cfgPath);
      const userConfig = userConfigResult.match(c => c, () => null);
      const galleryPath = userConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedPath;
      try { resolvedPath = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedPath);
      const projects = await gallery.listProjectDirs();
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gallery/:project', async (req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfigResult = await loadConfig(cfgPath);
      const userConfig = userConfigResult.match(c => c, () => null);
      const galleryPath = userConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedPath;
      try { resolvedPath = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedPath);
      const projectDirName = decodeURIComponent(req.params.project || '');
      const iterations = await gallery.loadHistoryFromDir(projectDirName);
      res.json({ iterations });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gallery/:project/render', async (req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfigResult = await loadConfig(cfgPath);
      const userConfig = userConfigResult.match(c => c, () => null);
      const galleryPath = userConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedPath;
      try { resolvedPath = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedPath);
      const projectDirName = decodeURIComponent(req.params.project || '');
      const iterations = await gallery.loadHistoryFromDir(projectDirName);
      const last = iterations[iterations.length - 1];
      if (!last?.code) return res.status(404).json({ error: 'No renderable iteration' });
      const { HTMLWrapper } = await import('../dist/utils/htmlWrapper.js');
      const html = HTMLWrapper.wrap(last.code, { domain: undefined });
      setStageRenderHeaders(res);
      res.send(stageWrap(html));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const ARCHIVE_PATH = path.join(os.homedir(), '.sinter', 'archive', 'quality_archive.json');

  // The stage hangs works in a near-black room; the wrapper's default white
  // page would flood the frame when a piece draws smaller than the window.
  // Endpoint-level only — the vision-audit wrapper output must stay untouched.
  const STAGE_STYLE = '<style>html,body{background:#05070b !important;margin:0;min-height:100vh;display:grid;place-items:center;}</style>';
  function stageWrap(html) {
    return html.includes('</head>') ? html.replace('</head>', `${STAGE_STYLE}</head>`) : STAGE_STYLE + html;
  }

  // Stage renders ship the wrapper's own per-domain meta CSP (three/hydra need
  // jsdelivr/unpkg/eval, which the preview header CSP forbids). The header only
  // pins framing — meta CSP cannot set frame-ancestors.
  function setStageRenderHeaders(res) {
    setStudioCommonSecurityHeaders(res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  }

  function readArchiveEntries() {
    const raw = fs.readFileSync(ARCHIVE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const archives = data?.archives && typeof data.archives === 'object' ? data.archives : {};
    return Object.values(archives).flat().filter(
      (e) => e && typeof e.id === 'string' && typeof e.output === 'string' && typeof e.qualityScore === 'number',
    );
  }

  const PROGRESS_DOMAINS = ['p5', 'glsl', 'three', 'hydra', 'svg', 'ascii', 'textgen', 'kinetic'];
  const RENORMALIZATION_AT = Date.parse('2026-06-12T00:00:00Z');
  const DEFAULT_IFRAME_CAP = 8;
  const WEBGL_IFRAME_CAP = 2;
  const WEBGL_DOMAINS = new Set(['glsl', 'three', 'hydra']);

  function score(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function readProgressLedgerEntries() {
    const ledgerPath = process.env.SINTER_PROGRESS_LEDGER_PATH || path.join(cwd, 'docs', 'validation', 'self-improve-ledger.jsonl');
    try {
      return fs.readFileSync(ledgerPath, 'utf-8')
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  function modelEraForEntry(entry) {
    const recorded = entry?.metadata?.generatorModel;
    if (typeof recorded === 'string' && recorded.trim()) return { label: recorded.trim(), source: 'recorded' };
    const created = Date.parse(entry.createdAt || '');
    if (entry.domain === 'three' && Number.isFinite(created) && created >= Date.parse('2026-06-12T16:00:00Z')) {
      return { label: 'MiniMax-M3', source: 'era-derived' };
    }
    return { label: 'glm-5v-turbo', source: 'era-derived' };
  }

  function progressEntry(entry) {
    const model = modelEraForEntry(entry);
    const prior = score(entry?.metadata?.rescore?.priorScore);
    const current = score(entry.qualityScore) ?? 0;
    return {
      id: entry.id,
      domain: entry.domain,
      prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
      qualityScore: current,
      createdAt: entry.createdAt || '',
      modelLabel: model.label,
      modelSource: model.source,
      rescore: prior == null ? null : {
        priorScore: prior,
        currentScore: current,
        rescoredAt: entry.metadata?.rescore?.rescoredAt || null,
        provenance: entry.metadata?.rescore?.provenance || null,
      },
      renderMeasure: entry.metadata?.renderMeasure || null,
    };
  }

  function collectProgressData() {
    const archiveEntries = readArchiveEntries()
      .filter((entry) => PROGRESS_DOMAINS.includes(entry.domain))
      .filter((entry) => !entry.metadata?.quarantinedAt)
      .map(progressEntry);
    const entriesByDomain = {};
    const domains = PROGRESS_DOMAINS.map((domain) => {
      const entries = archiveEntries
        .filter((entry) => entry.domain === domain)
        .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
      entriesByDomain[domain] = entries;
      const ordered = [...entries].sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
      const values = entries.map((entry) => entry.qualityScore).filter((n) => Number.isFinite(n));
      return {
        domain,
        count: entries.length,
        top: values.length ? Math.max(...values) : null,
        floor: values.length ? Math.min(...values) : null,
        sparkline: ordered.map((entry) => ({ ts: entry.createdAt, score: entry.qualityScore })),
      };
    });
    const ledger = readProgressLedgerEntries();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const admittedLast24h = ledger.reduce((sum, line) => {
      const ts = Date.parse(line.ts || '');
      const admitted = typeof line.admitted === 'number' ? line.admitted : null;
      return admitted != null && Number.isFinite(ts) && ts >= dayAgo ? sum + admitted : sum;
    }, 0);
    const timeline = ledger.slice(-40).map((line) => ({
      ts: line.ts || '',
      targetedDomains: Array.isArray(line.targetedDomains) ? line.targetedDomains : [],
      scores: Array.isArray(line.scores) ? line.scores.filter((n) => Number.isFinite(Number(n))).map(Number) : [],
      admitted: typeof line.admitted === 'number' ? line.admitted : null,
      archive: line.after?.archive ?? null,
      honestScoresDivider: Number.isFinite(Date.parse(line.ts || '')) && Date.parse(line.ts) >= RENORMALIZATION_AT,
    }));
    return { generatedAt: new Date().toISOString(), admittedLast24h, domains, timeline, entriesByDomain };
  }

  function fmtScore(value) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '—';
  }

  function sparklineSvg(points) {
    const values = points.map((p) => Number(p.score)).filter(Number.isFinite);
    if (values.length < 2) return '<span class="progress-empty">not enough data</span>';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = points.map((p, i) => {
      const x = values.length === 1 ? 40 : (i / (points.length - 1)) * 120;
      const y = 34 - ((Number(p.score) - min) / range) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="spark" viewBox="0 0 120 40" role="img" aria-label="score trend"><polyline points="${coords}" /></svg>`;
  }

  function progressHeaderHtml(data) {
    return `<section class="progress-header" aria-label="Domain improvement summary">
      ${data.domains.map((domain) => `<article class="domain-strip">
        <div class="domain-strip__top"><strong>${escapeHtml(domain.domain)}</strong><span>${domain.count} pieces</span></div>
        ${sparklineSvg(domain.sparkline)}
        <div class="domain-strip__stats"><span>top ${fmtScore(domain.top)}</span><span>floor ${fmtScore(domain.floor)}</span></div>
      </article>`).join('')}
      <article class="domain-strip admitted-total"><div>admitted / 24h</div><strong>${data.admittedLast24h}</strong></article>
    </section>`;
  }

  function progressTimelineHtml(data) {
    let dividerShown = false;
    return `<section class="progress-panel" aria-label="Self-improvement cycle timeline">
      <div class="section-heading"><h2>Cycle timeline</h2><span>last ${data.timeline.length} daemon cycles</span></div>
      <div class="timeline">
        ${data.timeline.map((line) => {
          const showDivider = line.honestScoresDivider && !dividerShown;
          if (showDivider) dividerShown = true;
          return `${showDivider ? '<div class="renorm-divider">scores became honest here</div>' : ''}
            <article class="cycle ${line.admitted > 0 ? 'cycle--win' : ''}">
              <time>${escapeHtml(line.ts || 'unknown time')}</time>
              <span>${escapeHtml(line.targetedDomains.join(', ') || 'untargeted')}</span>
              <span>scores ${escapeHtml(line.scores.map(fmtScore).join(' / ') || '—')}</span>
              <strong>admitted ${line.admitted == null ? '—' : line.admitted}</strong>
            </article>`;
        }).join('')}
      </div>
    </section>`;
  }

  function contactSheetHtml(data) {
    return `<section class="progress-panel" aria-label="Archive contact sheet">
      <div class="section-heading"><h2>Contact sheet</h2><span>newest first, capped to avoid exhausting live WebGL contexts</span></div>
      ${PROGRESS_DOMAINS.map((domain) => {
        const entries = data.entriesByDomain[domain] || [];
        const iframeCap = WEBGL_DOMAINS.has(domain) ? WEBGL_IFRAME_CAP : DEFAULT_IFRAME_CAP;
        return `<section class="domain-section" data-domain="${escapeHtml(domain)}">
          <div class="domain-section__heading"><h3>${escapeHtml(domain)}</h3><span>${entries.length} visible archive entries</span></div>
          <div class="cards">
            ${entries.map((entry, index) => {
              const hidden = index >= iframeCap;
              const srcAttr = hidden ? `data-src="/api/archive/${encodeURIComponent(entry.id)}/render"` : `src="/api/archive/${encodeURIComponent(entry.id)}/render"`;
              const prompt = entry.prompt.length > 140 ? `${entry.prompt.slice(0, 140)}…` : entry.prompt;
              return `<article class="piece-card ${hidden ? 'piece-card--hidden' : ''}" ${hidden ? 'hidden' : ''}>
                <iframe loading="lazy" sandbox="allow-scripts" title="${escapeHtml(`${entry.domain} ${entry.id}`)}" ${srcAttr}></iframe>
                <div class="piece-card__meta">
                  <span class="score">score ${fmtScore(entry.qualityScore)}</span>
                  ${entry.rescore ? `<span class="rescore">${fmtScore(entry.rescore.priorScore)} → ${fmtScore(entry.rescore.currentScore)}</span>` : ''}
                  <span>model (era-derived): ${escapeHtml(entry.modelSource === 'recorded' ? `${entry.modelLabel} recorded` : entry.modelLabel)}</span>
                  <time>${escapeHtml(entry.createdAt || 'unknown date')}</time>
                  <p title="${escapeHtml(entry.prompt)}">${escapeHtml(prompt || 'untitled generation')}</p>
                  <code>${escapeHtml(entry.id)}</code>
                </div>
              </article>`;
            }).join('')}
          </div>
          ${entries.length > iframeCap ? `<button class="show-all" type="button" data-domain="${escapeHtml(domain)}">show all ${entries.length}</button>` : ''}
        </section>`;
      }).join('')}
    </section>`;
  }

  function progressDashboardHtml(data) {
    const initialJson = escapeScript(JSON.stringify(data));
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Sinter Progress</title>
      <style>
        :root{color-scheme:dark;--sinter-bg-void:#07090d;--sinter-surface-1:#121720;--sinter-surface-2:#191f2b;--sinter-text:#eef3ff;--sinter-muted:#9aa7bd;--sinter-cyan:#59e1ff;--font-display:'JetBrains Mono',ui-monospace,Menlo,monospace;--font-mono:'JetBrains Mono',ui-monospace,monospace}
        *{box-sizing:border-box} body{margin:0;background:var(--sinter-bg-void);color:var(--sinter-text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif} .progress-page{max-width:1480px;margin:0 auto;padding:24px}
        .hero{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:22px}.hero h1{margin:0;font:700 clamp(2rem,5vw,4.5rem)/.9 var(--font-display);letter-spacing:-.06em}.hero p{max-width:760px;color:var(--sinter-muted)}.hero a{color:var(--sinter-cyan)}#last-updated{font-family:var(--font-mono);color:var(--sinter-muted)}
        .progress-header{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}.domain-strip,.progress-panel{background:var(--sinter-surface-1);border:1px solid rgba(145,161,190,.18);border-radius:14px}.domain-strip{min-height:124px;padding:12px}.domain-strip__top,.domain-strip__stats,.section-heading,.domain-section__heading,.piece-card__meta{display:flex;justify-content:space-between;gap:10px}.domain-strip strong,.section-heading h2,.domain-section h3{font-family:var(--font-display)}.domain-strip span,.section-heading span,.domain-section span{color:var(--sinter-muted);font-size:.82rem}.admitted-total{display:grid;place-content:center;text-align:center}.admitted-total strong{font-size:3rem;color:var(--sinter-cyan)}
        .spark{width:100%;height:42px}.spark polyline{fill:none;stroke:var(--sinter-cyan);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.progress-empty{display:grid;place-items:center;height:42px;color:var(--sinter-muted);font:12px var(--font-mono)}
        .progress-panel{padding:16px;margin:18px 0}.section-heading{align-items:baseline;margin-bottom:14px}.section-heading h2,.domain-section h3{margin:0}.timeline{display:grid;gap:8px}.cycle{display:grid;grid-template-columns:minmax(210px,.9fr) minmax(160px,1fr) minmax(160px,1fr) 110px;gap:10px;align-items:center;padding:10px 12px;background:var(--sinter-surface-2);border-radius:10px;color:var(--sinter-muted);font-family:var(--font-mono);font-size:.82rem}.cycle--win{border:1px solid var(--sinter-cyan);box-shadow:0 0 0 1px rgba(89,225,255,.18)}.cycle--win strong{color:var(--sinter-cyan)}.renorm-divider{margin:10px 0;padding:8px 12px;border-left:3px solid var(--sinter-cyan);color:var(--sinter-cyan);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.12em;font-size:.72rem}
        .domain-section{margin:22px 0}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.piece-card{background:var(--sinter-surface-2);border:1px solid rgba(145,161,190,.18);border-radius:12px;overflow:hidden}.piece-card iframe{width:100%;height:180px;border:0;background:#05070b}.piece-card__meta{flex-direction:column;padding:12px;font-size:.82rem;color:var(--sinter-muted)}.score{color:var(--sinter-text);font-weight:700}.rescore{color:var(--sinter-cyan);font-family:var(--font-mono)}.piece-card p{margin:0;color:var(--sinter-text)}code{font-family:var(--font-mono);color:var(--sinter-muted);word-break:break-all}.show-all{margin-top:12px;background:transparent;color:var(--sinter-cyan);border:1px solid var(--sinter-cyan);border-radius:999px;padding:8px 13px;font:700 .82rem var(--font-mono);cursor:pointer}
        @media (max-width:760px){.hero,.cycle{display:block}.cycle>*{display:block;margin:3px 0}}
      </style></head><body><main class="progress-page">
        <header class="hero"><div><h1>Progress</h1><p>Visual proof of Sinter's self-improvement loop: score trend, daemon admissions, rescored honesty deltas, and archive provenance.</p></div><div id="last-updated">last updated ${escapeHtml(data.generatedAt)}</div></header>
        <div id="progress-header">${progressHeaderHtml(data)}</div>
        <div id="progress-timeline">${progressTimelineHtml(data)}</div>
        ${contactSheetHtml(data)}
      </main><script>
        window.__PROGRESS_DATA__=${initialJson};
        const fmt=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'—';
        function attachShowAll(){document.querySelectorAll('.show-all').forEach(button=>button.addEventListener('click',()=>{const section=document.querySelector('.domain-section[data-domain="'+button.dataset.domain+'"]');section.querySelectorAll('.piece-card[hidden]').forEach(card=>{card.hidden=false;const frame=card.querySelector('iframe[data-src]');if(frame&&!frame.src)frame.src=frame.dataset.src;});button.remove();}));}
        async function refreshProgress(){try{const res=await fetch('/api/progress/data',{cache:'no-store'});if(!res.ok)return;const data=await res.json();document.getElementById('last-updated').textContent='last updated '+data.generatedAt;}catch{}}
        attachShowAll(); setInterval(refreshProgress,60000);
      </script></body></html>`;
  }

  app.get('/api/progress/data', (_req, res) => {
    try {
      res.json(collectProgressData());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/progress', (_req, res) => {
    try {
      setStudioCommonSecurityHeaders(res);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(progressDashboardHtml(collectProgressData()));
    } catch (err) {
      res.status(500).send(`Progress dashboard failed: ${escapeHtml(err.message)}`);
    }
  });

  app.get('/api/archive/tops', (req, res) => {
    try {
      const entries = readArchiveEntries();
      const limit = Math.min(Number(req.query.limit) || 12, 50);
      // Curate for diversity: each domain's best first, then fill by score.
      const byScore = [...entries].sort((a, b) => b.qualityScore - a.qualityScore);
      const seen = new Set();
      const domainBests = byScore.filter((e) => !seen.has(e.domain) && seen.add(e.domain));
      const rest = byScore.filter((e) => !domainBests.includes(e));
      const tops = [...domainBests, ...rest].slice(0, limit).map((e) => ({
        id: e.id,
        domain: e.domain,
        prompt: e.prompt,
        qualityScore: e.qualityScore,
        createdAt: e.createdAt,
      }));
      res.json({ tops });
    } catch (err) {
      if (err.code === 'ENOENT') return res.json({ tops: [] });
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/archive/:id/render', async (req, res) => {
    try {
      const id = decodeURIComponent(req.params.id || '');
      const entry = readArchiveEntries().find((e) => e.id === id);
      if (!entry) return res.status(404).json({ error: 'Archive entry not found' });
      // Same domain mapping as scripts/quality/archive-measure.mjs: ascii and
      // textgen are plain text (pre), kinetic entries are already full HTML,
      // and the wrapper's name for glsl is 'shader'.
      let html;
      if (entry.domain === 'ascii' || entry.domain === 'textgen') {
        const text = entry.output;
        const lines = text.split('\n');
        const longest = Math.max(1, ...lines.map((line) => line.length));
        const fontPx = Math.max(14, Math.min(34, Math.floor(Math.min((900 * 0.9) / (longest * 0.6), (600 * 0.9) / (lines.length * 1.25)))));
        html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#06080f;color:#cfe;font:${fontPx}px ui-monospace,Menlo,monospace;display:flex;align-items:center;justify-content:center}pre{padding:18px;white-space:pre;line-height:1.25}</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
      } else if (entry.domain === 'kinetic') {
        // Kinetic entries are complete HTML pages with their own layout —
        // injecting the stage's grid/centering body style collapses them to
        // black. Serve untouched.
        setStageRenderHeaders(res);
        return res.send(entry.output);
      } else {
        const { HTMLWrapper } = await import('../dist/utils/htmlWrapper.js');
        const wrapperDomain = entry.domain === 'glsl' ? 'shader' : entry.domain;
        html = HTMLWrapper.wrap(entry.output, { domain: wrapperDomain });
      }
      setStageRenderHeaders(res);
      res.send(stageWrap(html));
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Archive not found' });
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/config', async (req, res) => {
    try {
      const cfgPath = getConfigPath();
      const body = req.body || {};
      const existing = unwrapConfigResult(await loadConfig(cfgPath));

      const defaultProvider = body.defaultProvider ?? existing?.defaultProvider ?? 'lmstudio';
      const providers = mergeProviderConfigs(existing?.providers || {}, body.providers || {});
      const roles = mergeRoleConfigs(existing?.roles || {}, body.roles || {});

      const config = {
        defaultProvider,
        providers,
        roles,
        loop: body.loop ?? existing?.loop,
        creative: body.creative ?? existing?.creative,
        galleryPath: body.galleryPath ?? existing?.galleryPath,
      };
      await saveConfig(config, cfgPath);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Run in preview: store code and return URL to preview it
  app.post('/api/preview/run', (req, res) => {
    try {
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      const version = Number.isInteger(req.body?.version) && req.body.version > 0 ? req.body.version : 1;
      previewStore.set(version, code);
      const url = `${backendOrigin}/preview?version=${version}`;
      res.status(200).json({ url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve preview page (p5 + stored code) so iframe can show the sketch
  app.get('/preview', (req, res) => {
    const version = Math.max(1, parseInt(String(req.query.version), 10) || 1);
    const code = previewStore.get(version);
    if (typeof code !== 'string') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Permissions-Policy" content="accelerometer=(), gyroscope=(), magnetometer=(), deviceorientation=(), devicemotion=()">
  <title>Preview unavailable</title>
  <style>body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #07090d; color: #eef3ff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; } main { max-width: 560px; padding: 24px; border: 1px solid rgba(145, 161, 190, 0.34); border-radius: 16px; background: rgba(18, 23, 32, 0.92); } h1 { margin: 0 0 8px; font-size: 20px; } p { margin: 0; color: #9aa7bd; line-height: 1.5; }</style>
</head>
<body>
  <main>
    <h1>Preview expired or missing</h1>
    <p>This preview no longer has stored code. Run the artifact again from Sinter Studio to create a fresh sandboxed preview.</p>
  </main>
</body>
</html>`;
      setPreviewSecurityHeaders(res);
      res.status(404).send(html);
      return;
    }
    const organismPreview = parseOrganismPreview(code);
    if (organismPreview) {
      setPreviewSecurityHeaders(res, { profile: 'organism' });
      res.send(renderOrganismPreview(organismPreview, version));
      return;
    }
    const escaped = code.replace(/<\/script>/gi, '<\\/script>');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Permissions-Policy" content="accelerometer=(), gyroscope=(), magnetometer=(), deviceorientation=(), devicemotion=()">
  <title>Preview v${version}</title>
  <style>
    :root { color-scheme: dark; }
    html, body {
      margin: 0;
      min-height: 100vh;
      background: #05070d;
      overflow: hidden;
    }
    body {
      display: grid;
      place-items: center;
    }
    canvas {
      display: block;
      max-width: 100vw;
      max-height: 100vh;
      width: min(100vw, 960px) !important;
      height: auto !important;
      background: #05070d;
      box-shadow: 0 22px 80px rgba(0, 0, 0, 0.34);
    }
  </style>
  ${P5_SENSOR_POLICY_SCRIPT}
  <script src="${P5_CDN}" integrity="sha384-bOv+b6RV+dlZvdQAx6+cJ+FK9ab8JCSVWyJ1JPhMVQjPW+4C8V2cOKK+qZDfnRnx" crossorigin="anonymous"></script>
</head>
<body data-sinter-p5-preview-shell>
  <script>
    // Wave 3 isolation: strip network access before running generated code
    window.fetch = undefined;
    window.XMLHttpRequest = undefined;
    window.WebSocket = undefined;
    window.EventSource = undefined;
    window.open = undefined;
    try {
      ${escaped}
    } catch(e) {
      document.body.innerHTML = '<pre style="color:#f66;padding:12px;font-family:monospace">Preview error: ' + e.message + '</pre>';
    }
  </script>
</body>
</html>`;
    setPreviewSecurityHeaders(res);
    res.send(html);
  });

  // Run the Ralph loop (generate art from prompt)
  app.post('/api/run', async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        return res.status(400).json({ error: 'prompt is required' });
      }
      const mode = req.body?.mode === 'organism' ? 'organism' : 'p5';
      const traits = req.body?.traits && typeof req.body.traits === 'object' ? req.body.traits : {};
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const outputDir = path.join(cwd, 'output');
      const projectName = req.body?.project || `gui-${Date.now()}`;
      const maxIterations = Math.min(20, Math.max(1, parseInt(req.body?.maxIterations, 10) || 3));

      if (mode === 'organism') {
        const gallery = new Gallery(resolvedGallery);
        const useLLM = req.body?.useLLM !== false;
        if (useLLM) {
          const { generateMusicToVisual } = await import('../dist/index.js');
          for (let i = 1; i <= maxIterations; i++) {
            const result = await generateMusicToVisual(prompt, {
              traits: { bpm: traits.bpm, palette: traits.palette },
            });
            await gallery.saveOrganism(projectName, i, result.musicCode, result.visualCode);
          }
        } else {
          for (let i = 1; i <= maxIterations; i++) {
            const result = buildDeterministicOrganism(`${prompt} iteration ${i}`, traits);
            await gallery.saveOrganism(projectName, i, result.musicCode, result.visualCode);
          }
        }
        const dateStr = new Date().toISOString().split('T')[0];
        const projectDirName = `${dateStr}--${projectName}`;
        return res.status(200).json({
          ok: true,
          result: { code: '', iterations: maxIterations, completed: true, reason: 'organism run', finalScore: 1, project: projectName },
          projectDirName,
        });
      }

      const { run, RalphLoop } = await import('../dist/index.js');
      RalphLoop.reset();

      // Build LoopOptions from request body
      const loopOptions = {
        maxIterations,
        output: outputDir,
        galleryDir: resolvedGallery,
        project: projectName,
        minQualityScore: req.body?.minQualityScore ?? undefined,
        evaluationStrategy: req.body?.evaluationStrategy ?? undefined,
        stagnationThreshold: req.body?.stagnationThreshold ?? undefined,
        mergeEveryN: req.body?.mergeEveryN ?? undefined,
        useMapElites: req.body?.useMapElites === true,
        mapElitesDims: req.body?.mapElitesDims ?? undefined,
        useDeepCollab: req.body?.useDeepCollab === true,
        useCollab: req.body?.useCollab === true,
        collabMode: req.body?.collabMode ?? undefined,
        collabDomain: req.body?.collabDomain ?? undefined,
        useSwarm: req.body?.useSwarm === true,
        swarmMode: req.body?.swarmMode ?? undefined,
        useArchiveLearning: req.body?.useArchiveLearning === true,
        useAestheticModel: req.body?.useAestheticModel === true,
        autoCompost: req.body?.autoCompost === true,
        tolerateErrors: req.body?.tolerateErrors === true,
        maxContextLength: req.body?.maxContextLength ?? undefined,
      };

      const result = await run(prompt, loopOptions);
      res.status(200).json({
        ok: true,
        result: {
          code: result.code,
          iterations: result.iterations,
          completed: result.completed,
          reason: result.reason,
          finalScore: result.finalScore,
          project: result.project,
        },
        projectDirName: `${new Date().toISOString().split('T')[0]}--${projectName}`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Live Music: generate Strudel / Hydra code from prompt
  app.post('/api/live-music/music', async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : 'ambient';
      const { generateMusic } = await import('../dist/index.js');
      const out = await generateMusic({ prompt, platform: 'strudel' });
      res.status(200).json({ code: out.code });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/live-music/visuals', async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : 'reactive';
      const { generateVisuals } = await import('../dist/index.js');
      const out = await generateVisuals({ prompt, platform: 'hydra' });
      res.status(200).json({ code: out.code });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Merge two iterations into a proposed organism/p5 (no save)
  app.post('/api/merge', async (req, res) => {
    try {
      const dirName = req.body?.dirName;
      const versionA = parseInt(req.body?.versionA, 10);
      const versionB = parseInt(req.body?.versionB, 10);
      if (!dirName || !Number.isInteger(versionA) || !Number.isInteger(versionB) || versionA < 1 || versionB < 1) {
        return res.status(400).json({ error: 'dirName, versionA, versionB (positive integers) are required' });
      }
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const iterA = history.find((i) => i.version === versionA);
      const iterB = history.find((i) => i.version === versionB);
      if (!iterA || !iterB) {
        return res.status(400).json({ error: 'One or both versions not found', code: 'VERSIONS_NOT_FOUND' });
      }
      const codeA = 'code' in iterA ? iterA.code : null;
      const codeB = 'code' in iterB ? iterB.code : null;
      if (codeA != null && codeB != null) {
        const { mergeSketchCode } = await import('../dist/utils/mergeSketchCode.js');
        const merged = mergeSketchCode(codeA, codeB);
        return res.status(200).json({ proposed: { type: 'p5', code: merged } });
      }
      const musicA = iterA.type === 'organism' ? iterA.musicCode : '';
      const visualA = iterA.type === 'organism' ? iterA.visualCode : '';
      const musicB = iterB.type === 'organism' ? iterB.musicCode : '';
      const visualB = iterB.type === 'organism' ? iterB.visualCode : '';
      const proposed = { type: 'organism', musicCode: musicA || musicB, visualCode: visualB || visualA };
      res.status(200).json({ proposed });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Approve proposed iteration and save as next version
  app.post('/api/approve', async (req, res) => {
    try {
      const dirName = req.body?.dirName;
      const proposed = req.body?.proposed;
      if (!dirName || !proposed) {
        return res.status(400).json({ error: 'dirName and proposed are required' });
      }
      if (proposed.type && !['p5', 'organism'].includes(proposed.type)) {
        return res.status(400).json({ error: 'Invalid proposed type' });
      }
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const nextVersion = history.length === 0 ? 1 : Math.max(...history.map((i) => i.version)) + 1;
      const projectName = dirName.replace(/^\d{4}-\d{2}-\d{2}--/, '');
      if (proposed.type === 'organism' && proposed.musicCode != null && proposed.visualCode != null) {
        await gallery.saveOrganism(projectName, nextVersion, proposed.musicCode, proposed.visualCode);
        logSecurityEvent({ type: 'gallery_write', severity: 'low', message: `Saved organism ${projectName} v${nextVersion}`, context: { endpoint: '/api/approve' } });
      } else {
        const code = proposed.code != null ? proposed.code : (proposed.musicCode || '') + '\n' + (proposed.visualCode || '');
        await gallery.saveIteration(projectName, nextVersion, code);
        logSecurityEvent({ type: 'gallery_write', severity: 'low', message: `Saved iteration ${projectName} v${nextVersion}`, context: { endpoint: '/api/approve' } });
      }
      res.status(200).json({ ok: true, version: nextVersion });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Propose-mutate: traits-only (deterministic) or creative (LLM)
  app.post('/api/propose-mutate', async (req, res) => {
    try {
      const dirName = req.body?.dirName;
      const version = parseInt(req.body?.version, 10);
      const traits = req.body?.traits && typeof req.body.traits === 'object' ? req.body.traits : {};
      const creative = req.body?.creative === true;
      if (!dirName || !Number.isInteger(version) || version < 1) {
        return res.status(400).json({ error: 'dirName and version (positive integer) are required' });
      }
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const iter = history.find((i) => i.version === version);
      if (!iter) return res.status(400).json({ error: 'Version not found', code: 'VERSION_NOT_FOUND' });
      const prompt = req.body?.prompt || 'ambient';
      if (creative) {
        const { LLMClient } = await import('../dist/llm/LLMClient.js');
        const client = new LLMClient();
        const musicCode = iter.type === 'organism' ? iter.musicCode : iter.code;
        const visualCode = iter.type === 'organism' ? iter.visualCode : iter.code;
        const resp = await client.improveP5Sketch(musicCode + '\n\n' + visualCode);
        return res.status(200).json({ proposed: { type: 'p5', code: resp.code } });
      }
      const seed = iter.type === 'organism'
        ? { musicCode: iter.musicCode, visualCode: iter.visualCode }
        : { musicCode: '', visualCode: iter.code || '' };
      const proposed = buildDeterministicOrganism(prompt, traits, seed);
      res.status(200).json({ proposed });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Compost seeds: serve seeds.json for the GUI browser
  app.get('/api/seeds', (_req, res) => {
    try {
      const seedsPath = path.join(cwd, 'compost', 'seeds', 'seeds.json');
      if (!fs.existsSync(seedsPath)) {
        return res.json({ seeds: [], total: 0 });
      }
      const raw = fs.readFileSync(seedsPath, 'utf-8');
      const seeds = JSON.parse(raw);
      const total = Array.isArray(seeds) ? seeds.length : 0;
      res.json({ seeds: Array.isArray(seeds) ? seeds : [], total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Compost status: heap/seed/soup overview
  app.get('/api/compost/status', async (_req, res) => {
    try {
      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { LLMClient } = await import('../dist/llm/LLMClient.js');
      const llm = new LLMClient({ role: 'generator' });
      const mill = new CompostMill(llm);
      const status = await mill.statusAsync();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SSE event stream — mirrors PreviewServer for GUI frontend
  const sseClients = new Set();

  // Forward events from the singleton eventBus to SSE clients
  eventBus.onEvent((event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of sseClients) {
      try { client.write(payload); } catch { sseClients.delete(client); }
    }
  });

  app.get('/api/events', validateSSEOrigin, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    setStudioCommonSecurityHeaders(res);
    res.flushHeaders();
    res.write(': connected\n\n');

    const recent = eventBus.getRecentEvents();
    for (const event of recent) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    req.on('error', () => sseClients.delete(res));
    res.on('error', () => sseClients.delete(res));
  });

  // System status — heap/seed/soup counts + recent events
  app.get('/api/status', async (_req, res) => {
    try {
      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { mergeConfig } = await import('../dist/compost/defaults.js');
      const { LLMClient } = await import('../dist/llm/LLMClient.js');
      const llm = new LLMClient({ role: 'generator' });
      const mill = new CompostMill(llm, mergeConfig());
      const millStatus = await mill.statusAsync();
      res.json({
        heapSize: millStatus.heapSize,
        heapFileCount: millStatus.heapFileCount,
        seedCount: millStatus.seedCount,
        soupRunning: millStatus.soupRunning,
        loopProgress: null,
        recentEvents: eventBus.getRecentEvents().slice(-20),
      });
    } catch (err) {
      res.json({ error: err instanceof Error ? err.message : 'Status unavailable' });
    }
  });

  // Compost dashboard — full heap/seed/soup stats with top seeds
  app.get('/api/compost/dashboard', async (_req, res) => {
    try {
      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { mergeConfig } = await import('../dist/compost/defaults.js');
      const { LLMClient } = await import('../dist/llm/LLMClient.js');
      const llm = new LLMClient({ role: 'generator' });
      const mill = new CompostMill(llm, mergeConfig());
      const [millStatus, topSeeds, seedCount] = await Promise.all([
        mill.statusAsync(),
        mill.getTopSeeds(10),
        mill.getSeedCount(),
      ]);
      res.json({
        heap: { size: millStatus.heapSize, fileCount: millStatus.heapFileCount },
        seeds: { count: seedCount, top: topSeeds.map(s => ({ id: s.id, score: s.score, domain: s.source?.domains?.[0] ?? 'unknown', preview: s.content.slice(0, 100) })) },
        soup: { running: millStatus.soupRunning },
        shouldAutoDigest: await mill.shouldAutoDigest(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Feed gallery output to compost heap
  app.post('/api/compost/add', async (req, res) => {
    try {
      const dirName = req.body?.dirName;
      const version = parseInt(req.body?.version, 10);
      if (!dirName || !Number.isInteger(version) || version < 1) {
        return res.status(400).json({ error: 'dirName and version (positive integer) are required' });
      }
      const cfgPath = getConfigPath();
      const userConfig = unwrapConfigResult(await loadConfig(cfgPath));
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const iter = history.find((i) => i.version === version);
      if (!iter) return res.status(400).json({ error: 'Version not found' });

      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { mergeConfig } = await import('../dist/compost/defaults.js');
      const { LLMClient } = await import('../dist/llm/LLMClient.js');
      const llm = new LLMClient({ role: 'generator' });
      const mill = new CompostMill(llm, mergeConfig());
      const code = 'code' in iter ? iter.code : (iter.musicCode + '\n' + iter.visualCode);
      // Write to temp file and add to heap
      const fs = await import('fs/promises');
      const tmpDir = path.join(cwd, 'compost', 'heap', '_gui');
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `gui-${dirName}-v${version}.js`);
      await fs.writeFile(tmpFile, code, 'utf-8');
      await mill.add([tmpFile]);
      res.json({ ok: true, message: 'Added to compost heap' });
    } catch (err) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  return app;
}

export default createApp;
