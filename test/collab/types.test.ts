// SECURITY NOTICE: All API keys in this file are FAKE test values.

import { describe, it, expect } from 'vitest';
/**
 * Collaboration layer types tests
 */

import {
  CollaborationRole,
  CollaborationPhase,
} from '../../src/collab/types.js';
import type {
  DeepCollaborationConfig,
  PhaseResult,
  Analysis,
  Synthesis,
  CollaborativeConfig,
  CollaborationRound,
  PhaseUpdate,
  DomainType,
} from '../../src/collab/types.js';

describe('Collaboration Types', () => {
  describe('CollaborationRole enum', () => {
    it('should have all expected roles', () => {
      expect(CollaborationRole.CREATOR).toBe('creator');
      expect(CollaborationRole.VISIONARY).toBe('visionary');
      expect(CollaborationRole.TECHNICAL_CRITIC).toBe('technical');
      expect(CollaborationRole.ARTISTIC_CRITIC).toBe('artistic');
      expect(CollaborationRole.DOMAIN_EXPERT).toBe('domain');
      expect(CollaborationRole.INTEGRATOR).toBe('integrator');
      expect(CollaborationRole.REFINER).toBe('refiner');
    });
  });

  describe('CollaborationPhase enum', () => {
    it('should have all expected phases', () => {
      expect(CollaborationPhase.DIVERGENCE).toBe('divergence');
      expect(CollaborationPhase.ANALYSIS).toBe('analysis');
      expect(CollaborationPhase.SYNTHESIS).toBe('synthesis');
      expect(CollaborationPhase.ITERATION).toBe('iteration');
    });
  });

  describe('DeepCollaborationConfig interface', () => {
    it('should accept valid config', () => {
      const config: DeepCollaborationConfig = {
        callLLM: async (_prompt: string, _systemPrompt?: string) => 'test',
      };

      expect(config.callLLM).toBeDefined();
    });

    it('should accept config with optional fields', () => {
      const config: DeepCollaborationConfig = {
        localBaseUrl: 'http://localhost:1234/v1',
        localModel: 'qwen3.5:4b',
        cloudApiKey: 'test-key',
        cloudModel: 'MiniMax-M2.7',
        maxPhases: 4,
        criticsPerPhase: 3,
        convergenceThreshold: 0.90,
        callLLM: async (_prompt: string, _systemPrompt?: string) => 'test',
      };

      expect(config.maxPhases).toBe(4);
      expect(config.convergenceThreshold).toBe(0.90);
    });
  });

  describe('CollaborativeConfig interface', () => {
    it('should accept valid config', () => {
      const config: CollaborativeConfig = {
        callLLM: async (_prompt: string, _systemPrompt?: string) => 'test',
      };

      expect(config.callLLM).toBeDefined();
    });

    it('should accept config with optional fields', () => {
      const config: CollaborativeConfig = {
        cloudApiKey: 'test-key',
        cloudModel: 'MiniMax-M2.7',
        maxRounds: 3,
        convergenceThreshold: 0.85,
        callLLM: async (_prompt: string, _systemPrompt?: string) => 'test',
      };

      expect(config.maxRounds).toBe(3);
      expect(config.cloudModel).toBe('MiniMax-M2.7');
    });
  });

  describe('Analysis interface', () => {
    it('should accept valid analysis', () => {
      const analysis: Analysis = {
        role: CollaborationRole.TECHNICAL_CRITIC,
        content: 'Test analysis',
        strengths: ['Good structure'],
        weaknesses: ['Missing comments'],
        suggestions: ['Add documentation'],
        score: 0.75,
      };

      expect(analysis.role).toBe(CollaborationRole.TECHNICAL_CRITIC);
      expect(analysis.strengths).toContain('Good structure');
    });
  });

  describe('Synthesis interface', () => {
    it('should accept valid synthesis', () => {
      const synthesis: Synthesis = {
        content: 'Synthesized output',
        sourceExplanation: 'Combined elements from both',
        improvements: ['Integrated feedback'],
      };

      expect(synthesis.content).toBe('Synthesized output');
      expect(synthesis.improvements).toHaveLength(1);
    });
  });

  describe('PhaseResult interface', () => {
    it('should accept valid phase result', () => {
      const phase: PhaseResult = {
        phaseName: 'Divergence',
        outputs: { creator: 'test', visionary: 'test2' },
        durationSeconds: 1.5,
      };

      expect(phase.phaseName).toBe('Divergence');
      expect(phase.outputs.creator).toBe('test');
    });
  });

  describe('CollaborationRound interface', () => {
    it('should accept valid round', () => {
      const round: CollaborationRound = {
        roundNum: 1,
        localOutput: 'local output',
        cloudOutput: 'cloud output',
      };

      expect(round.roundNum).toBe(1);
      expect(round.localOutput).toBe('local output');
    });
  });

  describe('PhaseUpdate interface', () => {
    it('should accept valid update', () => {
      const update: PhaseUpdate = {
        phaseName: 'Analysis',
        model: 'Local',
        action: 'Analyzing output',
        quality: 0.8,
      };

      expect(update.phaseName).toBe('Analysis');
      expect(update.quality).toBe(0.8);
    });
  });

  describe('DomainType', () => {
    it('should accept valid domain types', () => {
      const domains: DomainType[] = ['ascii', 'music', 'code', 'p5', 'glsl', 'three', ''];

      expect(domains).toHaveLength(7);
    });
  });
});
