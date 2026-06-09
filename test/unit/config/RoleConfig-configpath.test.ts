import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveUserConfigPath,
  loadRoleConfig,
  saveRoleConfig,
} from '../../../src/config/RoleConfig.js';
import type { RoleConfigFile } from '../../../src/config/RoleConfig.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Per-process config override (SINTER_CONFIG_PATH / LIMINAL_CONFIG_PATH) — lets a
// background daemon use its own model config without mutating ~/.sinter/config.json.

describe('resolveUserConfigPath', () => {
  let prevSinter: string | undefined;
  let prevLiminal: string | undefined;

  beforeEach(() => {
    prevSinter = process.env.SINTER_CONFIG_PATH;
    prevLiminal = process.env.LIMINAL_CONFIG_PATH;
    delete process.env.SINTER_CONFIG_PATH;
    delete process.env.LIMINAL_CONFIG_PATH;
  });
  afterEach(() => {
    if (prevSinter === undefined) delete process.env.SINTER_CONFIG_PATH; else process.env.SINTER_CONFIG_PATH = prevSinter;
    if (prevLiminal === undefined) delete process.env.LIMINAL_CONFIG_PATH; else process.env.LIMINAL_CONFIG_PATH = prevLiminal;
  });

  it('defaults to ~/.sinter/config.json when no override is set', () => {
    expect(resolveUserConfigPath()).toBe(path.join(os.homedir(), '.sinter', 'config.json'));
  });

  it('uses SINTER_CONFIG_PATH when set', () => {
    process.env.SINTER_CONFIG_PATH = '/tmp/daemon-config.json';
    expect(resolveUserConfigPath()).toBe('/tmp/daemon-config.json');
  });

  it('falls back to LIMINAL_CONFIG_PATH (matches the TUI bridge launcher)', () => {
    process.env.LIMINAL_CONFIG_PATH = '/tmp/legacy-config.json';
    expect(resolveUserConfigPath()).toBe('/tmp/legacy-config.json');
  });

  it('prefers SINTER_CONFIG_PATH over LIMINAL_CONFIG_PATH', () => {
    process.env.SINTER_CONFIG_PATH = '/tmp/sinter.json';
    process.env.LIMINAL_CONFIG_PATH = '/tmp/liminal.json';
    expect(resolveUserConfigPath()).toBe('/tmp/sinter.json');
  });

  it('ignores a blank/whitespace override and falls back to the default', () => {
    process.env.SINTER_CONFIG_PATH = '   ';
    expect(resolveUserConfigPath()).toBe(path.join(os.homedir(), '.sinter', 'config.json'));
  });
});

describe('loadRoleConfig honors SINTER_CONFIG_PATH', () => {
  let tmpDir: string;
  let prevSinter: string | undefined;

  beforeEach(async () => {
    prevSinter = process.env.SINTER_CONFIG_PATH;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sinter-cfgpath-'));
  });
  afterEach(async () => {
    if (prevSinter === undefined) delete process.env.SINTER_CONFIG_PATH; else process.env.SINTER_CONFIG_PATH = prevSinter;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves the generator from the override config file, not the global one', async () => {
    const overridePath = path.join(tmpDir, 'daemon-config.json');
    const daemonConfig: RoleConfigFile = {
      roles: {
        generator: {
          provider: 'custom',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-v4-flash',
          apiKey: 'sk-test-daemon-key',
          temperature: 0.7,
        },
      },
    } as RoleConfigFile;
    // Write via the same code path the CLI uses, targeting the override file explicitly.
    await saveRoleConfig(daemonConfig, overridePath);

    process.env.SINTER_CONFIG_PATH = overridePath;
    // Pass a project dir with no config/ so only the (overridden) user config applies.
    const roles = await loadRoleConfig(tmpDir);

    expect(roles.generator.model).toBe('deepseek-v4-flash');
    expect(roles.generator.baseUrl).toBe('https://api.deepseek.com/v1');
  });
});
