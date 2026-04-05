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
        // TARGET: 70% across all metrics (see CLAUDE.md)
        //
        // Current → Target gaps:
        //   Statements: 67.4% → 70% (gap: -2.6pp)
        //   Branches:   57.3% → 70% (gap: -12.7pp)
        //   Functions:  68.2% → 70% (gap: -1.8pp)
        //   Lines:      68.2% → 70% (gap: -1.8pp)
        //
        // These values auto-increase when coverage improves.
        // Coverage can only go UP, never DOWN. Any decrease fails CI.
        //
        // autoUpdate rounds DOWN to 0.1% to prevent false failures
        // from 0.01% run-to-run fluctuations.
        //
        // Per-file enforcement: scripts/ci/check-coverage-gaps.ts
        // Quality enforcement: scripts/testing/test-quality-check.mjs
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        statements: 69.1,
        branches: 59.1,
        functions: 70.1,
        lines: 70,
        autoUpdate: (n: number) => Math.floor(n * 10) / 10,
      },
    },
  },
});
