// SECURITY NOTICE: All API keys in this file are FAKE test values.

import { describe, it, expect, beforeEach } from 'vitest';
/**
 * DeepCollaboration tests
 */

import { DeepCollaboration } from '../../src/collab/DeepCollaboration.js';
import type { PhaseUpdate } from '../../src/collab/types.js';
import '../../src/prompts/compost.js'; // Register compost prompt templates

// Mock LLM caller
const mockCallLLM = async (llmPrompt: string, _systemPrompt?: string): Promise<string> => {
  // Return different responses based on prompt content
  if (llmPrompt.includes('CREATOR')) {
    return 'function setup() { createCanvas(400, 400); }\nfunction draw() { background(220); }';
  }
  if (llmPrompt.includes('VISIONARY')) {
    return 'function setup() { createCanvas(600, 600); colorMode(HSB); }\nfunction draw() { background(frameCount % 360); }';
  }
  if (llmPrompt.includes('Synthesize')) {
    return 'function setup() { createCanvas(500, 500); }\nfunction draw() { background(200); ellipse(250, 250, 100); }';
  }
  if (llmPrompt.includes('TECHNICAL CRITIC')) {
    return 'Strengths: Good structure\nWeaknesses: No error handling\nScore: 0.7';
  }
  if (llmPrompt.includes('ARTISTIC CRITIC')) {
    return 'Strengths: Clean visuals\nWeaknesses: Could be more dynamic\nScore: 0.75';
  }
  if (llmPrompt.includes('DOMAIN EXPERT')) {
    return 'Assessment: Meets basic p5.js standards\nImprovements: Add comments';
  }
  if (llmPrompt.includes('INTEGRATOR')) {
    return 'function setup() { createCanvas(500, 500); colorMode(HSB); }\nfunction draw() { background(200); ellipse(250, 250, 100); }';
  }
  if (llmPrompt.includes('REFINER')) {
    return 'function setup() { createCanvas(500, 500); colorMode(HSB); }\nfunction draw() { background(200); noStroke(); ellipse(250, 250, 100); }';
  }
  return 'Default response';
};

describe('DeepCollaboration', () => {
  let collaboration: DeepCollaboration;
  const phaseUpdates: PhaseUpdate[] = [];

  beforeEach(() => {
    collaboration = new DeepCollaboration({
      callLLM: mockCallLLM,
      maxPhases: 2,
      convergenceThreshold: 0.95,
    });
    phaseUpdates.length = 0; // Clear updates
  });

  describe('constructor', () => {
    it('should create instance with minimal config', () => {
      const collab = new DeepCollaboration({
        callLLM: mockCallLLM,
      });

      expect(collab).toBeDefined();
    });

    it('should create instance with full config', () => {
      const collab = new DeepCollaboration({
        localBaseUrl: 'http://localhost:1234/v1',
        localModel: 'qwen3.5:4b',
        cloudApiKey: 'test-key',
        cloudModel: 'MiniMax-M2.7',
        maxPhases: 4,
        criticsPerPhase: 3,
        convergenceThreshold: 0.90,
        callLLM: mockCallLLM,
      });

      expect(collab).toBeDefined();
    });
  });

  describe('generate', () => {
    it('should generate output using deep collaboration', async () => {
      const result = await collaboration.generate(
        'Create a blue circle',
        'p5'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should call phase callback when provided', async () => {
      const updates: PhaseUpdate[] = [];

      await collaboration.generate(
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

  describe('generateDeepCollaboration', () => {
    it('should return full collaboration result', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Create generative art',
        'p5'
      );

      expect(result).toBeDefined();
      expect(result.finalOutput).toBeDefined();
      expect(result.phases).toBeInstanceOf(Array);
      expect(result.phases.length).toBeGreaterThan(0);
      expect(result.totalDurationSeconds).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
      expect(result.improvementTrajectory).toBeInstanceOf(Array);
      expect(result.metadata).toBeDefined();
    });

    it('should have divergence phase as first phase', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Test prompt',
        'p5'
      );

      expect(result.phases[0].phaseName).toBe('Divergence');
      expect(result.phases[0].outputs).toBeDefined();
      expect(result.phases[0].outputs.creator).toBeDefined();
      expect(result.phases[0].outputs.visionary).toBeDefined();
      expect(result.phases[0].synthesis).toBeDefined();
    });

    it('should include analysis phases after divergence', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Test prompt',
        'p5'
      );

      const analysisPhases = result.phases.filter(p => p.phaseName === 'Analysis');
      expect(analysisPhases.length).toBeGreaterThan(0);
      expect(analysisPhases[0].analyses).toBeDefined();
      expect(analysisPhases[0].analyses?.length).toBeGreaterThan(0);
    });

    it('should include synthesis phases', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Test prompt',
        'p5'
      );

      const synthesisPhases = result.phases.filter(p => p.phaseName === 'Synthesis');
      expect(synthesisPhases.length).toBeGreaterThan(0);
    });

    it('should track quality trajectory', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Test prompt',
        'p5'
      );

      expect(result.improvementTrajectory.length).toBeGreaterThan(0);
      result.improvementTrajectory.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should report convergence status in metadata', async () => {
      const result = await collaboration.generateDeepCollaboration(
        'Test prompt',
        'p5'
      );

      expect(result.metadata.converged).toBeDefined();
      expect(typeof result.metadata.converged).toBe('boolean');
      expect(result.metadata.totalPhases).toBeDefined();
      expect(result.metadata.improvement).toBeDefined();
    });
  });

  describe('quality scoring', () => {
    it('should score p5 code appropriately', async () => {
      const fullResult = await collaboration.generateDeepCollaboration(
        'Create p5 sketch',
        'p5'
      );

      expect(fullResult.qualityScore).toBeGreaterThanOrEqual(0);
      expect(fullResult.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should score ASCII art appropriately', async () => {
      const result = await collaboration.generate(
        'Draw a cat',
        'ascii'
      );

      expect(result).toBeDefined();
    });

    it('should score music appropriately', async () => {
      const result = await collaboration.generate(
        'Create melody',
        'music'
      );

      expect(result).toBeDefined();
    });
  });

  describe('phase callbacks', () => {
    it('should report divergence phase updates', async () => {
      const updates: PhaseUpdate[] = [];

      await collaboration.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const divergenceUpdates = updates.filter(u => u.phaseName === 'Divergence');
      expect(divergenceUpdates.length).toBeGreaterThan(0);
    });

    it('should report analysis phase updates', async () => {
      const updates: PhaseUpdate[] = [];

      await collaboration.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const analysisUpdates = updates.filter(u => u.phaseName === 'Analysis');
      expect(analysisUpdates.length).toBeGreaterThan(0);
    });

    it('should report synthesis phase updates', async () => {
      const updates: PhaseUpdate[] = [];

      await collaboration.generate(
        'Test',
        'p5',
        '',
        (update) => updates.push(update)
      );

      const synthesisUpdates = updates.filter(u => u.phaseName === 'Synthesis');
      expect(synthesisUpdates.length).toBeGreaterThan(0);
    });
  });
});
