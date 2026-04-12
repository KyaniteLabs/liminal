import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { TuiBridgeService } from './TuiBridgeService.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiInputRequest } from './types.js';

interface BridgeServerOptions {
  port?: number;
  host?: string;
  llm?: LLMClient;
}

export class TuiBridgeServer {
  private bridge: TuiBridgeService;
  private server: Server;
  private port: number;
  private host: string;
  private llm?: LLMClient;

  constructor(bridge: TuiBridgeService, options: BridgeServerOptions = {}) {
    this.llm = options.llm;
    this.bridge = bridge;
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.server = createServer((req, res) => { void this.handleRequest(req, res); });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        this.server.off('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.port, this.host, () => {
        // The explicit listening listener above resolves the promise. Keep this
        // callback empty so older Node versions still use the same listen path.
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get address(): string {
    return `http://${this.host}:${this.port}`;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers - restrict to localhost origins only
    const origin = req.headers.origin;
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:4200', 'http://localhost:5173', 'http://127.0.0.1:3000'];
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      // POST /api/tui/session — create a new session
      if (req.method === 'POST' && path === '/api/tui/session') {
        const cfg = this.llm?.getConfig();
        const status = this.bridge.createSession({
          provider: cfg ? this.providerLabel(cfg.baseUrl) : undefined,
          model: cfg?.model,
        });
        this.json(res, 201, status);
        return;
      }

      // GET /api/tui/session/:id/status
      const statusMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/status$/);
      if (req.method === 'GET' && statusMatch) {
        const sessionId = statusMatch[1];
        const status = this.bridge.getStatus(sessionId);
        this.json(res, 200, status);
        return;
      }

      // GET /api/tui/session/:id/events — SSE stream
      const eventsMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/events$/);
      if (req.method === 'GET' && eventsMatch) {
        const sessionId = eventsMatch[1];
        // Validate session exists
        this.bridge.getStatus(sessionId);
        this.handleSSE(req, res, sessionId);
        return;
      }

      // POST /api/tui/session/:id/input
      const inputMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/input$/);
      if (req.method === 'POST' && inputMatch) {
        const sessionId = inputMatch[1];
        const body = await this.readBody(req);
        const input: TuiInputRequest = JSON.parse(body);
        // Pass the full LLMClient (not just stream function)
        const result = await this.bridge.submitInput(sessionId, input, this.llm);
        this.json(res, 200, result);
        return;
      }

      // POST /api/tui/session/:id/actions/:actionId/confirm
      const confirmMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/actions\/([^/]+)\/confirm$/);
      if (req.method === 'POST' && confirmMatch) {
        const sessionId = confirmMatch[1];
        const actionId = confirmMatch[2];
        await this.bridge.confirmAction(sessionId, actionId);
        this.json(res, 200, { ok: true });
        return;
      }

      // POST /api/tui/session/:id/actions/:actionId/cancel
      const cancelMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/actions\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && cancelMatch) {
        const sessionId = cancelMatch[1];
        const actionId = cancelMatch[2];
        this.bridge.cancelAction(sessionId, actionId);
        this.json(res, 200, { ok: true });
        return;
      }

      // Health check
      if (path === '/health') {
        this.json(res, 200, { status: 'ok', bridge: 'liminal-tui' });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('not found') || message.includes('Unknown') ? 404 : 500;
      this.json(res, status, { error: message });
    }
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse, sessionId: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send any existing events first
    const existing = this.bridge.getEvents(sessionId);
    for (const event of existing) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = this.bridge.subscribe(sessionId, (event) => {
      const payload = `data: ${JSON.stringify(event)}\n\n`;
      const flushed = res.write(payload);
      // Handle backpressure: if the buffer is full, pause and resume
      if (!flushed) {
        res.once('drain', () => { /* resume */ });
      }
    });

    // Clean up on client disconnect
    req.on('close', () => {
      unsubscribe();
    });
  }

  private providerLabel(baseUrl: string): string {
    const lower = baseUrl.toLowerCase();
    if (lower.includes('z.ai') || lower.includes('bigmodel') || lower.includes('glm')) return 'glm';
    if (lower.includes('minimax')) return 'minimax';
    if (lower.includes('openrouter')) return 'openrouter';
    if (lower.includes('kimi')) return 'kimi';
    if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'lmstudio';
    return 'llm';
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }
}
