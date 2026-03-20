/**
 * Tests for Atelier main entry point
 * Tests the run() and runFromArgs() functions
 */

import { run, runFromArgs } from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';

describe('Atelier Main Entry Point', () => {
  describe('run()', () => {
    it('should generate basic p5.js sketch from prompt', async () => {
      const result = await run('test prompt', {
        output: './test-output'
      });

      expect(result).toBeDefined();
      expect(result.code).toContain('function setup()');
      expect(result.code).toContain('function draw()');
      // With RalphLoop, completed is true only if promise is detected or max iterations reached
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.reason).toBeDefined();
    });

    it('should create output files', async () => {
      const result = await run('test prompt', {
        output: './test-output',
        project: 'test-project'
      });

      expect(result.htmlPath).toBeDefined();
      expect(result.jsPath).toBeDefined();
      expect(result.zipPath).toBeDefined();

      // Check files exist
      const htmlExists = await fs.access(result.htmlPath).then(() => true).catch(() => false);
      const jsExists = await fs.access(result.jsPath).then(() => true).catch(() => false);

      expect(htmlExists).toBe(true);
      expect(jsExists).toBe(true);
    });

    it('should throw error for empty prompt', async () => {
      await expect(run('')).rejects.toThrow('Prompt is required');
    });

    it('should throw error for null prompt', async () => {
      await expect(run(null)).rejects.toThrow('Prompt is required');
    });
  });

  describe('runFromArgs()', () => {
    it('should run with CLI-style arguments', async () => {
      const result = await runFromArgs({
        prompt: 'test prompt',
        maxIterations: 10,
        output: './test-output',
        project: 'cli-test'
      });

      expect(result).toBeDefined();
      expect(result.project).toBe('cli-test');
    });

    it('should use default values for missing options', async () => {
      const result = await runFromArgs({
        prompt: 'test prompt'
      });

      expect(result).toBeDefined();
      expect(result.outputDir).toBe(path.resolve(process.cwd(), 'output'));
    });
  });
});
