/**
 * SECURITY NOTICE: All API keys in this file are FAKE test values.
 */

import { describe, it, expect, beforeAll, afterEach, test } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const cliPath = path.join(process.cwd(), 'bin/liminal');

// Check if LM Studio is available and responsive enough for E2E tests
async function isLLMAvailable() {
  // In test environments, skip LLM-dependent CLI tests unless explicitly enabled,
  // because local LLM endpoints are often too slow for reliable E2E testing.
  if (process.env.NODE_ENV === 'test' && !process.env.RUN_SLOW_LLM_TESTS) {
    return false;
  }
  try {
    const res = await fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

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
      // Skip if no LLM available
      if (!await isLLMAvailable()) {
        console.log('[SKIP] No LLM available at localhost:1234');
        return;
      }
      const result = await runCLI([
        '--prompt', 'simple blue circle',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);
      // Debug output
      if (result.exitCode !== 0) {
        console.log('[DEBUG] stdout:', result.stdout);
        console.log('[DEBUG] stderr:', result.stderr);
      }
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Liminal');
    }, TEST_TIMEOUT);

    test('--mode live-music --prompt "ambient" --output <dir> produces files in output dir', async () => {
      // Skip if no LLM available
      if (!await isLLMAvailable()) {
        console.log('[SKIP] No LLM available at localhost:1234');
        return;
      }
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
        // Provider is no longer used - baseUrl + model is all that's needed
        LIMINAL_LLM_BASE_URL: 'http://localhost:1234/v1',
        LIMINAL_LLM_MODEL: 'qwen3.5-9b'  // Use actual model name from LM Studio
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
