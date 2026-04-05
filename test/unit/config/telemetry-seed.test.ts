import { describe, it, expect } from 'vitest';
import { SEED_TELEMETRY } from '../../../src/config/telemetry-seed.js';

describe('telemetry-seed', () => {
  it('exports a non-empty array of telemetry entries', () => {
    expect(Array.isArray(SEED_TELEMETRY)).toBe(true);
    expect(SEED_TELEMETRY.length).toBeGreaterThan(0);
  });

  it('each entry has required fields', () => {
    for (const entry of SEED_TELEMETRY) {
      expect(entry.id).toBeTruthy();
      expect(entry.domain).toBeTruthy();
      expect(entry.modelId).toBeTruthy();
      expect(typeof entry.generationTimeMs).toBe('number');
      expect(typeof entry.success).toBe('boolean');
    }
  });

  it('covers multiple domains', () => {
    const domains = new Set(SEED_TELEMETRY.map(e => e.domain));
    expect(domains.size).toBeGreaterThanOrEqual(6);
  });
});
