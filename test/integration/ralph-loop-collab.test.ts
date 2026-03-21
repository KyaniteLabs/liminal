import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Integration tests for RalphLoop with Deep Collaboration
 *
 * Tests the integration of RalphLoop with DeepCollaboration and CollaborativeClient
 * using mock LLM callers to verify the loop still iterates correctly with collaboration.
 */

import { RalphLoop } from '../../src/core/RalphLoop.js';
import path from 'path';
import os from 'os';

const TEST_GALLERY_DIR = path.join(os.tmpdir(), 'atelier-ralph-collab-integration-test');

describe('RalphLoop with Deep Collaboration Integration', () => {
  beforeEach(() => {
    RalphLoop.reset();
  });

  describe('RalphLoop with DeepCollaboration', () => {
    it('uses DeepCollaboration when useDeepCollab is true with mock LLM', async () => {
      // Mock LLM caller that returns predictable outputs
      const mockLLMCalls: string[] = [];
      const mockLLM = async (prompt: string, _systemPrompt?: string): Promise<string> => {
        mockLLMCalls.push(prompt);
        // Return different responses based on prompt content to simulate collaboration
        if (prompt.includes('CREATOR')) {
          return 'function setup() { createCanvas(400, 400); } function draw() { background(0); }';
        } else if (prompt.includes('VISIONARY')) {
          return 'function setup() { createCanvas(800, 600); } function draw() { background(255); circle(200, 200, 50); }';
        } else if (prompt.includes('TECHNICAL CRITIC')) {
          return 'Technical: Code structure is good, but missing error handling.';
        } else if (prompt.includes('ARTISTIC CRITIC')) {
          return 'Artistic: Good contrast, but could use more dynamic elements.';
        } else if (prompt.includes('DOMAIN EXPERT')) {
          return 'Domain: Proper p5.js patterns used.';
        } else if (prompt.includes('INTEGRATOR')) {
          return 'function setup() { createCanvas(600, 600); } function draw() { background(128); circle(300, 300, 100); }';
        } else if (prompt.includes('REFINER')) {
          return 'function setup() { createCanvas(600, 600); } function draw() { background(100); for(let i=0; i<10; i++) { circle(random(width), random(height), 50); } }';
        }
        return 'function setup() { createCanvas(400, 400); } function draw() { point(200, 200); }';
      };

      const progressCalls: any[] = [];

      // Use a generic prompt that won't match specialized generators
      const result = await RalphLoop.run('create a simple sketch with circles', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'deep-collab-integration-test',
        useDeepCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxPhases: 2,
        },
        collabDomain: 'p5',
        onProgress: (data) => progressCalls.push(data),
      });

      // Verify the loop completed
      expect(result.iterations).toBe(1);
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);

      // Verify the mock LLM was called multiple times (collaboration phases)
      // With 2 phases: divergence (creator + visionary + synthesis) + analysis + synthesis
      // Expected: at least 3-4 calls for divergence phase alone
      expect(mockLLMCalls.length).toBeGreaterThanOrEqual(3);

      // Verify progress was reported
      expect(progressCalls.length).toBeGreaterThanOrEqual(1);
      // Note: collaboration phase updates have iteration 0, loop iteration updates have the actual iteration number
      expect(progressCalls[0]).toMatchObject({
        score: expect.any(Number),
        promiseDetected: expect.any(Boolean),
        code: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('converges early when quality threshold is reached', async () => {
      let callCount = 0;
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        callCount++;
        // Return high-quality code immediately
        return `function setup() { createCanvas(800, 600); background(50); }
                function draw() {
                  for(let i = 0; i < 100; i++) {
                    fill(random(255), random(255), random(255));
                    circle(random(width), random(height), random(10, 50));
                  }
                }`;
      };

      // Use a generic prompt that won't match specialized generators
      const result = await RalphLoop.run('create a simple drawing', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'deep-collab-convergence-test',
        useDeepCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxPhases: 5,
          convergenceThreshold: 0.8,
        },
        collabDomain: 'p5',
      });

      // Verify the loop completed successfully
      expect(result.iterations).toBe(1);
      expect(result.code).toBeDefined();
      expect(result.code).toContain('function setup');
      expect(result.code).toContain('function draw');

      // Verify LLM was called (should be called at least once for divergence phase)
      expect(callCount).toBeGreaterThan(0);
    });
  });

  describe('RalphLoop with CollaborativeClient', () => {
    it('uses CollaborativeClient when useCollab is true with mock LLMs', async () => {
      const mockLLMCalls: string[] = [];
      const mockLLM = async (prompt: string, _systemPrompt?: string): Promise<string> => {
        mockLLMCalls.push(prompt);
        if (prompt.includes('alternative')) {
          return 'function setup() { createCanvas(600, 600); } function draw() { rect(100, 100, 200, 200); }';
        }
        // Return longer code to pass quality threshold
        return `function setup() { createCanvas(400, 400); background(220); }
                function draw() {
                  fill(255, 0, 0);
                  circle(200, 200, 100);
                  fill(0, 255, 0);
                  rect(150, 150, 100, 100);
                }`;
      };

      const progressCalls: any[] = [];

      // Use a generic prompt that won't match specialized generators
      const result = await RalphLoop.run('create a basic shape', {
        maxIterations: 2,
        galleryDir: TEST_GALLERY_DIR,
        project: 'simple-collab-integration-test',
        useCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxRounds: 2,
        },
        collabDomain: 'p5',
        minQualityScore: 0.5, // Lower threshold to ensure iterations complete
        onProgress: (data) => progressCalls.push(data),
      });

      // Verify the loop completed both iterations
      expect(result.iterations).toBe(2);
      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThan(0);

      // Verify the mock LLM was called multiple times (collaboration rounds)
      // With 2 rounds and 2 iterations: (generation + analysis + refinement) * 2 rounds * 2 iterations
      // But we only care that it was called more than a single non-collab run would be
      expect(mockLLMCalls.length).toBeGreaterThan(2);

      // Verify progress was reported for each iteration
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      // Note: collaboration phase updates have iteration 0, loop iteration updates have the actual iteration number
      const iterationUpdates = progressCalls.filter(p => p.iteration > 0);
      expect(iterationUpdates.length).toBeGreaterThanOrEqual(2);
    });

    it('integrates with existing loop features (merge, progress, etc.)', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        // Return longer code to pass quality threshold
        return `function setup() { createCanvas(400, 400); background(200); }
                function draw() {
                  fill(random(255), random(255), random(255));
                  circle(random(width), random(height), 50);
                }`;
      };

      const mergeSteps: any[] = [];
      const progressCalls: any[] = [];

      const result = await RalphLoop.run('simple sketch', {
        maxIterations: 4,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-with-merge-test',
        useCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxRounds: 1,
        },
        collabDomain: 'p5',
        minQualityScore: 0.5, // Lower threshold to ensure iterations complete
        mergeEveryN: 2,
        onMergeStep: (data) => mergeSteps.push(data),
        onProgress: (data) => progressCalls.push(data),
      });

      // Verify the loop completed
      expect(result.iterations).toBe(4);

      // Verify merge steps were executed
      expect(mergeSteps.length).toBe(2);
      expect(mergeSteps[0]).toMatchObject({
        codeA: expect.any(String),
        codeB: expect.any(String),
        proposed: expect.any(String),
      });

      // Verify progress was reported
      // With collaboration, we get more progress updates (one per collaboration phase)
      expect(progressCalls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Collaboration with different domains', () => {
    it('works with ASCII art domain', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        return '   /\\_/\\  \n  ( o.o ) \n   > ^ <';
      };

      const result = await RalphLoop.run('cat face', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-ascii-test',
        useDeepCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxPhases: 1,
        },
        collabDomain: 'ascii',
      });

      expect(result.iterations).toBe(1);
      expect(result.code).toBeDefined();
    });

    it('works with music domain', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        return 'X:1\nT:Test\nM:4/4\nK:C\nC D E F | G A B c |]';
      };

      const result = await RalphLoop.run('simple melody', {
        maxIterations: 1,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-music-test',
        useCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxRounds: 1,
        },
        collabDomain: 'music',
      });

      expect(result.iterations).toBe(1);
      expect(result.code).toBeDefined();
    });
  });

  describe('Error handling and edge cases', () => {
    it('handles LLM errors gracefully when tolerateErrors is true', async () => {
      let callCount = 0;
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        callCount++;
        if (callCount === 1) {
          throw new Error('LLM error');
        }
        return 'function setup() { createCanvas(400, 400); }';
      };

      const result = await RalphLoop.run('test sketch', {
        maxIterations: 2,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-error-test',
        useCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxRounds: 1,
        },
        collabDomain: 'p5',
        tolerateErrors: true,
      });

      // Should complete despite error
      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });

    it('respects AbortSignal during collaboration', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        // Add a small delay to make abort test more reliable
        await new Promise(resolve => setTimeout(resolve, 10));
        // Return longer code to pass quality threshold
        return `function setup() { createCanvas(400, 400); background(200); }
                function draw() { circle(200, 200, 50); }`;
      };

      const ac = new AbortController();
      const progressCalls: number[] = [];

      const runPromise = RalphLoop.run('test sketch', {
        maxIterations: 5,
        galleryDir: TEST_GALLERY_DIR,
        project: 'collab-abort-test',
        useDeepCollab: true,
        collabConfig: {
          callLLM: mockLLM,
          maxPhases: 2,
        },
        collabDomain: 'p5',
        minQualityScore: 0.5, // Lower threshold
        signal: ac.signal,
        onProgress: (data) => {
          progressCalls.push(data.iteration);
          if (data.iteration >= 1) {
            ac.abort();
          }
        },
      });

      const result = await runPromise;
      expect(result.reason).toBe('aborted by user');
      // With collaboration, we get more progress updates due to phase callbacks
      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });
});
