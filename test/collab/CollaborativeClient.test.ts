// SECURITY NOTICE: All API keys in this file are FAKE test values.

import { describe, it, expect, beforeEach } from 'vitest';
/**
 * CollaborativeClient tests
 */

import { CollaborativeClient } from '../../src/collab/CollaborativeClient.js';
import type { PhaseUpdate } from '../../src/collab/types.js';

// Mock LLM caller
const mockCallLLM = async (llmPrompt: string, _systemPrompt?: string): Promise<string> => {
  if (llmPrompt.includes('local model')) {
    return 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(200); }';
  }
  if (llmPrompt.includes('cloud model') || llmPrompt.includes('alternative')) {
    return 'function setup() { createCanvas(600, 600); colorMode(HSB); }\nfunction draw() { background(180); }';
  }
  if (llmPrompt.includes('Analyze this output')) {
    return 'Strengths: Good structure\nWeaknesses: Simple\nSuggestions: Add more elements';
  }
  if (llmPrompt.includes('Refine your work')) {
    return 'function setup() { createCanvas(500, 500); }\nfunction draw() { background(200); ellipse(250, 250, 100); }';
  }
  if (llmPrompt.includes('Rate this output')) {
    return '0.75';
  }
  return 'Response';
};

describe('CollaborativeClient', () => {
  let client: CollaborativeClient;

  beforeEach(() => {
    client = new CollaborativeClient({
      callLLM: mockCallLLM,
      maxRounds: 2,
      convergenceThreshold: 0.95,
    });
  });

  describe('constructor', () => {
    it('should create instance with minimal config', () => {
      const collab = new CollaborativeClient({
        callLLM: mockCallLLM,
      });

      expect(collab).toBeDefined();
    });

    it('should create instance with full config', () => {
      const collab = new CollaborativeClient({
        cloudApiKey: 'test-key',
        cloudModel: 'MiniMax-M2.7',
        maxRounds: 3,
        convergenceThreshold: 0.85,
        callLLM: mockCallLLM,
      });

      expect(collab).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate output using collaboration', async () => {
      const result = await client.generate(
        'Create a blue circle',
        'p5'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should call progress callback when provided', async () => {
      const updates: PhaseUpdate[] = [];

      await client.generate(
        'Create particles',
        'p5',
        '',
        (update) => updates.push(update)
      );

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[0].phaseName).toBeDefined();
      expect(updates[0].model).toBeDefined();
      expect(updates[0].action).toBeDefined();
    });
  });

  describe('generateCollaborative', () => {
    it('should return full collaboration result', async () => {
      const result = await client.generateCollaborative(
        'Create generative art',
        'p5'
      );

      expect(result).toBeDefined();
      expect(result.finalOutput).toBeDefined();
      expect(result.rounds).toBeInstanceOf(Array);
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.totalDurationSeconds).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
      expect(result.metadata).toBeDefined();
    });

    it('should have generation phase in first round', async () => {
      const result = await client.generateCollaborative(
        'Test prompt',
        'p5'
      );

      expect(result.rounds[0].roundNum).toBe(1);
      expect(result.rounds[0].localOutput).toBeDefined();
      expect(result.rounds[0].cloudOutput).toBeDefined();
    });

    it('should include analysis and refinement in rounds', async () => {
      const result = await client.generateCollaborative(
        'Test prompt',
        'p5'
      );

      // Check that at least one round has analysis and refinement
      const hasAnalysis = result.rounds.some(r => r.localAnalysisOfCloud || r.cloudAnalysisOfLocal);
      const hasRefinement = result.rounds.some(r => r.localRefined || r.cloudRefined);

      expect(hasAnalysis || hasRefinement).toBe(true);
    });

    it('should track source of final output', async () => {
      const result = await client.generateCollaborative(
        'Test prompt',
        'p5'
      );

      // Source can be local, cloud, local_refined, or cloud_refined
      expect(result.source).toBeTruthy();
      expect(typeof result.source).toBe('string');
    });

    it('should report convergence status', async () => {
      const result = await client.generateCollaborative(
        'Test prompt',
        'p5'
      );

      expect(result.metadata.converged).toBeDefined();
      expect(typeof result.metadata.converged).toBe('boolean');
    });
  });

  describe('generateLocal', () => {
    it('should generate using local model only', async () => {
      const result = await client.generateLocal('Create a circle');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateCloud', () => {
    it('should generate using cloud model only', async () => {
      const result = await client.generateCloud('Create a circle');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('phase callbacks', () => {
    it('should report generation phase', async () => {
      const updates: PhaseUpdate[] = [];

      await client.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const generationUpdates = updates.filter(u => u.phaseName === 'Generation');
      expect(generationUpdates.length).toBeGreaterThan(0);
    });

    it('should report analysis phase', async () => {
      const updates: PhaseUpdate[] = [];

      await client.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const analysisUpdates = updates.filter(u => u.phaseName === 'Analysis');
      expect(analysisUpdates.length).toBeGreaterThan(0);
    });

    it('should report refinement phase', async () => {
      const updates: PhaseUpdate[] = [];

      await client.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const refinementUpdates = updates.filter(u => u.phaseName === 'Refinement');
      expect(refinementUpdates.length).toBeGreaterThan(0);
    });

    it('should report selection phase', async () => {
      const updates: PhaseUpdate[] = [];

      await client.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const selectionUpdates = updates.filter(u => u.phaseName === 'Selection');
      expect(selectionUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('quality scoring', () => {
    it('should score outputs correctly', async () => {
      const result = await client.generateCollaborative(
        'Test prompt',
        'p5'
      );

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should handle different domains', async () => {
      const p5Result = await client.generate('Test', 'p5');
      const asciiResult = await client.generate('Test', 'ascii');
      const musicResult = await client.generate('Test', 'music');

      expect(p5Result).toBeDefined();
      expect(asciiResult).toBeDefined();
      expect(musicResult).toBeDefined();
    });
  });
});
