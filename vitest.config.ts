import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['**/test/**/*.test.(js|ts)', '**/test/**/*.e2e.test.(js|ts)'],
    exclude: ['node_modules/**', '.claude/**', '.worktrees/**', 'artifacts/**', 'dist/**', 'gui/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
      reportsDirectory: './coverage',
      reporters: ['text', 'json', 'json-summary'],
      thresholds: {
        // ━━━ Global coverage ratchet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // These values auto-increase when coverage improves.
        // Coverage can only go UP, never DOWN. Any decrease fails CI.
        //
        // autoUpdate rounds DOWN to 0.1% to prevent false failures
        // from 0.01% run-to-run fluctuations.
        //
        // Per-file enforcement is handled by scripts/ci/check-coverage-gaps.ts
        // which runs in CI alongside this ratchet.
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        statements: 60.2,
        branches: 50.8,
        functions: 60.7,
        lines: 61.0,
        autoUpdate: (n: number) => Math.floor(n * 10) / 10,
      },
    },
  },
});
