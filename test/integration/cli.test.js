/**
 * CLI Integration Tests for Atelier
 *
 * End-to-end tests that verify the command-line interface:
 * - CLI accepts --prompt, --max-iterations, --output flags
 * - CLI generates output files
 * - CLI exits 0 on success
 * - CLI exits with error on missing required flags
 * - Help and version flags work
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const cliPath = path.join(process.cwd(), 'bin/atelier');

describe('CLI Integration Tests', () => {
  let testOutputDir;

  beforeAll(() => {
    testOutputDir = path.join(process.cwd(), 'test-cli-output');
  });

  afterEach(async () => {
    // Clean up test output directory
    try {
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('CLI Invocation and Flags', () => {
    test('should show help when --help flag is provided', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('USAGE:');
      expect(result.stdout).toContain('--prompt');
      expect(result.stdout).toContain('--max-iterations');
      expect(result.stdout).toContain('--output');
      expect(result.stdout).toContain('--help');
    });

    test('should show version when --version flag is provided', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Atelier v1.0.0');
    });

    test('should accept --prompt flag', async () => {
      const result = await runCLI([
        '--prompt', 'Create a simple particle system',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🎨 Atelier: Creative Coding Agent');
      expect(result.stdout).toContain('📝 Prompt: "Create a simple particle system"');
    });

    test('should accept -p as shorthand for --prompt', async () => {
      const result = await runCLI([
        '-p', 'Test prompt',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('📝 Prompt: "Test prompt"');
    });

    test('should accept --max-iterations flag', async () => {
      const result = await runCLI([
        '--prompt', 'Test',
        '--max-iterations', '5',
        '--output', testOutputDir
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🔄 Max iterations: 5');
    });

    test('should accept -m as shorthand for --max-iterations', async () => {
      const result = await runCLI([
        '--prompt', 'Test',
        '-m', '3',
        '--output', testOutputDir
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🔄 Max iterations: 3');
    });

    test('should accept --output flag', async () => {
      const customOutput = path.join(testOutputDir, 'custom');
      const result = await runCLI([
        '--prompt', 'Test',
        '--output', customOutput,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`📁 Output: ${customOutput}`);
    });

    test('should accept -o as shorthand for --output', async () => {
      const customOutput = path.join(testOutputDir, 'custom2');
      const result = await runCLI([
        '--prompt', 'Test',
        '-o', customOutput,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`📁 Output: ${customOutput}`);
    });
  });

  describe('CLI Output Generation', () => {
    test('should generate output files and exit 0 on success', async () => {
      const result = await runCLI([
        '--prompt', 'Create a simple particle system with blue particles',
        '--output', testOutputDir,
        '--max-iterations', '2'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✅ Generation complete!');
      expect(result.stdout).toContain('📊 Iterations:');
      expect(result.stdout).toContain('⏱️');
      expect(result.stdout).toContain('🎯 Reason:');
      expect(result.stdout).toContain('⭐ Quality score:');

      // Verify output files exist
      const outputFiles = await fs.readdir(testOutputDir);
      expect(outputFiles.length).toBeGreaterThan(0);

      // Check for expected output files (HTML, JS, archive)
      const htmlFile = outputFiles.find(f => f.includes('.html'));
      const jsFile = outputFiles.find(f => f.includes('.js') && !f.includes('.html'));
      const archiveFile = outputFiles.find(f => f.includes('.zip'));

      expect(htmlFile).toBeDefined();
      expect(jsFile).toBeDefined();
      expect(archiveFile).toBeDefined();
    });

    test('should create output directory if it does not exist', async () => {
      const nonExistentDir = path.join(testOutputDir, 'does-not-exist', 'nested');

      const result = await runCLI([
        '--prompt', 'Test',
        '--output', nonExistentDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);

      // Verify directory was created
      const dirExists = await directoryExists(nonExistentDir);
      expect(dirExists).toBe(true);
    });

    test('should generate valid HTML file', async () => {
      await runCLI([
        '--prompt', 'Create a particle system',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      const files = await fs.readdir(testOutputDir);
      const htmlFile = files.find(f => f.includes('.html'));

      expect(htmlFile).toBeDefined();

      const htmlPath = path.join(testOutputDir, htmlFile);
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');

      // Verify HTML contains expected elements
      expect(htmlContent).toContain('<!DOCTYPE html>');
      expect(htmlContent).toContain('<html lang=');
      expect(htmlContent).toContain('<script');
      expect(htmlContent).toContain('p5');
    });

    test('should generate valid JavaScript file', async () => {
      await runCLI([
        '--prompt', 'Create a particle system',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      const files = await fs.readdir(testOutputDir);
      const jsFile = files.find(f => f.includes('.js') && !f.includes('.html'));

      expect(jsFile).toBeDefined();

      const jsPath = path.join(testOutputDir, jsFile);
      const jsContent = await fs.readFile(jsPath, 'utf-8');

      // Verify JS contains p5.js code
      expect(jsContent).toContain('function setup');
      expect(jsContent).toContain('function draw');
    });
  });

  describe('CLI Error Handling', () => {
    test('should exit with error and show help when --prompt is missing', async () => {
      const result = await runCLI([
        '--output', testOutputDir
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error: --prompt is required');
    });

    test('should handle invalid max-iterations value gracefully', async () => {
      const result = await runCLI([
        '--prompt', 'Test',
        '--max-iterations', 'invalid',
        '--output', testOutputDir
      ]);

      // Should use default value and continue
      expect(result.exitCode).toBe(0);
    });

    test('should handle file system errors gracefully', async () => {
      // Try to write to a read-only location (simulate error)
      const readOnlyPath = '/root/atelier-test-output';

      const result = await runCLI([
        '--prompt', 'Test',
        '--output', readOnlyPath,
        '--max-iterations', '1'
      ]);

      // Should exit with error
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error:');
    });
  });

  describe('CLI Exit Codes', () => {
    test('should exit 0 on successful generation', async () => {
      const result = await runCLI([
        '--prompt', 'Create a simple sketch',
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
    });

    test('should exit 0 when help is requested', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
    });

    test('should exit 0 when version is requested', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
    });

    test('should exit 1 when required arguments are missing', async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('CLI Real-world Scenarios', () => {
    test('should handle complex prompts with special characters', async () => {
      const complexPrompt = 'Create something that feels like "Kid A" — glitchy, anxious, minimal!';

      const result = await runCLI([
        '--prompt', complexPrompt,
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('📝 Prompt:');
    });

    test('should handle very long prompts', async () => {
      const longPrompt = 'Create a particle system. ' +
        'Requirements: 100+ particles, respond to mouse, smooth 60fps animation, ' +
        'blue color palette, decay over time, attraction forces, gravity effect. ' +
        'Output: <promise>COMPLETE</promise> only when all requirements met.';

      const result = await runCLI([
        '--prompt', longPrompt,
        '--output', testOutputDir,
        '--max-iterations', '1'
      ]);

      expect(result.exitCode).toBe(0);
    });

    test('should handle simultaneous flags in different orders', async () => {
      // Test different flag orders
      const orders = [
        ['--prompt', 'Test', '--output', testOutputDir, '--max-iterations', '1'],
        ['--output', testOutputDir, '--prompt', 'Test', '--max-iterations', '1'],
        ['--max-iterations', '1', '--prompt', 'Test', '--output', testOutputDir]
      ];

      for (const args of orders) {
        const result = await runCLI(args);
        expect(result.exitCode).toBe(0);
      }
    });
  });
});

/**
 * Helper function to run CLI and capture output
 */
async function runCLI(args) {
  return new Promise((resolve) => {
    const cliProcess = spawn('node', [cliPath, ...args]);
    let stdout = '';
    let stderr = '';

    cliProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    cliProcess.on('close', (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr
      });
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      cliProcess.kill();
      resolve({
        exitCode: -1,
        stdout,
        stderr: 'Test timeout'
      });
    }, 30000); // 30 second timeout
  });
}

/**
 * Helper function to check if directory exists
 */
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}