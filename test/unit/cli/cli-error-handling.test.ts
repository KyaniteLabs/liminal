import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const binPath = path.join(repoRoot, 'bin', 'sinter');

describe('sinter CLI error handling', () => {
  it('handles database/filesystem failures in preferences command gracefully without stack trace', async () => {
    // Create a temp file to act as a blocked project root directory
    const tempFile = path.join(repoRoot, 'test-sinter-blocked-root');
    await fs.writeFile(tempFile, 'dummy content');

    try {
      await execFileAsync(process.execPath, [binPath, 'preferences', 'stats'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          SINTER_PROJECT_ROOT: tempFile,
        },
      });
      // Should have failed
      expect.fail('Expected command to fail');
    } catch (err: any) {
      // It should have failed with exit code 1
      expect(err.code).toBe(1);
      // It should print a clean Error: message without a raw stack trace
      expect(err.stderr).toContain('Error:');
      expect(err.stderr).not.toContain('at Module._resolveFilename');
      expect(err.stderr).not.toContain('at Object.<anonymous>');
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  });

  it('handles uncaught exceptions/rejections gracefully at the process level', async () => {
    try {
      await execFileAsync(process.execPath, [binPath, 'self-improve', 'gauntlet'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          // Force import failure by passing a non-existent path as root or other mock settings
          // (runSelfImprovementGauntlet dynamically imports and will fail if files/modules are not resolved)
          SINTER_PROJECT_ROOT: '/non-existent-path-to-force-failure',
        },
      });
    } catch (err: any) {
      expect(err.code).toBe(1);
      expect(err.stderr).toContain('Error:');
      expect(err.stderr).not.toContain('at Module._resolveFilename');
    }
  });
});
