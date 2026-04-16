import { describe, it, expect } from 'vitest';
/**
 * Asserts that the project lint script runs successfully.
 * Use in CI to ensure lint is executed and passes.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

describe('Lint', () => {
  it('runs without errors on src/', { timeout: 120_000 }, () => {
    execSync('npm run lint', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  });
});
