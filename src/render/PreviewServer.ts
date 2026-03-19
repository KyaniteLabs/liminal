/**
 * PreviewServer - Express server for live p5.js sketch preview
 * Optional API: GET /api/gallery, GET /api/gallery/:project, POST /api/export
 */

import express, { Express } from 'express';
import path from 'path';
import { Server } from 'http';
import { Gallery } from '../gallery/Gallery.js';
import { Exporter } from '../export/Exporter.js';
import { normalizePath } from '../utils/normalizePath.js';

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
  private readonly DEFAULT_PORT = 3456;
  private readonly galleryDir: string | null;

  constructor(options: PreviewServerOptions | string | null = null) {
    this.app = express();
    const opts = typeof options === 'string' ? { galleryDir: options } : (options || {});
    this.galleryDir = opts.galleryDir ?? null;
    this.setupRoutes();
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
      this.setAllVersions(iterations.map((it: any) => ({
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
              ? reqIterations.map((it: any) => ({
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
    // Escape </script> to prevent breaking out of the script tag
    // but keep other code intact for execution
    const safeCode = (sketchCode || '').replace(/\u003c\/script\u003e/gi, '<\\/script>');
    const usesP5Sound = /p5\.sound/i.test(sketchCode || '');
    const p5Version = '1.9.0';
    const p5SoundScript = usesP5Sound
      ? `\n  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/${p5Version}/p5.sound.min.js"></script>`
      : '';
    const usesWebAudio = /AudioContext|createOscillator|p5\.sound/i.test(sketchCode || '');
    const soundComment = usesWebAudio
      ? '\n  <!-- Sound may require user click to start (browser policy). -->'
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atelier Preview</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
</head>
<body>${soundComment}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/${p5Version}/p5.min.js"></script>${p5SoundScript}
  <script>
    ${safeCode}
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
        .on('error', (error: any) => {
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
