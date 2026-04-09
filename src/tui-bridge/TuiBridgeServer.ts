import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { TuiBridgeService } from './TuiBridgeService.js';
import type { TuiInputRequest } from './types.js';

interface LLMStreamer {
  stream(systemPrompt: string, userPrompt: string, signal?: AbortSignal): AsyncGenerator<string>;
}

interface BridgeServerOptions {
  port?: number;
  host?: string;
  llm?: LLMStreamer;
}

export class TuiBridgeServer {
  private bridge: TuiBridgeService;
  private server: Server;
  private port: number;
  private host: string;
  private llm?: LLMStreamer;

  constructor(bridge: TuiBridgeService, options: BridgeServerOptions = {}) {
    this.llm = options.llm;
    this.bridge = bridge;
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.server = createServer((req, res) => this.handleRequest(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        resolve();
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
    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
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
        const status = this.bridge.createSession();
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
