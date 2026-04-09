import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: ['**/test/**/*.test.(js|ts)', '**/test/**/*.e2e.test.(js|ts)'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'gui/node_modules/**',
      'artifacts/**',
      // ━━━ Worktree decontamination ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // .claude/worktrees/ — agents' worktrees inside .claude
      '**/.claude/worktrees/**',
      // Root-level worktree (OMC naming convention)
      '**/worktree-polymorphic-growing-quiche/**',
      // Legacy .worktrees (pre-.claude convention)
      '**/.worktrees/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
      reportsDirectory: './coverage',
      reporters: ['text', 'json', 'json-summary'],
      thresholds: {
        // ━━━ Global coverage ratchet ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TARGET: 70% across all metrics (user-requested)
        //
        // Current → Target gaps:
        //   Statements: 68.6% → 70% (gap: -1.4pp)
        //   Branches:   58.9% → 70% (gap: -11.1pp)
        //   Functions:  69.7% → 70% (gap: -0.3pp)
        //   Lines:      69.5% → 70% (gap: -0.5pp)
        //
        // Ratchet is set to current CI-measured values (floor).
        // Coverage can only go UP, never DOWN. Any decrease fails CI.
        // autoUpdate will raise these as coverage improves toward 70%.
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
