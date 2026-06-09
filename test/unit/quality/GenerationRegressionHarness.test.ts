import { describe, it, expect } from 'vitest';
import {
  normalizeRegressionDomain,
  inferRegressionBaseUrl,
} from '../../../src/quality/GenerationRegressionHarness.js';

describe('GenerationRegressionHarness', () => {
  describe('normalizeRegressionDomain', () => {
    it('preserves revideo domain', () => {
      expect(normalizeRegressionDomain('revideo')).toBe('revideo');
    });

    it('preserves all valid domains', () => {
      const domains = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'tone', 'html', 'ascii', 'revideo'] as const;
      domains.forEach((d) => {
        expect(normalizeRegressionDomain(d)).toBe(d);
      });
    });
  });

  describe('inferRegressionBaseUrl', () => {
    it('infers LM Studio base URL', () => {
      expect(inferRegressionBaseUrl('lmstudio')).toBe('http://localhost:1234/v1');
    });

    it('infers Ollama base URL', () => {
      expect(inferRegressionBaseUrl('ollama')).toBe('http://localhost:11434');
    });

    it('infers MiniMax base URL', () => {
      expect(inferRegressionBaseUrl('minimax')).toBe('https://api.minimax.io/anthropic');
    });

    it('infers GLM base URL', () => {
      expect(inferRegressionBaseUrl('glm')).toBe('https://api.z.ai/api/anthropic');
    });

    it('infers Kimi base URL', () => {
      expect(inferRegressionBaseUrl('kimi')).toBe('https://api.kimi.com/coding/v1');
    });

    it('prefers explicit base URL over provider default', () => {
      expect(inferRegressionBaseUrl('lmstudio', 'http://custom:9999/v1')).toBe('http://custom:9999/v1');
    });

    it('prefers explicit base URL even for unknown provider', () => {
      expect(inferRegressionBaseUrl('unknown-provider', 'http://custom:8080')).toBe('http://custom:8080');
    });

    it('throws for unknown provider without explicit base URL', () => {
      expect(() => inferRegressionBaseUrl('nonexistent-provider')).toThrow('Unknown provider');
    });
  });
});
