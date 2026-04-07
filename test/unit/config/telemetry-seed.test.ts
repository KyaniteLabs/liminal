import { describe, it, expect } from 'vitest';
import { SEED_TELEMETRY } from '../../../src/config/telemetry-seed.js';

describe('SEED_TELEMETRY', () => {
  it('contains exactly 48 entries (6 LLM domains x 6 models + 2 template domains x 6 models)', () => {
    expect(SEED_TELEMETRY.length).toBe(48);
  });

  it('has entries from the audit date 2026-03-31', () => {
    const allDates = SEED_TELEMETRY.map(e => e.timestamp.toISOString().slice(0, 10));
    const uniqueDates = [...new Set(allDates)];
    expect(uniqueDates).toEqual(['2026-03-31']);
  });

  it('covers all 8 expected domains', () => {
    const domains = [...new Set(SEED_TELEMETRY.map(e => e.domain))].sort();
    expect(domains).toEqual(['ascii', 'glsl', 'html', 'hydra', 'p5', 'remotion', 'strudel', 'three']);
  });

  it('covers all 6 expected model IDs', () => {
    const models = [...new Set(SEED_TELEMETRY.map(e => e.modelId))].sort();
    expect(models).toEqual([
      'gemma3-4b',
      'kimi-k2.5',
      'minimax-m2.5',
      'minimax-m2.7',
      'qwen3-coder-40b',
      'qwen3.5-9b',
    ]);
  });

  it('every entry has required fields with correct types', () => {
    for (const entry of SEED_TELEMETRY) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(typeof entry.domain).toBe('string');
      expect(entry.domain.length).toBeGreaterThan(0);
      expect(typeof entry.modelId).toBe('string');
      expect(entry.modelId.length).toBeGreaterThan(0);
      expect(typeof entry.provider).toBe('string');
      expect(typeof entry.generationTimeMs).toBe('number');
      expect(entry.generationTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof entry.outputSizeBytes).toBe('number');
      expect(entry.outputSizeBytes).toBeGreaterThan(0);
      expect(typeof entry.validationPassed).toBe('boolean');
      expect(Array.isArray(entry.validationErrors)).toBe(true);
      expect(typeof entry.success).toBe('boolean');
    }
  });

  it('marks 5 failed entries consistently (success=false, validationPassed=false, has errors)', () => {
    const failed = SEED_TELEMETRY.filter(e => !e.success);
    expect(failed.length).toBe(5);

    for (const entry of failed) {
      expect(entry.validationPassed).toBe(false);
      expect(entry.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it('successful entries have empty validationErrors arrays', () => {
    const successful = SEED_TELEMETRY.filter(e => e.success);
    for (const entry of successful) {
      expect(entry.validationErrors).toEqual([]);
    }
  });

  it('maps providers correctly based on modelId for template domains', () => {
    const htmlEntries = SEED_TELEMETRY.filter(e => e.domain === 'html');
    const providerMap: Record<string, string> = {};
    for (const entry of htmlEntries) {
      providerMap[entry.modelId] = entry.provider;
    }
    expect(providerMap['minimax-m2.7']).toBe('minimax');
    expect(providerMap['minimax-m2.5']).toBe('minimax');
    expect(providerMap['qwen3.5-9b']).toBe('qwen');
    expect(providerMap['qwen3-coder-40b']).toBe('qwen');
    expect(providerMap['gemma3-4b']).toBe('ollama');
    expect(providerMap['kimi-k2.5']).toBe('kimi');
  });

  it('HTML and ASCII template entries have generation time of 40ms', () => {
    const templateEntries = SEED_TELEMETRY.filter(
      e => e.domain === 'html' || e.domain === 'ascii'
    );
    for (const entry of templateEntries) {
      expect(entry.generationTimeMs).toBe(40);
    }
  });

  it('three.js qwen3.5-9b failure has correct error details', () => {
    const failure = SEED_TELEMETRY.find(e => e.id === 'audit-three-qwen35-9b');
    expect(failure).not.toBeUndefined();
    expect(failure!.success).toBe(false);
    expect(failure!.outputSizeBytes).toBe(66);
    expect(failure!.validationErrors).toEqual([
      'Output too small (66b) - minimum is 800b',
    ]);
  });

  it('each LLM-generated domain has exactly 6 entries (one per model)', () => {
    const llmDomains = ['p5', 'glsl', 'three', 'hydra', 'strudel', 'remotion'];
    for (const domain of llmDomains) {
      const entries = SEED_TELEMETRY.filter(e => e.domain === domain);
      expect(entries.length, `domain ${domain} should have 6 entries`).toBe(6);
    }
  });
});
