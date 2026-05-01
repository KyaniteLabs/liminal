import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { TuiBridgeService } from './TuiBridgeService.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiInputRequest } from './types.js';
import { loadConfig, saveConfig, type UserConfig } from '../config/ConfigLoader.js';
import { LLMClient as RuntimeLLMClient } from '../llm/LLMClient.js';
import { summarizeBridgeRuntime } from './BridgeLauncherConfig.js';
import {
  PROVIDER_DEFAULTS,
  detectProviderLabel,
  resolveProviderRuntime,
  type RuntimeProviderKey,
} from '../config/ProviderRuntime.js';
import {
  MODEL_CHOICES,
  findModelChoice,
  resolveChoiceByAlias,
  resolveOpenRouterChoice,
  resolveProviderToken,
  type ModelChoice,
} from './ModelPickerCatalog.js';
import { TuiControlEndpoints } from './endpoints/TuiControlEndpoints.js';
import { TuiMicPreviewEndpoints } from './endpoints/TuiMicPreviewEndpoints.js';

const ALLOWED_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:4200',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:5173',
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
  private readonly controls: TuiControlEndpoints;
  private readonly micPreview: TuiMicPreviewEndpoints;
  private llm?: LLMClient;

  constructor(bridge: TuiBridgeService, options: BridgeServerOptions = {}) {
    this.llm = options.llm;
    this.bridge = bridge;
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.controls = new TuiControlEndpoints(this.bridge, () => this.llm);
    this.micPreview = new TuiMicPreviewEndpoints(this.bridge, () => this.address);
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
    this.server.closeIdleConnections?.();
    this.server.closeAllConnections?.();
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        this.bridge.destroy();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get address(): string {
    const actual = this.server.address();
    const port = actual && typeof actual === 'object' ? actual.port : this.port;
    return `http://${this.host}:${port}`;
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
        const runtime = summarizeBridgeRuntime();
        const status = this.bridge.createSession({
          provider: cfg ? this.providerLabel(cfg.baseUrl) : undefined,
          model: cfg?.model,
          roles: runtime.roles,
          evaluation: runtime.evaluation,
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
        if (this.micPreview.handleCommand(sessionId, input)) {
          this.json(res, 200, { reviewRequired: false });
          return;
        }
        if (await this.handleModelPicker(sessionId, input)) {
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
        this.json(res, 200, await this.controls.confirmAction(sessionId, actionId));
        return;
      }

      // POST /api/tui/session/:id/actions/:actionId/cancel
      const cancelMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/actions\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && cancelMatch) {
        const sessionId = cancelMatch[1];
        const actionId = cancelMatch[2];
        this.json(res, 200, this.controls.cancelAction(sessionId, actionId));
        return;
      }

      // POST /api/tui/session/:id/cancel
      const runCancelMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && runCancelMatch) {
        const sessionId = runCancelMatch[1];
        this.json(res, 200, this.controls.cancelRun(sessionId));
        return;
      }

      const micPageMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/mic-preview$/);
      if (req.method === 'GET' && micPageMatch) {
        const page = this.micPreview.renderPage(micPageMatch[1]);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page);
        return;
      }

      const micUpdateMatch = path.match(/^\/api\/tui\/session\/([^/]+)\/mic-preview\/update$/);
      if (req.method === 'POST' && micUpdateMatch) {
        const sessionId = micUpdateMatch[1];
        const body = await this.readBody(req);
        this.micPreview.applyUpdate(sessionId, JSON.parse(body));
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
    res.write(': connected\n\n');

    const lastEventId = Number(req.headers['last-event-id'] || 0) || 0;

    // Send any existing events first
    const replay = this.bridge.getEventReplay();
    const existing = replay.replayAfter(sessionId, lastEventId);
    for (const stored of existing) {
      res.write(`id: ${stored.id}\n`);
      res.write(`data: ${JSON.stringify(stored.event)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = replay.subscribeStored(sessionId, (stored) => {
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

  private providerLabel(baseUrl: string, model = ''): string {
    return detectProviderLabel(baseUrl, model);
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private async handleModelPicker(sessionId: string, input: TuiInputRequest): Promise<boolean> {
    const text = input.text.trim();
    if (!text.startsWith('/model') && !text.startsWith('/provider')) return false;

    const words = text.split(/\s+/);
    const isProviderCommand = words[0] === '/provider';
    const parts = words.slice(1);
    if (isProviderCommand && parts[0] === 'openrouter') {
      parts.shift();
    }
    if (parts.length === 0) {
      this.bridge.emitCommandResponse(sessionId, await this.renderModelPicker());
      return true;
    }

    const resolved = await this.resolveModelSelection(parts);
    if (!resolved) {
      this.bridge.emitCommandResponse(sessionId, `Unknown model selection: ${parts.join(' ')}\n\n${await this.renderModelPicker()}`);
      return true;
    }

    const loaded = await loadConfig();
    const config = loaded.isErr()
      ? ({ defaultProvider: resolved.provider, providers: {} } as UserConfig)
      : (loaded.value as UserConfig);
    const providerConfig = this.providerConfigForSelection(config, resolved.provider);
    const currentConfig = this.llm?.getConfig();
    const runtime = resolveProviderRuntime({
      provider: resolved.provider,
      model: resolved.model,
      configuredBaseUrl: providerConfig.baseUrl,
      configuredApiKey: providerConfig.apiKey,
      current: currentConfig ? {
        provider: this.providerLabel(currentConfig.baseUrl, currentConfig.model),
        apiKey: currentConfig.apiKey,
      } : undefined,
      env: process.env,
    });

    if (runtime.requiresKey && !runtime.apiKey) {
      this.bridge.emitCommandResponse(sessionId, `${runtime.label} API key not found. Set providers.${resolved.provider}.apiKey in ~/.liminal/config.json before switching.`);
      return true;
    }

    config.defaultProvider = resolved.provider;
    config.providers = config.providers || {};
    config.providers[resolved.provider] = {
      ...providerConfig,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
    };
    if (runtime.apiKey) config.providers[resolved.provider].apiKey = runtime.apiKey;
    await saveConfig(config);

    this.llm = new RuntimeLLMClient({
      role: 'harness',
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      apiKey: runtime.apiKey,
      temperature: 0.5,
      maxTokens: 4096,
    });

    this.bridge.updateStatus(sessionId, {
      provider: runtime.statusProvider,
      model: runtime.model,
      activeTask: `Model switched to ${resolved.label}`,
    });
    this.bridge.emitCommandResponse(sessionId, `Switched model to ${resolved.label} (${runtime.model}) via ${runtime.label}`);
    return true;
  }

  private providerConfigForSelection(
    config: UserConfig,
    provider: RuntimeProviderKey,
  ): { baseUrl?: string; model?: string; apiKey?: string } {
    const providerConfig = config.providers?.[provider];
    if (providerConfig) return providerConfig;

    // Backward compatibility: older configs stored OpenAI-compatible GPT
    // selections under `custom`. Read that key when switching to the new
    // first-class `openai` provider, but save future selections as `openai`.
    const legacyCustom = config.providers?.custom;
    if (provider === 'openai' && legacyCustom) {
      const legacyProvider = detectProviderLabel(
        legacyCustom.baseUrl ?? PROVIDER_DEFAULTS.openai.baseUrl,
        legacyCustom.model,
      );
      if (legacyProvider === 'openai') return legacyCustom;
    }

    return {};
  }

  private async renderModelPicker(): Promise<string> {
    const loaded = await loadConfig();
    const config = loaded.isErr() ? undefined : (loaded.value as UserConfig);
    const currentConfig = this.llm?.getConfig();
    const currentModel = currentConfig?.model;
    const currentProvider = currentConfig?.baseUrl ? this.providerLabel(currentConfig.baseUrl, currentConfig.model) : config?.defaultProvider;
    const lines = [
      'Model picker:',
      `Current: ${currentProvider || 'unknown'}/${currentModel || 'unknown'}`,
      '',
      'Type /model NUMBER, /model PROVIDER, or /model PROVIDER MODEL',
      '',
    ];
    MODEL_CHOICES.forEach((choice, index) => {
      const marker = choice.model === currentModel ? ' (current)' : '';
      lines.push(`${String(index + 1).padStart(2, ' ')}. ${PROVIDER_DEFAULTS[choice.provider].label.padEnd(10)} ${choice.label.padEnd(18)} ${choice.model}${marker}`);
    });
    lines.push('');
    lines.push('Examples: /model 1, /model glm 5v, /model openai gpt-5.4-mini, /model lmstudio, /model ollama llama3.2, /model minimax m27');
    return lines.join('\n');
  }

  private async resolveModelSelection(parts: string[]): Promise<ModelChoice | null> {
    const first = parts[0]?.toLowerCase();
    const numericChoice = Number(first);
    if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= MODEL_CHOICES.length) {
      return MODEL_CHOICES[numericChoice - 1];
    }

    const provider = resolveProviderToken(first);
    if (!provider) {
      return resolveChoiceByAlias(parts.join(' '));
    }

    const selection = parts.slice(1).join(' ').trim();
    if (!selection) {
      const loaded = await loadConfig();
      const config = loaded.isErr() ? undefined : (loaded.value as UserConfig);
      const configuredModel = config?.providers?.[provider]?.model;
      return {
        provider,
        label: configuredModel || PROVIDER_DEFAULTS[provider].model,
        model: configuredModel || PROVIDER_DEFAULTS[provider].model,
        aliases: [],
      };
    }

    if (provider === 'openrouter') {
      const openRouterChoice = resolveOpenRouterChoice(selection);
      if (openRouterChoice) return openRouterChoice;
    }

    const providerChoice = findModelChoice(provider, selection);
    return providerChoice ?? {
      provider,
      label: selection,
      model: selection,
      aliases: [],
    };
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
