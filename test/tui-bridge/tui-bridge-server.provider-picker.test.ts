import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer as createNetServer } from 'node:net';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';

const { mockLoadConfig, mockSaveConfig, mockLLMClientCtor } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockLLMClientCtor: vi.fn(),
}));

vi.mock('../../src/config/ConfigLoader.js', () => ({
  loadConfig: mockLoadConfig,
  saveConfig: mockSaveConfig,
}));

vi.mock('../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    constructor(config: any) {
      mockLLMClientCtor(config);
      return {
        getConfig: () => config,
      };
    }
  },
}));

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate port'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolve(port));
    });
    server.on('error', reject);
  });
}

describe('TuiBridgeServer model picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue({
      isErr: () => false,
      isOk: () => true,
      value: {
        defaultProvider: 'openrouter',
        providers: {
          custom: {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5.4-mini',
            apiKey: 'openai-key',
          },
          openrouter: {
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'anthropic/claude-sonnet-4-6',
            apiKey: 'or-key',
          },
        },
      },
    });
    mockSaveConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists model choices and marks the current one', async () => {
    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-6' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/model' }),
      });

      const events = service.getEvents(session.sessionId);
      const committed = events.find((event) => event.type === 'response.committed') as any;
      expect(committed.content).toContain('Model picker:');
      expect(committed.content).toContain('/model NUMBER');
      expect(committed.content).not.toContain('<number>');
      expect(committed.content).toContain('OpenAI');
      expect(committed.content).toContain('MiniMax');
      expect(committed.content).toContain('claude');
      expect(committed.content).toContain('(current)');
    } finally {
      await server.stop();
    }
  });

  it('switches the OpenRouter model, saves config, and updates session status', async () => {
    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-6' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/provider openrouter gemini-pro' }),
      });

      expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        defaultProvider: 'openrouter',
        providers: expect.objectContaining({
          openrouter: expect.objectContaining({
            baseUrl: 'https://openrouter.ai/api/v1',
            model: 'google/gemini-3.1-pro-preview',
          }),
        }),
      }));
      expect(mockLLMClientCtor).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'google/gemini-3.1-pro-preview',
        apiKey: 'or-key',
      }));
      expect(service.getStatus(session.sessionId)).toMatchObject({
        provider: 'openrouter',
        model: 'google/gemini-3.1-pro-preview',
      });
    } finally {
      await server.stop();
    }
  });

  it('switches OpenAI-compatible custom model through /model openai alias', async () => {
    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-6' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/model openai gpt-5.4-mini' }),
      });

      expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        defaultProvider: 'custom',
        providers: expect.objectContaining({
          custom: expect.objectContaining({
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5.4-mini',
            apiKey: 'openai-key',
          }),
        }),
      }));
      expect(mockLLMClientCtor).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.4-mini',
        apiKey: 'openai-key',
      }));
      expect(service.getStatus(session.sessionId)).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-mini',
      });
    } finally {
      await server.stop();
    }
  });

  it('switches to local providers without requiring an API key', async () => {
    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/model lmstudio local-model' }),
      });

      expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        defaultProvider: 'lmstudio',
        providers: expect.objectContaining({
          lmstudio: expect.objectContaining({
            baseUrl: 'http://localhost:1234/v1',
            model: 'local-model',
          }),
        }),
      }));
      expect(mockLLMClientCtor).toHaveBeenCalledWith(expect.objectContaining({
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model',
        apiKey: undefined,
      }));
      expect(service.getStatus(session.sessionId)).toMatchObject({
        provider: 'lmstudio',
        model: 'local-model',
      });
    } finally {
      await server.stop();
    }
  });

  it('switches by numbered picker choice', async () => {
    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-6' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/model 1' }),
      });

      expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        defaultProvider: 'custom',
        providers: expect.objectContaining({
          custom: expect.objectContaining({
            model: 'gpt-5.4-mini',
          }),
        }),
      }));
      expect(service.getStatus(session.sessionId)).toMatchObject({
        provider: 'openai',
        model: 'gpt-5.4-mini',
      });
    } finally {
      await server.stop();
    }
  });

  it('can switch models even when the config file is missing, using the live/api env key', async () => {
    mockLoadConfig.mockResolvedValue({
      isErr: () => true,
      isOk: () => false,
      error: { message: 'missing config' },
    });
    process.env.OPENROUTER_API_KEY = 'env-openrouter-key';

    const port = await getFreePort();
    const service = new TuiBridgeService();
    const server = new TuiBridgeServer(service, {
      host: '127.0.0.1',
      port,
      llm: {
        getConfig: () => ({ baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4-6', apiKey: 'live-key' }),
      } as any,
    });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      await fetch(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'chat', clientIntent: 'chat', text: '/provider openrouter gpt-mini' }),
      });

      expect(mockSaveConfig).toHaveBeenCalledWith(expect.objectContaining({
        defaultProvider: 'openrouter',
        providers: expect.objectContaining({
          openrouter: expect.objectContaining({
            model: 'openai/gpt-5-mini',
            apiKey: 'live-key',
          }),
        }),
      }));
      expect(service.getStatus(session.sessionId)).toMatchObject({
        provider: 'openrouter',
        model: 'openai/gpt-5-mini',
      });
    } finally {
      delete process.env.OPENROUTER_API_KEY;
      await server.stop();
    }
  });
});
