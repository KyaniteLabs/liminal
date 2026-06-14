/**
 * B4 regression: the meta-harness must resolve its model through the `harness`
 * role (e.g. MiniMax-M3), NOT inherit the active generator provider (e.g. GLM).
 *
 * MetaHarnessIntegration used to build its client as
 *   new LLMClient({ ...getActiveProviderConfig(), role: 'harness' })
 * Spreading the active provider's baseUrl/model set `explicitEndpointConfig`,
 * which overrode role resolution — so the harness silently ran on the generator's
 * model. With `roles.harness = MiniMax` and `roles.generator = GLM`, that put the
 * harness on GLM (wrong model + extra load on the rate-limited generator endpoint).
 *
 * The fix builds `new LLMClient({ role: 'harness' })` after `loadRoles()`. These
 * tests pin the resolution behavior the fix relies on, at the LLMClient/RoleConfig
 * boundary (MetaHarnessIntegration.initialize() itself is not unit-tested because
 * it initializes user-level harnessMemory, which has no delete API).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LLMClient } from '../../../src/llm/LLMClient.js';

describe('harness model resolution (B4)', () => {
  const HARNESS = { baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M3' };
  const GENERATOR = { baseUrl: 'https://api.z.ai/v1', model: 'glm-5v-turbo' };

  let dir: string;
  let prevCfg: string | undefined;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sinter-harness-role-'));
    const cfgPath = join(dir, 'config.json');
    writeFileSync(cfgPath, JSON.stringify({
      roles: {
        generator: { provider: 'glm', baseUrl: GENERATOR.baseUrl, model: GENERATOR.model, apiKey: 'k', temperature: 0.7 },
        evaluator: { provider: 'glm', baseUrl: GENERATOR.baseUrl, model: GENERATOR.model, apiKey: 'k', temperature: 0.2 },
        harness: { provider: 'minimax', baseUrl: HARNESS.baseUrl, model: HARNESS.model, apiKey: 'k', temperature: 0.5 },
        studio: { provider: 'minimax', baseUrl: HARNESS.baseUrl, model: HARNESS.model, apiKey: 'k', temperature: 0.6 },
      },
    }));
    prevCfg = process.env.SINTER_CONFIG_PATH;
    process.env.SINTER_CONFIG_PATH = cfgPath;
    LLMClient.clearGlobalCache();
    await LLMClient.loadRoles();
  });

  afterEach(() => {
    if (prevCfg === undefined) delete process.env.SINTER_CONFIG_PATH;
    else process.env.SINTER_CONFIG_PATH = prevCfg;
    LLMClient.clearGlobalCache();
    rmSync(dir, { recursive: true, force: true });
  });

  it('resolves the harness to its role model (MiniMax), not the generator (the fix)', () => {
    const client = new LLMClient({ role: 'harness' });
    expect(client.getConfig().model).toBe(HARNESS.model);
    expect(client.getConfig().baseUrl).toContain('api.minimax.io');
  });

  it('spreading the active generator provider hijacks the harness to GLM (the removed bug)', () => {
    const hijacked = new LLMClient({ baseUrl: GENERATOR.baseUrl, model: GENERATOR.model, role: 'harness' });
    expect(hijacked.getConfig().model).toBe(GENERATOR.model);
    expect(hijacked.getConfig().baseUrl).toContain('api.z.ai');
  });

  it('keeps the harness role temperature (0.5), not the generator default (0.7)', () => {
    const client = new LLMClient({ role: 'harness' });
    expect(client.getConfig().temperature).toBe(0.5);
  });
});
