/**
 * PreviewServer - Express server for live p5.js sketch preview
 * Optional API: GET /api/gallery, GET /api/gallery/:project, POST /api/export
 * Activity: SSE /api/events, GET /api/status, GET /api/compost/seeds
 */

import express, { Express } from 'express';
import path from 'path';
import { Server } from 'http';
import helmet from 'helmet';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { Gallery } from '../gallery/Gallery.js';
import { Exporter } from '../export/Exporter.js';
import { normalizePath } from '../utils/normalizePath.js';
import { SERVICE_DEFAULTS } from '../constants.js';
import { LLMClient } from '../llm/LLMClient.js';
import { eventBus } from '../core/EventBus.js';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import type { BusEvent } from '../core/EventBus.js';
import {
  standardLimiter,
  exportLimiter,
  sandboxLimiter,
} from '../security/RateLimiter.js';

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
    // Security headers middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",  // Required for inline p5.js sketches
            "https://cdnjs.cloudflare.com",  // p5.js CDN
            "https://cdn.jsdelivr.net",      // Three.js CDN
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",  // Required for inline styles
          ],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,  // Allow CDN resources
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },  // X-Frame-Options: DENY
      hidePoweredBy: true,  // Remove X-Powered-By header
      hsts: {
        maxAge: 31536000,  // 1 year
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,  // X-Download-Options
      noSniff: true,  // X-Content-Type-Options: nosniff
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,  // X-XSS-Protection (legacy)
    }));

    // CSP report endpoint
    this.app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
      console.warn('[CSP Violation]', req.body);
      res.status(204).send();
    });

    // Cookie parser required for CSRF
    this.app.use(cookieParser());

    // CSRF Protection (disabled in test environment for easier testing)
    const isTestEnv = process.env.NODE_ENV === 'test';
    const csrfProtection = isTestEnv 
      ? (_req: any, _res: any, next: any) => next() // No-op middleware for tests
      : csurf({
          cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          },
          value: (req) => req.headers['x-csrf-token'] as string,
        });

    // Apply CSRF to state-changing routes only
    this.app.use('/api/preview/versions', csrfProtection);
    this.app.use('/api/sandbox/run', csrfProtection);
    this.app.use('/api/export', csrfProtection);

    // Add CSRF token endpoint (returns dummy token in test mode)
    this.app.get('/api/csrf-token', csrfProtection, (req, res) => {
      res.json({ csrfToken: isTestEnv ? 'test-token' : req.csrfToken() });
    });

    // Apply rate limiting to API routes (must be before route handlers)
    this.app.use('/api/', standardLimiter);
    this.app.use('/api/export', exportLimiter); // Stricter limit for exports
    this.app.use('/api/sandbox', sandboxLimiter); // Medium limit for sandbox

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
    return HTMLWrapper.wrap(sketchCode || '');
  }

  async start(port: number = this.DEFAULT_PORT): Promise<boolean> {
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}`);
    }
    if (this.server) {
      throw new Error('Server is already running');
    }

    try {
      this.server = this.app.listen(port);
      
      await new Promise<void>((resolve, reject) => {
        this.server!
          .on('error', (error: Error & { code?: string }) => {
            this.server = null;
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`Port ${port} is already in use`));
            } else {
              reject(error);
            }
          })
          .on('listening', () => {
            resolve();
          });
      });
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  async stop(): Promise<boolean> {
    if (!this.server) {
      return false;
    }
    
    await new Promise<void>((resolve) => {
      this.server!.close(() => {
        resolve();
      });
    });
    
    this.server = null;
    return true;
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
