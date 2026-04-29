/**
 * GUI backend: Express app that serves config API and (later) run() from dist/index.js.
 * Export createApp(configPath) for testing; start.js calls createApp() and listen().
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { loadConfig, loadProjectConfig, getEffectiveConfig, saveConfig } from '../dist/config/ConfigLoader.js';
import { Gallery } from '../dist/gallery/Gallery.js';
import { eventBus } from '../dist/core/EventBus.js';
import { TuiBridgeService } from '../dist/tui-bridge/TuiBridgeService.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig, summarizeBridgeRuntime } from '../dist/tui-bridge/BridgeLauncherConfig.js';
import { LLMClient } from '../dist/llm/LLMClient.js';
import { logSecurityEvent } from '../dist/security/SecurityLogger.js';
import { collectRepositoryOpportunityEvidence, scanGreenSystemOpportunities } from '../dist/improvement/OpportunityScanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();
const homeDir = process.env.HOME || '';

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
  if (path.isAbsolute(galleryPath)) {
    if (!canonical.startsWith(cwd) && !canonical.startsWith(homeDir)) {
      throw new Error('Invalid gallery path');
    }
  } else {
    if (!canonical.startsWith(cwd)) {
      throw new Error('Invalid gallery path');
    }
  }
  return canonical;
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

function setPreviewSecurityHeaders(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', [
    "default-src 'none'",
    "upgrade-insecure-requests",
    "script-src 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'unsafe-inline'",
    "img-src * data: blob:",
    "media-src * data: blob:",
    "connect-src 'none'",
    "font-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
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
    // ATELIER_CONFIG_PATH is legacy compatibility for pre-Liminal installs.
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
      const result = await tuiBridge.submitInput(req.params.id, {
        mode: req.body?.mode || 'chat',
        text: req.body?.text || '',
        clientIntent: req.body?.clientIntent,
      }, createGuiBridgeLLM());
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
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.flushHeaders();
      res.write(': connected\n\n');

      const lastEventId = Number(req.headers['last-event-id'] || 0) || 0;

      for (const stored of tuiBridge.getEventsSince(sessionId, lastEventId)) {
        res.write(`id: ${stored.id}\n`);
        res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
      }

      const unsubscribe = tuiBridge.subscribeWithId(sessionId, (stored) => {
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
    <p>This preview no longer has stored code. Run the artifact again from Liminal Studio to create a fresh sandboxed preview.</p>
  </main>
</body>
</html>`;
      setPreviewSecurityHeaders(res);
      res.status(404).send(html);
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
  <style>body { margin: 0; padding: 0; overflow: hidden; } canvas { display: block; }</style>
  ${P5_SENSOR_POLICY_SCRIPT}
  <script src="${P5_CDN}" integrity="sha384-bOv+b6RV+dlZvdQAx6+cJ+FK9ab8JCSVWyJ1JPhMVQjPW+4C8V2cOKK+qZDfnRnx" crossorigin="anonymous"></script>
</head>
<body>
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
      const userConfig = await loadConfig(cfgPath);
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      let resolvedGallery;
      try { resolvedGallery = validateGalleryPath(galleryPath); } catch { return res.status(400).json({ error: 'Invalid gallery path' }); }
      const outputDir = path.join(cwd, 'output');
      const projectName = req.body?.project || `gui-${Date.now()}`;
      const maxIterations = Math.min(20, Math.max(1, parseInt(req.body?.maxIterations, 10) || 3));

      if (mode === 'organism') {
        const { generateMusicToVisual } = await import('../dist/index.js');
        const gallery = new Gallery(resolvedGallery);
        for (let i = 1; i <= maxIterations; i++) {
          const result = await generateMusicToVisual(prompt, {
            traits: { bpm: traits.bpm, palette: traits.palette },
          });
          await gallery.saveOrganism(projectName, i, result.musicCode, result.visualCode);
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
      const userConfig = await loadConfig(cfgPath);
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
      const userConfig = await loadConfig(cfgPath);
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
      const userConfig = await loadConfig(cfgPath);
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
      const { generateMusicToVisual } = await import('../dist/index.js');
      const result = await generateMusicToVisual(prompt, { traits: { bpm: traits.bpm, palette: traits.palette } });
      res.status(200).json({ proposed: { type: 'organism', musicCode: result.musicCode, visualCode: result.visualCode } });
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
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
      const userConfig = await loadConfig(cfgPath);
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
