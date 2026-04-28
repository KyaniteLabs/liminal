import { describe, it, expect } from 'vitest';
import {
  normalizeRegressionDomain,
  inferRegressionBaseUrl,
} from '../../../src/quality/GenerationRegressionHarness.js';

describe('GenerationRegressionHarness', () => {
  it('preserves revideo domain', () => {
    expect(normalizeRegressionDomain('revideo')).toBe('revideo');
  });

  it('preserves normal domains', () => {
    expect(normalizeRegressionDomain('ascii')).toBe('ascii');
    expect(normalizeRegressionDomain('three')).toBe('three');
  });

  it('infers LM Studio base URL by default', () => {
    expect(inferRegressionBaseUrl('lmstudio')).toBe('http://localhost:1234/v1');
  });

  it('infers Ollama base URL by default', () => {
    expect(inferRegressionBaseUrl('ollama')).toBe('http://localhost:11434/v1');
  });

  it('prefers explicit base URLs', () => {
    expect(inferRegressionBaseUrl('lmstudio', 'http://127.0.0.1:9999/v1')).toBe('http://127.0.0.1:9999/v1');
  });
});
