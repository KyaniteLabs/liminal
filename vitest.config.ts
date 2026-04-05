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
        // TARGET: 75% across all metrics (see CLAUDE.md)
        //
        // Current → Target gaps:
        //   Statements: 61.5% → 75% (gap: -13.5pp)
        //   Branches:   51.9% → 75% (gap: -23.1pp)
        //   Functions:  62.2% → 75% (gap: -12.8pp)
        //   Lines:      62.4% → 75% (gap: -12.6pp)
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
        statements: 65,
        branches: 55.8,
        functions: 65.4,
        lines: 65.8,
        autoUpdate: (n: number) => Math.floor(n * 10) / 10,
      },
    },
  },
});
