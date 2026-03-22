/**
 * PreviewServer - Express server for live p5.js sketch preview
 * Optional API: GET /api/gallery, GET /api/gallery/:project, POST /api/export
 * Activity: SSE /api/events, GET /api/status, GET /api/compost/seeds
 */

import express, { Express } from 'express';
import path from 'path';
import { Server } from 'http';
import { Gallery } from '../gallery/Gallery.js';
import { Exporter } from '../export/Exporter.js';
import { normalizePath } from '../utils/normalizePath.js';
import { SERVICE_DEFAULTS, P5_CDN, P5_SOUND_CDN } from '../constants.js';
import { LLMClient } from '../llm/LLMClient.js';
import { eventBus } from '../core/EventBus.js';
import type { BusEvent } from '../core/EventBus.js';

export interface PreviewServerOptions {
  galleryDir?: string;
}

export interface VersionedIteration {
  version: number;
  code: string;
  timestamp?: string;
}

export class PreviewServer {
  private app: Express;
  private server: Server | null = null;
  private currentSketch: string = '';
  private versionedSketches: Map<number, string> = new Map();
  private readonly DEFAULT_PORT = SERVICE_DEFAULTS.PREVIEW_PORT;
  private readonly galleryDir: string | null;
  private sseClients: Set<import('express').Response> = new Set();

  constructor(options: PreviewServerOptions | string | null = null) {
    this.app = express();
    const opts = typeof options === 'string' ? { galleryDir: options } : (options || {});
    this.galleryDir = opts.galleryDir ?? null;
    this.setupRoutes();
    this.setupEventBus();
  }

