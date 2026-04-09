import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, getEffectiveConfig, loadProjectConfig } from '../../../src/config/ConfigLoader.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — required for vi.mock() factory references
// ---------------------------------------------------------------------------

const { mockReadFile, mockWriteFile, mockMkdir, mockStat, mockAccess, mockCopyFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
  mockStat: vi.fn(),
  mockAccess: vi.fn(),
  mockCopyFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir,
    stat: mockStat,
    access: mockAccess,
    copyFile: mockCopyFile,
  },
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  stat: mockStat,
  access: mockAccess,
  copyFile: mockCopyFile,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/config/RoleConfig.js', () => ({
  loadRoleConfig: vi.fn().mockResolvedValue({}),
}));

// ===========================================================================
// loadConfig
// ===========================================================================

describe('loadConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAccess.mockImplementation(async () => {});
  });

  it('returns parsed config from JSON file', async () => {
    const configJson = JSON.stringify({
      defaultProvider: 'openai',
      providers: { openai: { apiKey: 'sk-test-openai-key' } },
    });
    mockReadFile.mockResolvedValue(configJson);

    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        defaultProvider: 'openai',
        providers: { openai: { apiKey: 'sk-test-openai-key' } },
      });
    }
  });

  it('returns Err when file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const result = await loadConfig('/nonexistent/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('returns Err for invalid JSON', async () => {
    mockReadFile.mockResolvedValue('not valid json {{{');
    const result = await loadConfig('/bad/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('returns Err for empty file content', async () => {
    mockReadFile.mockResolvedValue('');
    const result = await loadConfig('/empty/config.json');
    expect(result.isErr()).toBe(true);
  });
});

// ===========================================================================
// saveConfig
// ===========================================================================

describe('saveConfig', () => {
  beforeEach(() => {
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('writes config as JSON creating directory', async () => {
    const config = { defaultProvider: 'test', providers: {} };
    await saveConfig(config, '/tmp/test-config.json');

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/test-config.json',
      JSON.stringify(config, null, 2),
      'utf-8',
    );
  });

  it('serializes config with 2-space indentation', async () => {
    const config = { defaultProvider: 'ollama', providers: { ollama: {} } };
    await saveConfig(config, '/tmp/nested/path/config.json');

    const writtenContent = mockWriteFile.mock.calls[0][1] as string;
    expect(writtenContent).toContain('  "defaultProvider"');
    expect(writtenContent).toContain('  "providers"');
  });
});

// ===========================================================================
// loadProjectConfig
// ===========================================================================

describe('loadProjectConfig', () => {
  beforeEach(() => {
    mockStat.mockResolvedValue({ isDirectory: () => true });
  });

  it('loads project config from directory', async () => {
    const configJson = JSON.stringify({
      name: 'test-project',
      llm: { provider: 'ollama', model: 'qwen:7b' },
    });
    mockReadFile.mockResolvedValue(configJson);

    const result = await loadProjectConfig('/project/dir');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        name: 'test-project',
        llm: { provider: 'ollama', model: 'qwen:7b' },
      });
    }
  });

  it('loads project config from file path directly', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false });
    const configJson = JSON.stringify({ name: 'direct-path-test' });
    mockReadFile.mockResolvedValue(configJson);
    const result = await loadProjectConfig('/path/to/liminal.json');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ name: 'direct-path-test' });
    }
  });

  it('returns Err when file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const result = await loadProjectConfig('/nonexistent/dir');
    expect(result.isErr()).toBe(true);
  });

  it('falls back to legacy atelier.json filename', async () => {
    const legacyJson = JSON.stringify({ name: 'legacy-project' });
    mockReadFile
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(legacyJson);
    const result = await loadProjectConfig('/project/dir');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ name: 'legacy-project' });
    }
  });

  it('returns Err when both config files fail', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    const result = await loadProjectConfig('/project/dir');
    expect(result.isErr()).toBe(true);
  });
});

// ===========================================================================
// getEffectiveConfig
// ===========================================================================

