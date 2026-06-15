/**
 * Honest plugin-load reporting (cluster C12).
 *
 * The 9 shipped plugin manifests declare `entry: "index.js"`, but the plugins/
 * directory is excluded from tsconfig so no `.js` is ever compiled. Every dynamic
 * import therefore throws ENOENT and the loader returns 9 failures. The OLD code
 * logged only a static-generator count, masking those 9 failures as a success.
 *
 * These tests assert the concrete HONEST numbers: a 0/9 load is reported as such
 * (with the missing-compiled-entry count surfaced) and does NOT throw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRegister, mockGetAll } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockGetAll: vi.fn().mockReturnValue([]),
}));

const { mockLoadAll, mockGetAllPlugins } = vi.hoisted(() => ({
  mockLoadAll: vi.fn().mockResolvedValue([]),
  mockGetAllPlugins: vi.fn().mockReturnValue([]),
}));

const { mockInfo, mockWarn } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../../../src/generators/GeneratorRegistry.js', () => ({
  generatorRegistry: {
    register: mockRegister,
    getAll: mockGetAll,
  },
}));

vi.mock('../../../src/plugins/PluginLoader.js', () => ({
  pluginLoader: {
    loadAll: mockLoadAll,
    getAllPlugins: mockGetAllPlugins,
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: mockInfo,
    warn: mockWarn,
    error: vi.fn(),
  },
}));

import { registerAllGenerators } from '../../../src/generators/registerGenerators.js';

/** Nine failed loads, mirroring the nine uncompiled plugin manifests. */
const nineFailures = () =>
  Array.from({ length: 9 }, (_, i) => ({
    success: false as const,
    error: {
      pluginId: `plugin-${i}`,
      path: `/plugins/plugin-${i}`,
      error: 'ENOENT: no such file or directory',
    },
  }));

describe('registerGenerators honest plugin reporting (C12)', () => {
  beforeEach(() => {
    mockRegister.mockClear();
    mockGetAll.mockClear().mockReturnValue([]);
    mockLoadAll.mockClear().mockResolvedValue([]);
    mockGetAllPlugins.mockClear().mockReturnValue([]);
    mockInfo.mockClear();
    mockWarn.mockClear();
  });

  it('resolves without throwing when all 9 plugin manifests fail to load', async () => {
    mockLoadAll.mockResolvedValueOnce(nineFailures());
    mockGetAll.mockReturnValue([]);
    mockGetAllPlugins.mockReturnValue([]);

    await expect(registerAllGenerators()).resolves.toBeUndefined();
  });

  it('reports the honest 0/9 loaded count with the 9 missing entries surfaced (not masked)', async () => {
    mockLoadAll.mockResolvedValueOnce(nineFailures());
    mockGetAll.mockReturnValue([]);
    mockGetAllPlugins.mockReturnValue([]);

    await registerAllGenerators();

    const messages = mockInfo.mock.calls.map(([, message]) => message as string);

    // The honest outcome message must name the real numbers.
    const honest = messages.find((m) => m.includes('plugins:'));
    expect(honest).toBe('plugins: 0/9 loaded (9 missing compiled entry); registered 13 static generators');

    // It must NOT mask the failures behind a plain static-only success line.
    expect(messages).not.toContain('Registered 13 static generators');
  });

  it('still registers all 13 static generators despite every plugin failing', async () => {
    mockLoadAll.mockResolvedValueOnce(nineFailures());
    mockGetAll.mockReturnValue([]);
    mockGetAllPlugins.mockReturnValue([]);

    await registerAllGenerators();

    expect(mockRegister).toHaveBeenCalledTimes(13);
  });

  it('reports honest counts when some plugins load and some fail', async () => {
    const mixed = [
      { success: true as const },
      { success: true as const },
      ...nineFailures().slice(0, 3),
    ];
    mockLoadAll.mockResolvedValueOnce(mixed);
    // Two plugins registered with the registry before the static backfill runs.
    mockGetAll
      .mockReturnValueOnce([])
      .mockReturnValue([{ name: 'plugin-a' }, { name: 'plugin-b' }]);
    mockGetAllPlugins.mockReturnValue([
      { manifest: { id: 'plugin-a' }, canHandle: () => 0.5, generate: vi.fn() },
      { manifest: { id: 'plugin-b' }, canHandle: () => 0.5, generate: vi.fn() },
    ]);

    await registerAllGenerators();

    const messages = mockInfo.mock.calls.map(([, message]) => message as string);
    const honest = messages.find((m) => m.includes('plugins:'));
    expect(honest).toBe('plugins: 2/5 loaded (3 missing compiled entry); registered 13 static generators');
  });

  it('uses the pure static line only when zero plugin manifests are present', async () => {
    mockLoadAll.mockResolvedValueOnce([]); // no plugin dirs / manifests at all
    mockGetAll.mockReturnValue([]);
    mockGetAllPlugins.mockReturnValue([]);

    await registerAllGenerators();

    const messages = mockInfo.mock.calls.map(([, message]) => message as string);
    expect(messages).toContain('Registered 13 static generators');
    expect(messages.some((m) => m.includes('plugins:'))).toBe(false);
  });
});