  /** Subscribe EventBus to forward events to SSE clients. */
  private setupEventBus(): void {
    eventBus.onEvent((event: BusEvent) => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of this.sseClients) {
        try {
          client.write(data);
        } catch (err) {
          console.warn('[PreviewServer] Failed to write to SSE client, removing:', err);
          this.sseClients.delete(client);
        }
      }
    });
  }

  private setupRoutes(): void {
    this.app.get('/', (_req, res) => {
      const html = this.generateHTML(this.currentSketch);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });

    this.app.get('/preview', (req, res) => {
      const versionParam = req.query.version;
      const version = versionParam != null ? Number(versionParam) : NaN;
      const code = Number.isInteger(version) && version > 0
        ? (this.versionedSketches.get(version) ?? '')
        : this.currentSketch;
      const html = this.generateHTML(code);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });

    this.app.use(express.json({ limit: '10mb' }));

    this.app.get('/api/gallery', async (_req, res) => {
      if (!this.galleryDir) {
        return res.status(200).json({ projects: [] });
      }
      try {
        const gallery = new Gallery(this.galleryDir);
        const projects = await gallery.listProjectDirs();
        return res.json({ projects });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list gallery' });
      }
    });

    this.app.get('/api/gallery/:project', async (req, res) => {
      if (!this.galleryDir) {
        return res.status(200).json({ iterations: [] });
      }
      try {
        const projectDirName = decodeURIComponent(req.params.project);
        const gallery = new Gallery(this.galleryDir);
        const iterations = await gallery.loadHistoryFromDir(projectDirName);
        return res.json({ iterations });
      } catch (err) {
        return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load project' });
      }
    });

    this.app.post('/api/preview/versions', (req, res) => {
      const iterations = Array.isArray(req.body?.iterations) ? req.body.iterations : [];
      this.setAllVersions(iterations.map((it: { version?: number; code?: string; timestamp?: string }) => ({
        version: typeof it.version === 'number' ? it.version : parseInt(String(it.version), 10) || 1,
        code: typeof it.code === 'string' ? it.code : '',
        timestamp: typeof it.timestamp === 'string' ? it.timestamp : undefined
      })));
      return res.status(200).json({ ok: true });
    });

    /**
     * Run selected iteration code "in sandbox" and return URL for live view.
     * Minimal implementation: sets preview server version and returns /preview?version=N.
     * When SandboxRunner (Subagent A) exists, this endpoint can call it and return sandbox URL.
     */
    this.app.post('/api/sandbox/run', (req, res) => {
      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      const version = Number.isInteger(req.body?.version) && req.body.version > 0
        ? req.body.version
        : 1;
      this.setVersionCode(version, code);
      this.serveSketch(code);
      const url = `/preview?version=${version}`;
      return res.status(200).json({ url });
    });

    const guiDir = path.join(process.cwd(), 'gui');
    this.app.use('/gui', express.static(guiDir, { index: 'index.html' }));
    this.app.get('/gui', (_req, res) => {
      res.sendFile(path.join(guiDir, 'index.html'));
    });

    // ── Activity endpoints ──

    this.app.get('/api/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Send recent events so new clients get caught up
      const recent = eventBus.getRecentEvents();
      for (const event of recent) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      this.sseClients.add(res);
      req.on('close', () => {
        this.sseClients.delete(res);
      });
    });

    this.app.get('/api/status', async (_req, res) => {
      try {
        const { CompostMill } = await import('../compost/CompostMill.js');
        const { mergeConfig } = await import('../compost/defaults.js');
        const llm = new LLMClient();
        const mill = new CompostMill(llm, mergeConfig());
        const millStatus = await mill.statusAsync();

        const loopProgress = await import('../core/RalphLoop.js').then(m => m.RalphLoop.getProgress());

        res.json({
          heapSize: millStatus.heapSize,
          heapFileCount: millStatus.heapFileCount,
          seedCount: millStatus.seedCount,
          soupRunning: millStatus.soupRunning,
          loopProgress,
          recentEvents: eventBus.getRecentEvents().slice(-20),
        });
      } catch (err) {
        res.json({ error: err instanceof Error ? err.message : 'Status unavailable' });
      }
    });

    this.app.get('/api/compost/seeds', async (_req, res) => {
      try {
        const { CompostMill } = await import('../compost/CompostMill.js');
        const { mergeConfig } = await import('../compost/defaults.js');
        const llm = new LLMClient();
        const mill = new CompostMill(llm, mergeConfig());
        const seeds = await mill.listSeeds();
        res.json({ seeds: seeds.slice(0, 50), total: seeds.length });
      } catch (err) {
        res.json({ error: err instanceof Error ? err.message : 'Seed query failed' });
      }
    });

    this.app.post('/api/export', async (req, res) => {
      try {
        const { code, format, outputPath: reqPath, projectName, iterations: reqIterations } = req.body || {};
        const fmt = (format || 'html').toLowerCase();
        if (!['html', 'js', 'zip'].includes(fmt)) {
          return res.status(400).json({ error: 'format must be html, js, or zip' });
        }
        const exporter = new Exporter();
        const cwd = process.cwd();
        const baseDir = path.join(cwd, 'output');
        const defaultName = projectName || 'export';
        const requestedPath = reqPath || path.join(baseDir, `${defaultName}.${fmt === 'zip' ? 'zip' : fmt === 'html' ? 'html' : 'js'}`);
        const resolvedPath = normalizePath(cwd, requestedPath);

        if (fmt === 'zip') {
          const project = {
            name: projectName || 'project',
            iterations: Array.isArray(reqIterations)
              ? reqIterations.map((it: { version?: number; code?: string; timestamp?: string }) => ({
                  version: typeof it.version === 'number' ? it.version : parseInt(String(it.version), 10) || 1,
                  code: typeof it.code === 'string' ? it.code : '',
                  timestamp: typeof it.timestamp === 'string' ? it.timestamp : new Date().toISOString()
                }))
              : []
          };
          if (project.iterations.length === 0 && code) {
            project.iterations = [{ version: 1, code, timestamp: new Date().toISOString() }];
          }
          await exporter.exportZIP(project, resolvedPath);
        } else if (fmt === 'html') {
          if (!code || typeof code !== 'string' || code.trim() === '') {
            return res.status(400).json({ error: 'code is required for html export' });
          }
          await exporter.exportHTML(code, resolvedPath);
        } else {
          if (!code || typeof code !== 'string' || code.trim() === '') {
            return res.status(400).json({ error: 'code is required for js export' });
          }
          await exporter.exportJS(code, resolvedPath);
        }
        return res.json({ path: resolvedPath });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Export failed';
        if (msg.includes('Path traversal') || msg.includes('path separators')) {
          return res.status(400).json({ error: msg });
        }
        return res.status(500).json({ error: 'Export failed' });
      }
    });
  }

  private generateHTML(sketchCode: string): string {
    const code = sketchCode || '';

    // Detect shader code (GLSL fragment shader)
    if (this.isShaderCode(code)) {
      return this.generateShaderHTML(code);
    }

    // Detect Three.js code (full HTML with importmap or three import)
    if (this.isThreeJSCode(code)) {
      return code; // Three.js sketches are already full HTML
    }

    // Escape </script> to prevent breaking out of the script tag
    // but keep other code intact for execution
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    const usesP5Sound = /p5\.sound/i.test(code);
    const p5SoundScript = usesP5Sound
      ? `\n  <script src="${P5_SOUND_CDN}"></script>`
      : '';
    const usesWebAudio = /AudioContext|createOscillator|p5\.sound/i.test(code);
    const soundComment = usesWebAudio
      ? '\n  <!-- Sound may require user click to start (browser policy). -->'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liminal Preview</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>${soundComment}
  <script src="${P5_CDN}"></script>${p5SoundScript}
  <script>
    ${safeCode}
  </script>
</body>
</html>`;
  }

  private isShaderCode(code: string): boolean {
    return /void\s+main\s*\(/.test(code) && /gl_FragColor|out\s+vec4/.test(code);
  }

  private isThreeJSCode(code: string): boolean {
    return /<script\s+type="importmap">/.test(code) || /import.*from\s+['"]three['"]/.test(code);
  }

  private generateShaderHTML(code: string): string {
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liminal Shader Preview</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="gl"></canvas>
  <script>
    const canvas = document.getElementById('gl');
    const gl = canvas.getContext('webgl2');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vs = \`#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;

    const fs = \`#version 300 es
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    out vec4 fragColor;

    ${safeCode.replace(/^precision\s+highp\s+float;?\s*$/m, '').replace(/void\s+main\s*\(\s*void\s*\)/, 'void main()').replace(/gl_FragColor/g, 'fragColor')}
    \`;

    function createShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

    function frame(t) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uMouse, mouseX, canvas.height - mouseY);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  </script>
</body>
</html>`;
  }

  async start(port: number = this.DEFAULT_PORT): Promise<boolean> {
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    if (this.server) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port)
        .on('error', (error: Error & { code?: string }) => {
          this.server = null;
          if (error.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(error);
          }
        })
        .on('listening', () => {
          resolve(true);
        });
    });
  }

  async stop(): Promise<boolean> {
    if (!this.server) {
      return false;
    }
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve(true);
      });
    });
  }

  serveSketch(code: string | null): void {
    this.currentSketch = code || '';
  }

  /**
   * Set code for a specific version (used by GUI for /preview?version=N).
   */
  setVersionCode(version: number, code: string): void {
    if (version > 0 && Number.isInteger(version)) {
      this.versionedSketches.set(version, code ?? '');
    }
  }

  /**
   * Set all versions at once from iterations (version, code, timestamp).
   */
  setAllVersions(iterations: VersionedIteration[]): void {
    this.versionedSketches.clear();
    for (const it of iterations || []) {
      if (it.version > 0 && Number.isInteger(it.version)) {
        this.versionedSketches.set(it.version, it.code ?? '');
      }
    }
  }
}
