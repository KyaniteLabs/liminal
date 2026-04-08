import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockReadFile, mockMkdir, mockAccess, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockAccess: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    mkdir: mockMkdir,
    access: mockAccess,
    stat: mockStat,
    copyFile: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: mockReadFile,
  mkdir: mockMkdir,
  access: mockAccess,
  stat: mockStat,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/utils/env.js', () => ({
  env: vi.fn().mockReturnValue(''),
}));

vi.mock('../../../src/constants.js', () => ({
  SERVICE_DEFAULTS: { DEFAULT_MODEL: 'test-model' },
}));

// ── Imports ────────────────────────────────────────────────────────────

import { loadConfig, loadProjectConfig } from '../../../src/config/ConfigLoader.js';
import { PersistenceError } from '../../../src/errors/PersistenceError.js';

// ── loadConfig() ──────────────────────────────────────────────────────

describe('loadConfig()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: access succeeds (no legacy config to migrate)
    mockAccess.mockRejectedValue(new Error('not found'));
    mockStat.mockRejectedValue(new Error('not found'));
  });

  it('returns ok(UserConfig) when config file exists and is valid JSON', async () => {
    const configData = JSON.stringify({
      defaultProvider: 'minimax',
      providers: {
        minimax: { baseUrl: 'https://api.minimax.chat', model: 'MiniMax-Text-01', apiKey: 'test-key' },
      },
    });
    mockReadFile.mockResolvedValue(configData);

    const result = await loadConfig('/tmp/.liminal/config.json');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.defaultProvider).toBe('minimax');
      expect(result.value.providers.minimax.baseUrl).toBe('https://api.minimax.chat');
      expect(result.value.providers.minimax.model).toBe('MiniMax-Text-01');
    }
  });

  it('returns err(PersistenceError) when config file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await loadConfig('/tmp/.liminal/nonexistent.json');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.code).toBe('ERR_PERSISTENCE');
      expect(result.error.retryable).toBe(false);
    }
  });

  it('returns err(PersistenceError) when config file has invalid JSON', async () => {
    mockReadFile.mockResolvedValue('{ this is not valid json }');

    const result = await loadConfig('/tmp/.liminal/bad.json');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(PersistenceError);
    }
  });
});

// ── loadProjectConfig() ───────────────────────────────────────────────

describe('loadProjectConfig()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStat.mockRejectedValue(new Error('not found'));
  });

  it('returns ok(ProjectConfig) when config exists', async () => {
    const projectConfig = JSON.stringify({
      name: 'test-project',
      loop: { maxIterations: 10 },
      llm: { provider: 'ollama', model: 'qwen' },
    });
    mockStat.mockResolvedValue({ isDirectory: () => true });
    mockReadFile.mockResolvedValue(projectConfig);

    const result = await loadProjectConfig('/tmp/project');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('test-project');
      expect(result.value.loop?.maxIterations).toBe(10);
      expect(result.value.llm?.provider).toBe('ollama');
    }
  });

  it('returns ok(ProjectConfig) when loading from direct file path', async () => {
    const projectConfig = JSON.stringify({ name: 'direct-path-project' });
    mockStat.mockResolvedValue({ isDirectory: () => false });
    mockReadFile.mockResolvedValue(projectConfig);

    const result = await loadProjectConfig('/tmp/project/config/liminal.json');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('direct-path-project');
    }
  });

  it('returns err(PersistenceError) when neither liminal.json nor atelier.json exist', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true });
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await loadProjectConfig('/tmp/empty-project');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(PersistenceError);
      expect(result.error.retryable).toBe(false);
    }
  });

  it('falls back to atelier.json when liminal.json does not exist', async () => {
    const legacyConfig = JSON.stringify({ name: 'legacy-project' });
    mockStat.mockResolvedValue({ isDirectory: () => true });
    // First call (liminal.json) fails, second call (atelier.json) succeeds
    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(legacyConfig);

    const result = await loadProjectConfig('/tmp/legacy-project');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('legacy-project');
    }
  });
});
