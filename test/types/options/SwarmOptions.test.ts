import { describe, it, expect } from 'vitest';
import { SwarmOptions, normalizeSwarmOptions } from '../../../src/types/options/SwarmOptions.js';
import { SwarmMode } from '../../../src/swarm/types.js';

describe('SwarmOptions', () => {
  describe('interface', () => {
    it('should accept empty options', () => {
      const options: SwarmOptions = {};
      expect(options).toBeDefined();
    });

    it('should accept all swarm properties', () => {
      const options: SwarmOptions = {
        enabled: true,
        config: { ollamaHost: 'localhost' },
        mode: SwarmMode.HYBRID,
        swarmSize: 7,
        staggerDelay: 100,
        agentTimeout: 5000,
        continueOnFailure: true,
      };
      expect(options.enabled).toBe(true);
      expect(options.config).toEqual({ ollamaHost: 'localhost' });
      expect(options.mode).toBe(SwarmMode.HYBRID);
      expect(options.swarmSize).toBe(7);
      expect(options.staggerDelay).toBe(100);
      expect(options.agentTimeout).toBe(5000);
      expect(options.continueOnFailure).toBe(true);
    });

    it('should accept partial options', () => {
      const options: SwarmOptions = {
        enabled: true,
        swarmSize: 5,
      };
      expect(options.enabled).toBe(true);
      expect(options.swarmSize).toBe(5);
      expect(options.mode).toBeUndefined();
    });
  });

  describe('normalizeSwarmOptions', () => {
    it('should return defaults when given null', () => {
      const normalized = normalizeSwarmOptions(null);
      expect(normalized.enabled).toBe(false);
      expect(normalized.config).toEqual({});
      expect(normalized.mode).toBe('hybrid');
      expect(normalized.swarmSize).toBeUndefined();
      expect(normalized.staggerDelay).toBeUndefined();
      expect(normalized.agentTimeout).toBeUndefined();
      expect(normalized.continueOnFailure).toBeUndefined();
    });

    it('should return defaults when given undefined', () => {
      const normalized = normalizeSwarmOptions(undefined);
      expect(normalized.enabled).toBe(false);
      expect(normalized.config).toEqual({});
      expect(normalized.mode).toBe('hybrid');
    });

    it('should preserve provided values', () => {
      const normalized = normalizeSwarmOptions({
        enabled: true,
        mode: SwarmMode.COMPETITIVE,
        swarmSize: 10,
        staggerDelay: 200,
        agentTimeout: 10000,
        continueOnFailure: false,
      });
      expect(normalized.enabled).toBe(true);
      expect(normalized.mode).toBe(SwarmMode.COMPETITIVE);
      expect(normalized.swarmSize).toBe(10);
      expect(normalized.staggerDelay).toBe(200);
      expect(normalized.agentTimeout).toBe(10000);
      expect(normalized.continueOnFailure).toBe(false);
    });

    it('should merge config with defaults', () => {
      const normalized = normalizeSwarmOptions({
        config: { ollamaHost: 'custom-host', maxRounds: 5 },
      });
      expect(normalized.config).toEqual({ ollamaHost: 'custom-host', maxRounds: 5 });
    });
  });
});