describe('getEffectiveConfig', () => {
  const envVarsToClean = [
    'LIMINAL_LLM_PROVIDER',
    'LIMINAL_LLM_BASE_URL',
    'LIMINAL_LLM_MODEL',
    'LIMINAL_LLM_API_KEY',
    'OPENAI_API_KEY',
    'MINIMAX_API_KEY',
  ];

  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const key of envVarsToClean) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    mockReadFile.mockResolvedValue('{}');
    mockAccess.mockImplementation(async () => {});
    mockStat.mockResolvedValue({ isDirectory: () => true });
  });

  afterEach(() => {
    for (const key of envVarsToClean) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it('returns defaults when no env vars and no file config', async () => {
    const config = await getEffectiveConfig();
    expect(config.model).toBe('auto');
    expect(config.provider).toBe('lmstudio');
  });

  it('uses file config for model and base URL', async () => {
    const fileConfig = JSON.stringify({
      defaultProvider: 'file-provider',
      providers: {
        'file-provider': {
          baseUrl: 'http://file-url',
          model: 'file-model',
          apiKey: 'file-key',
        },
      },
    });
    mockReadFile.mockResolvedValue(fileConfig);

    const config = await getEffectiveConfig();
    expect(config.model).toBe('file-model');
    expect(config.baseUrl).toBe('http://file-url');
    expect(config.apiKey).toBe('file-key');
  });

  it('uses project config when no file config overrides', async () => {
    const projectJson = JSON.stringify({
      llm: { baseUrl: 'http://project-url', model: 'project-model', apiKey: 'project-key' },
    });
    mockReadFile
      .mockResolvedValueOnce('{}')
      .mockResolvedValueOnce(projectJson);

    const config = await getEffectiveConfig(undefined, '/project/dir');
    expect(config.model).toBe('project-model');
    expect(config.baseUrl).toBe('http://project-url');
    expect(config.apiKey).toBe('project-key');
  });

  it('env vars take precedence over file config', async () => {
    process.env.LIMINAL_LLM_MODEL = 'env-model';
    process.env.LIMINAL_LLM_API_KEY = 'env-key';

    const fileConfig = JSON.stringify({
      defaultProvider: 'file-provider',
      providers: { 'file-provider': { model: 'file-model' } },
    });
    const projectJson = JSON.stringify({
      llm: { model: 'project-model', baseUrl: 'http://project-url' },
    });
    mockReadFile
      .mockResolvedValueOnce(fileConfig)
      .mockResolvedValueOnce(projectJson);

    const config = await getEffectiveConfig(undefined, '/project/dir');
    expect(config.model).toBe('env-model');
    expect(config.apiKey).toBe('env-key');
    expect(config.baseUrl).toBe('http://project-url');
  });

  it('maps legacy provider name inception to lmstudio', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'inception';
    mockReadFile.mockResolvedValue('{}');

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('lmstudio');
  });

  it('maps anthropic to openai', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'anthropic';
    mockReadFile.mockResolvedValue('{}');

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('openai');
  });

  it('uses OPENAI_API_KEY as fallback when no LLM_API_KEY', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai-fallback';

    const config = await getEffectiveConfig();
    expect(config.apiKey).toBe('sk-openai-fallback');
  });

  it('uses MINIMAX_API_KEY as fallback', async () => {
    process.env.MINIMAX_API_KEY = 'sk-minimax-fallback';

    const config = await getEffectiveConfig();
    expect(config.apiKey).toBe('sk-minimax-fallback');
  });

  it('prefers LLM_API_KEY over OPENAI_API_KEY', async () => {
    process.env.LIMINAL_LLM_API_KEY = 'llm-key';
    process.env.OPENAI_API_KEY = 'openai-key';

    const config = await getEffectiveConfig();
    expect(config.apiKey).toBe('llm-key');
  });

  it('uses env base URL when set', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://env-url:8080';
    mockReadFile.mockResolvedValue('{}');

    const config = await getEffectiveConfig();
    expect(config.baseUrl).toBe('http://env-url:8080');
  });

  it('uses ollama provider when configured via env', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'ollama';
    mockReadFile.mockResolvedValue('{}');

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('ollama');
  });

  it('uses minimax provider when configured via env', async () => {
    process.env.LIMINAL_LLM_PROVIDER = 'minimax';
    mockReadFile.mockResolvedValue('{}');

    const config = await getEffectiveConfig();
    expect(config.provider).toBe('minimax');
  });
});
