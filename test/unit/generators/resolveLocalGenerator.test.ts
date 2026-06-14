/**
 * Hybrid router — the resolver. Returns a local generator override only when
 * (a) roles.generatorLocal is configured AND (b) the smart router prefers local
 * for the domain's bucket. Otherwise null → the cloud generator is used.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';
import { domainToRoutingType } from '../../../src/routing/RoutingData.js';
import { resolveLocalGeneratorOverride } from '../../../src/generators/resolveLocalGenerator.js';

const LOCAL = { provider: 'ollama', baseUrl: 'http://100.113.174.74:11434/v1', model: 'gemma3:4b' };

describe('resolveLocalGeneratorOverride (hybrid router)', () => {
  let dir: string;
  let prevCfg: string | undefined;

  function writeConfig(withLocal: boolean): string {
    const cfg: { roles: Record<string, unknown> } = {
      roles: { generator: { provider: 'glm', baseUrl: 'https://api.z.ai/v1', model: 'glm-5v-turbo', apiKey: 'k' } },
    };
    if (withLocal) cfg.roles.generatorLocal = LOCAL;
    const p = join(dir, 'config.json');
    writeFileSync(p, JSON.stringify(cfg));
    return p;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sinter-hybrid-'));
    prevCfg = process.env.SINTER_CONFIG_PATH;
  });

  afterEach(() => {
    if (prevCfg === undefined) delete process.env.SINTER_CONFIG_PATH;
    else process.env.SINTER_CONFIG_PATH = prevCfg;
    LLMClient.clearGlobalCache();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for every domain when generatorLocal is not configured (opt-in/inert)', async () => {
    process.env.SINTER_CONFIG_PATH = writeConfig(false);
    LLMClient.clearGlobalCache();
    await LLMClient.loadRoles();
    expect(resolveLocalGeneratorOverride('music')).toBeNull();
    expect(resolveLocalGeneratorOverride('p5')).toBeNull();
    expect(resolveLocalGeneratorOverride(null)).toBeNull();
  });

  it('returns the local override exactly for the router\'s local-favored domains', async () => {
    process.env.SINTER_CONFIG_PATH = writeConfig(true);
    LLMClient.clearGlobalCache();
    await LLMClient.loadRoles();
    let sawLocal = false;
    let sawCloud = false;
    for (const d of ['music', 'strudel', 'code', 'p5', 'ascii', 'html', 'hydra']) {
      const wantsLocal = generatorRegistry.route(domainToRoutingType(d)).model === 'local';
      const res = resolveLocalGeneratorOverride(d);
      if (wantsLocal) {
        expect(res).toEqual({ baseUrl: LOCAL.baseUrl, model: LOCAL.model });
        sawLocal = true;
      } else {
        expect(res).toBeNull();
        sawCloud = true;
      }
    }
    // The chosen domains must exercise both branches, or the test proves nothing.
    expect(sawLocal && sawCloud).toBe(true);
  });

  it('omits apiKey from the override when the local endpoint has none (Ollama)', async () => {
    process.env.SINTER_CONFIG_PATH = writeConfig(true);
    LLMClient.clearGlobalCache();
    await LLMClient.loadRoles();
    // Find a local-favored domain to get a non-null override.
    const localDomain = ['music', 'strudel', 'code'].find(
      (d) => generatorRegistry.route(domainToRoutingType(d)).model === 'local',
    );
    expect(localDomain).not.toBeUndefined();
    const res = resolveLocalGeneratorOverride(localDomain!);
    expect(res).not.toBeNull();
    expect('apiKey' in res!).toBe(false);
  });
});
