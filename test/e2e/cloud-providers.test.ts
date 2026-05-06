/**
 * Cloud Provider Smoke Tests
 * Gate: RUN_CLOUD_MODEL_TESTS=1
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { getProviderConfig, listConfiguredProviders, type ProviderType } from '../../src/harness/MultiProviderConfig.js';

interface CloudProvider { provider: ProviderType; name: string; baseUrl: string; model: string; apiKey: string; }
interface ProviderResult { provider: string; success: boolean; latencyMs: number; codeLength: number; hasContamination: boolean; error?: string; }

const TEST_TIMEOUT = 60_000;
const MAX_LATENCY_MS = 45_000;

function loadCloudProviders(): CloudProvider[] {
  const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  const providers: CloudProvider[] = [];
  for (const provider of listConfiguredProviders()) {
    const config = getProviderConfig(provider);
    if (!config?.baseUrl || !config.model || !config.apiKey) continue;
    const url = new URL(config.baseUrl);
    if (localHosts.some(h => url.hostname === h)) continue;
    providers.push({
      provider,
      name: `${provider}:${config.model}@${url.hostname}`,
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
    });
  }
  return providers;
}

describe.skipIf(!process.env.RUN_CLOUD_MODEL_TESTS)('Cloud Provider Smoke Tests', () => {
  let cloudProviders: CloudProvider[];
  const results: ProviderResult[] = [];

  beforeAll(async () => {
    cloudProviders = loadCloudProviders();
    expect(cloudProviders.length).toBeGreaterThan(0);
    console.log(`\nCloud providers found: ${cloudProviders.map(p => p.name).join(', ')}\n`);
  });

  it('all configured cloud providers respond to a basic prompt', async () => {
    const systemPrompt = 'You are a p5.js coder. Output ONLY JavaScript code, no explanations.';
    const userPrompt = 'Create a p5.js sketch: a blue circle on a gray background. Use function setup() and function draw().';
    for (const provider of cloudProviders) {
      const start = Date.now();
      try {
        const client = new LLMClient({
          baseUrl: provider.baseUrl, model: provider.model,
          apiKey: provider.apiKey, maxTokens: 4096,
        });
        const response = await client.generate(systemPrompt, userPrompt);
        const latencyMs = Date.now() - start;
        const result: ProviderResult = {
          provider: provider.name, success: response.success,
          latencyMs, codeLength: response.code.length,
          hasContamination: response.code.includes('<think') || response.code.includes('</think'),
        };
        results.push(result);
        expect(response.success, `${provider.name}: generation should succeed`).toBe(true);
        expect(response.code.length, `${provider.name}: code should be >20 chars`).toBeGreaterThan(20);
        expect(result.hasContamination, `${provider.name}: no <think/> contamination`).toBe(false);
        expect(latencyMs, `${provider.name}: latency under ${MAX_LATENCY_MS}ms`).toBeLessThan(MAX_LATENCY_MS);
        console.log(`  ✓ [${provider.name}] ${(latencyMs / 1000).toFixed(1)}s, ${response.code.length} chars`);
      } catch (error) {
        const latencyMs = Date.now() - start;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ provider: provider.name, success: false, latencyMs, codeLength: 0, hasContamination: false, error: errorMsg });
        console.log(`  ✗ [${provider.name}] FAILED: ${errorMsg.slice(0, 200)}`);
        throw error;
      }
    }
  }, TEST_TIMEOUT * 3);

  it('summary report is complete', () => {
    expect(results.length).toBe(cloudProviders.length);
    for (const result of results) {
      expect(result.success, `${result.provider} should have succeeded`).toBe(true);
    }
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ CLOUD PROVIDER SMOKE TEST RESULTS                                │');
    console.log('├──────────────────────────────────────────────────────────────────┤');
    console.log('│ Provider                    │ Latency │ Code Size │ Contamination │');
    console.log('├──────────────────────────────────────────────────────────────────┤');
    for (const r of results) {
      const latency = `${(r.latencyMs / 1000).toFixed(1)}s`.padStart(8);
      const size = `${r.codeLength}b`.padStart(9);
      const clean = r.hasContamination ? 'FAIL' : 'CLEAN';
      console.log(`│ ${r.provider.padEnd(28)}│ ${latency} │ ${size} │ ${clean.padEnd(13)} │`);
    }
    console.log('└──────────────────────────────────────────────────────────────────┘\n');
  });
});
