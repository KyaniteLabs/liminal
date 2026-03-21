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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

const DEFAULTS = {
  loop: { maxIterations: 20, timeoutMinutes: 30 },
  creative: { minQualityScore: 0.7 },
  galleryPath: 'gallery',
};

// In-memory store for "Run in sandbox" so GET /preview can serve the code
const sandboxStore = new Map();

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';

/**
 * @param {string} [configPath] - Override path to ~/.atelier/config.json (e.g. for tests)
 * @param {number} [port] - Backend port (for sandbox preview URL in response)
 * @returns {import('express').Express}
 */
export function createApp(configPath, port = 5174) {
  const app = express();
  app.use(express.json());

  const getConfigPath = () =>
    configPath || process.env.LIMINAL_CONFIG_PATH || process.env.ATELIER_CONFIG_PATH || path.join(process.env.HOME || '', '.liminal', 'config.json');

  const backendOrigin = `http://localhost:${port}`;

  app.get('/api/config', async (_req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfig = await loadConfig(cfgPath);
      const projectConfig = await loadProjectConfig(process.cwd());
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
          apiKey: effective.apiKey ?? '',
        },
        loop,
        creative,
        galleryPath,
        userConfig,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gallery', async (_req, res) => {
    try {
      const cfgPath = getConfigPath();
      const userConfig = await loadConfig(cfgPath);
      const projectConfig = await loadProjectConfig(process.cwd());
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      const resolvedPath = path.isAbsolute(galleryPath) ? galleryPath : path.join(process.cwd(), galleryPath);
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
      const userConfig = await loadConfig(cfgPath);
      const projectConfig = await loadProjectConfig(process.cwd());
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      const resolvedPath = path.isAbsolute(galleryPath) ? galleryPath : path.join(process.cwd(), galleryPath);
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
      const existing = await loadConfig(cfgPath);

      const defaultProvider = body.defaultProvider ?? existing?.defaultProvider ?? 'lmstudio';
      const providers = { ...(existing?.providers || {}), ...(body.providers || {}) };

      const config = {
        defaultProvider,
        providers,
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

  // Run in sandbox: store code and return URL to preview it
  app.post('/api/sandbox/run', (req, res) => {
    try {
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      const version = Number.isInteger(req.body?.version) && req.body.version > 0 ? req.body.version : 1;
      sandboxStore.set(version, code);
      const url = `${backendOrigin}/preview?version=${version}`;
      res.status(200).json({ url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve preview page (p5 + stored code) so iframe can show the sketch
  app.get('/preview', (req, res) => {
    const version = Math.max(1, parseInt(String(req.query.version), 10) || 1);
    const code = sandboxStore.get(version) || 'function setup(){ createCanvas(400,400); } function draw(){ background(100); }';
    const escaped = code.replace(/<\/script>/gi, '<\\/script>');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Permissions-Policy" content="accelerometer=(), gyroscope=(), magnetometer=(), deviceorientation=(), devicemotion=()">
  <title>Preview v${version}</title>
  <style>body { margin: 0; padding: 0; overflow: hidden; } canvas { display: block; }</style>
  <script src="${P5_CDN}"></script>
</head>
<body>
  <script>${escaped}</script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
      const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);
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
      const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);
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
      const cfgPath = getConfigPath();
      const userConfig = await loadConfig(cfgPath);
      const projectConfig = await loadProjectConfig(cwd);
      const galleryPath = userConfig?.galleryPath ?? projectConfig?.galleryPath ?? DEFAULTS.galleryPath;
      const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const nextVersion = history.length === 0 ? 1 : Math.max(...history.map((i) => i.version)) + 1;
      const projectName = dirName.replace(/^\d{4}-\d{2}-\d{2}--/, '');
      if (proposed.type === 'organism' && proposed.musicCode != null && proposed.visualCode != null) {
        await gallery.saveOrganism(projectName, nextVersion, proposed.musicCode, proposed.visualCode);
      } else {
        const code = proposed.code != null ? proposed.code : (proposed.musicCode || '') + '\n' + (proposed.visualCode || '');
        await gallery.saveIteration(projectName, nextVersion, code);
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
      const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);
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
      const mill = new CompostMill();
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

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const recent = eventBus.getRecentEvents();
    for (const event of recent) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
  });

  // System status — heap/seed/soup counts + recent events
  app.get('/api/status', async (_req, res) => {
    try {
      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { mergeConfig } = await import('../dist/compost/defaults.js');
      const mill = new CompostMill(mergeConfig());
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
      const mill = new CompostMill(mergeConfig());
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
      const resolvedGallery = path.isAbsolute(galleryPath) ? galleryPath : path.join(cwd, galleryPath);
      const gallery = new Gallery(resolvedGallery);
      const history = await gallery.loadHistoryFromDir(dirName);
      const iter = history.find((i) => i.version === version);
      if (!iter) return res.status(400).json({ error: 'Version not found' });

      const { CompostMill } = await import('../dist/compost/CompostMill.js');
      const { mergeConfig } = await import('../dist/compost/defaults.js');
      const mill = new CompostMill(mergeConfig());
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
