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

  describe('Collaboration with different domains', () => {
    it('works with ASCII art domain', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        return [
          '        /\\_/\\        ',
          '       ( o.o )       ',
          '        > ^ <        ',
          '   cat face study    ',
          '  whiskers in moon   ',
        ].join('\n');
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
        evalMode: 'legacy',
      });

      expect(result.iterations).toBe(1);
      expect(result.code).not.toBeNull();
    });

    it('works with music domain', async () => {
      const mockLLM = async (_prompt: string, _systemPrompt?: string): Promise<string> => {
        return '$: s("bd*2 [~ cp] hh*4").slow(2).gain(0.8)\n$: note("c4 e4 g4 b4").s("sine").slow(4)\n$: n("0 2 4 7").scale("C:minor").s("sawtooth").gain(0.45)';
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
        evalMode: 'legacy',
      });

      expect(result.iterations).toBe(1);
      expect(result.code).not.toBeNull();
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
        return 'function setup() { createCanvas(400, 400); background(20); }\nfunction draw() { background(20, 10); fill(255); circle(width / 2, height / 2, 80); }';
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
        evalMode: 'legacy',
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
                function draw() { background(200, 10); fill(80, 120, 220); circle(200, 200, 50 + sin(frameCount * 0.05) * 10); }`;
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
        evalMode: 'legacy',
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
