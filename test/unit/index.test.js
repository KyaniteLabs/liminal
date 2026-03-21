import { describe, it, expect } from 'vitest';
/**
 * Tests for Liminal main entry point
 * Tests the run() and runFromArgs() functions
 */

import { run, runFromArgs } from '../../src/index.js';

describe('Liminal Main Entry Point', () => {
  describe('run()', () => {
    it('should throw error for empty prompt', async () => {
      await expect(run('')).rejects.toThrow('Prompt is required');
    });

    it('should throw error for null prompt', async () => {
      await expect(run(null)).rejects.toThrow('Prompt is required');
    });

    it('should throw when no LLM is configured', async () => {
      await expect(run('test prompt', { output: './test-output' })).rejects.toThrow(
        /No LLM configured|Liminal run failed/
      );
    });
  });

  describe('runFromArgs()', () => {
    it('should throw when no LLM is configured', async () => {
      await expect(
        runFromArgs({ prompt: 'test prompt', maxIterations: 10, output: './test-output', project: 'cli-test' })
      ).rejects.toThrow(/No LLM configured|Liminal run failed/);
    });
  });
});
