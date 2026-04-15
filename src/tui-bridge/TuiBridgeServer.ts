import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { TuiBridgeService } from './TuiBridgeService.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiInputRequest } from './types.js';
import { loadConfig, saveConfig, type UserConfig } from '../config/ConfigLoader.js';
import { resolveOpenRouterModelAlias, OPENROUTER_MODEL_CATALOG } from './OpenRouterModelCatalog.js';
import { LLMClient as RuntimeLLMClient } from '../llm/LLMClient.js';

const ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

interface BridgeServerOptions {
  port?: number;
  host?: string;
  llm?: LLMClient;
}

export class TuiBridgeServer {
  private readonly bridge: TuiBridgeService;
  private readonly server: Server;
  private readonly port: number;
  private readonly host: string;
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
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
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
        if (await this.handleOpenRouterPicker(sessionId, input)) {
          this.json(res, 200, { reviewRequired: false });
          return;
        }
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

      this.json(res, 404, { error: 'Not found' });
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

    const lastEventId = Number(req.headers['last-event-id'] || 0) || 0;

    // Send any existing events first
    const existing = this.bridge.getEventsSince(sessionId, lastEventId);
    for (const stored of existing) {
      res.write(`id: ${stored.id}\n`);
      res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = this.bridge.subscribeWithId(sessionId, (stored) => {
      const payload = `id: ${stored.id}
data: ${JSON.stringify(stored.event)}

`;
      res.write(payload);
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
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

  private async handleOpenRouterPicker(sessionId: string, input: TuiInputRequest): Promise<boolean> {
    const text = input.text.trim();
    if (!text.startsWith('/provider openrouter')) return false;

    const parts = text.split(/\s+/).slice(2);
    if (parts.length === 0) {
      const current = this.llm?.getConfig().model;
      const lines = ['OpenRouter models:'];
      for (const entry of OPENROUTER_MODEL_CATALOG) {
        const marker = entry.model === current ? ' (current)' : '';
        lines.push(`- ${entry.alias.padEnd(12)} ${entry.model}${marker}`);
      }
      this.bridge.emitCommandResponse(sessionId, lines.join('\n'));
      return true;
    }

    const selection = parts.join(' ');
    const alias = resolveOpenRouterModelAlias(selection);
    const model = alias?.model || selection;
    const label = alias?.label || selection;

    const loaded = await loadConfig();
    const config = loaded.isErr()
      ? ({ defaultProvider: 'openrouter', providers: {} } as UserConfig)
      : (loaded.value as UserConfig);

    const apiKey = config.providers?.openrouter?.apiKey
      || this.llm?.getConfig().apiKey
      || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      this.bridge.emitCommandResponse(sessionId, 'OpenRouter API key not found. Set it in ~/.liminal/config.json or OPENROUTER_API_KEY before switching models.');
      return true;
    }

    config.defaultProvider = 'openrouter';
    config.providers = config.providers || {};
    config.providers.openrouter = {
      ...config.providers.openrouter,
      baseUrl: 'https://openrouter.ai/api/v1',
      model,
      apiKey,
    };
    await saveConfig(config);

    this.llm = new RuntimeLLMClient({
      role: 'harness',
      baseUrl: config.providers.openrouter.baseUrl,
      model,
      apiKey,
      temperature: 0.5,
      maxTokens: 4096,
    });

    this.bridge.updateStatus(sessionId, {
      provider: 'openrouter',
      model,
      activeTask: `Provider switched to ${label}`,
    });
    this.bridge.emitCommandResponse(sessionId, `Switched OpenRouter model to ${label} (${model})`);
    return true;
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
