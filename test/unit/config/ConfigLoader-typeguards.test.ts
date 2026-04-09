import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, getEffectiveConfig, getEffectiveRoleConfig, loadProjectConfig } from '../../../src/config/ConfigLoader.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockReadFile, mockAccess, mockStat } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: mockReadFile,
    access: mockAccess,
    stat: mockStat,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
  readFile: mockReadFile,
  access: mockAccess,
  stat: mockStat,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/config/RoleConfig.js', () => ({
  loadRoleConfig: vi.fn().mockResolvedValue({
    generator: { baseUrl: 'http://test:1234/v1', model: 'test-model', temperature: 0.7, maxTokens: 4096, timeout: 120000, thinking: { enabled: false }, streaming: false },
    evaluator: { baseUrl: 'http://test:1234/v1', model: 'test-model', temperature: 0.2, maxTokens: 4096, timeout: 120000, thinking: { enabled: false }, streaming: false },
    harness: { baseUrl: 'http://test:1234/v1', model: 'test-model', temperature: 0.5, maxTokens: 4096, timeout: 120000, thinking: { enabled: false }, streaming: true },
  }),
}));

// ===========================================================================
// isValidProjectConfig type guard tests
// ===========================================================================

describe('isValidProjectConfig type guard', () => {
  beforeEach(() => {
    mockStat.mockResolvedValue({ isDirectory: () => true });
  });

  it('accepts empty object as valid minimal config', async () => {
    mockReadFile.mockResolvedValue('{}');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with only name field', async () => {
    mockReadFile.mockResolvedValue('{"name": "test-project"}');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.name).toBe('test-project');
    }
  });

  it('accepts config with nested llm object', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      name: 'test',
      llm: { provider: 'ollama', model: 'qwen:7b', baseUrl: 'http://localhost:11434' },
    }));
    const result = await loadProjectConfig('/test/dir');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with multiModel configuration', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      multiModel: {
        primary: { model: 'fast-model', baseUrl: 'http://fast:1234' },
        secondary: { model: 'slow-model', baseUrl: 'http://slow:1234' },
      },
    }));
    const result = await loadProjectConfig('/test/dir');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with all optional fields', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      name: 'full-config',
      version: '1.0.0',
      loop: { maxIterations: 10, timeoutMinutes: 30 },
      llm: { provider: 'openai', model: 'gpt-4', apiKey: 'sk-test' },
      creative: { defaultFramework: 'p5', minQualityScore: 0.8 },
      gallery: { autoSave: true },
      renderer: { port: 3000 },
      swarm: { mode: 'competitive', maxRounds: 5 },
      compost: { heapDir: './heap' },
      evolution: { useMapElites: true },
      intuition: { enabled: true },
    }));
    const result = await loadProjectConfig('/test/dir');
    expect(result.isOk()).toBe(true);
  });

  it('rejects null as invalid', async () => {
    mockReadFile.mockResolvedValue('null');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-object values (string)', async () => {
    mockReadFile.mockResolvedValue('"not an object"');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-object values (number)', async () => {
    mockReadFile.mockResolvedValue('123');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-object values (boolean)', async () => {
    mockReadFile.mockResolvedValue('true');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-object values (array)', async () => {
    mockReadFile.mockResolvedValue('[1, 2, 3]');
    const result = await loadProjectConfig('/test/dir');
    expect(result.isErr()).toBe(true);
  });
});

// ===========================================================================
// isValidUserConfig type guard tests
// ===========================================================================

describe('isValidUserConfig type guard', () => {
  beforeEach(() => {
    mockAccess.mockImplementation(async () => {});
  });

  it('accepts empty object as valid', async () => {
    mockReadFile.mockResolvedValue('{}');
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with defaultProvider string', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'openai',
      providers: {},
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with providers object', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'ollama',
      providers: {
        ollama: { baseUrl: 'http://localhost:11434', model: 'llama2' },
      },
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.providers.ollama.model).toBe('llama2');
    }
  });

  it('accepts config with loop options', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'test',
      loop: { maxIterations: 5, timeoutMinutes: 10 },
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with creative options', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'test',
      creative: { minQualityScore: 0.75 },
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
  });

  it('accepts config with galleryPath', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'test',
      galleryPath: 'my-gallery',
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isOk()).toBe(true);
  });

  it('rejects null as invalid', async () => {
    mockReadFile.mockResolvedValue('null');
    const result = await loadConfig('/test/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('rejects non-object values', async () => {
    mockReadFile.mockResolvedValue('123');
    const result = await loadConfig('/test/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('rejects providers that are not objects', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'test',
      providers: 'not-an-object',
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('rejects providers that are null', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 'test',
      providers: null,
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isErr()).toBe(true);
  });

  it('rejects defaultProvider that is not a string', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({
      defaultProvider: 123,
    }));
    const result = await loadConfig('/test/config.json');
    expect(result.isErr()).toBe(true);
  });
});

// ===========================================================================
// getEffectiveRoleConfig tests
// ===========================================================================

describe('getEffectiveRoleConfig', () => {
  it('returns role config from loadRoleConfig', async () => {
    const result = await getEffectiveRoleConfig('/test/project');
    expect(result).toHaveProperty('generator');
    expect(result).toHaveProperty('evaluator');
    expect(result).toHaveProperty('harness');
    expect(result.generator.model).toBe('test-model');
    expect(result.evaluator.temperature).toBe(0.2);
    expect(result.harness.streaming).toBe(true);
  });
});
