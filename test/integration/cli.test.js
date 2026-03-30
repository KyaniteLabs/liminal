/**
 * SECURITY NOTICE: All API keys in this file are FAKE test values.
 */

import { describe, it, expect, beforeAll, afterEach, test } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const cliPath = path.join(process.cwd(), 'bin/liminal');

describe('CLI Integration Tests', () => {
  let testOutputDir;
  const TEST_TIMEOUT = 45000;

  beforeAll(() => {
    testOutputDir = path.join(process.cwd(), 'test-cli-output');
  });

  afterEach(async () => {
    try { await fs.rm(testOutputDir, { recursive: true, force: true }); } catch {}
  });

  describe('CLI Invocation and Flags', () => {
    test('should show help', async () => {
      const result = await runCLI(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('USAGE:');
    }, 10000);

    test('should show version', async () => {
      const result = await runCLI(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Liminal');
    }, 10000);

    test('should generate with fast LM Studio model', async () => {
      const result = await runCLI([
        '--prompt', 'simple blue circle',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Liminal');
    }, TEST_TIMEOUT);

    test('--mode live-music --prompt "ambient" --output <dir> produces files in output dir', async () => {
      const result = await runCLI([
        '--mode', 'live-music',
        '--prompt', 'ambient',
        '--output', testOutputDir
      ]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/strudel|hydra|\.js|\.tidal/);
      const files = await fs.readdir(testOutputDir);
      expect(files.length).toBeGreaterThan(0);
      const hasMusic = files.some(f => /strudel\.(js|tidal)/i.test(f) || f === 'strudel.js');
      const hasVisual = files.some(f => /hydra\.js/i.test(f));
      expect(hasMusic || hasVisual).toBe(true);
    }, 45000);
  });
});

async function runCLI(args) {
  return new Promise((resolve) => {
    const cliProcess = spawn('node', [cliPath, ...args], {
      env: {
        ...process.env,
        ATELIER_LLM_PROVIDER: 'lmstudio',
        ATELIER_LLM_BASE_URL: 'http://localhost:1234/v1',
        ATELIER_LLM_MODEL: 'local-model'
      }
    });
    let stdout = '';
    let stderr = '';
    cliProcess.stdout.on('data', (d) => stdout += d);
    cliProcess.stderr.on('data', (d) => stderr += d);
    cliProcess.on('close', (code) => resolve({ exitCode: code, stdout, stderr }));
    setTimeout(() => { cliProcess.kill(); resolve({ exitCode: -1, stdout, stderr: 'timeout' }); }, 45000);
  });
}
