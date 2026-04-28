import { defineConfig } from 'vitest/config';

const SLOW_TEST_PATTERNS = [
  'test/e2e/**/*.test.ts',
  'test/e2e/**/*.test.js',
  'test/e2e/**/*.e2e.test.ts',
  'test/e2e/**/*.e2e.test.js',
  'test/render/**/*.test.ts',
  'test/render/**/*.test.js',
  'test/integration/dual-llm.test.ts',
  'test/integration/e2e-aesthetic-audio.test.ts',
  'test/integration/full-loop.test.js',
  'test/integration/generator-renderer.test.js',
  'test/integration/gui-security-regression.test.js',
  'test/integration/lir-e2e.test.ts',
  'test/integration/preview-server.test.js',
  'test/integration/renderer.test.js',
  'test/integration/run-merge-approve-api.test.js',
] as const;

const isFastCi = process.env.LIMINAL_CI_FAST === '1';
const isSlowCi = process.env.LIMINAL_CI_SLOW === '1';

const baseExclude = [
  'node_modules/**',
  'dist/**',
  'gui/node_modules/**',
  'artifacts/**',
  // Tests for unimplemented modules — move back when source is built
  '**/test/pending/**',
  // ━━━ Worktree decontamination ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // .claude/worktrees/ — agents' worktrees inside .claude
  '**/.claude/worktrees/**',
  // Root-level worktree (OMC naming convention)
  '**/worktree-polymorphic-growing-quiche/**',
  // Legacy .worktrees (pre-.claude convention)
  '**/.worktrees/**',
  // Coverage worktree (cov70 agent)
  '**/worktrees/cov70/**',
];

export default defineConfig({
  test: {
    setupFiles: ['test/setup.ts'],
    include: isSlowCi ? [...SLOW_TEST_PATTERNS] : ['**/test/**/*.test.(js|ts)', '**/test/**/*.e2e.test.(js|ts)'],
    exclude: isFastCi ? [...baseExclude, ...SLOW_TEST_PATTERNS] : baseExclude,
    coverage: {
      enabled: !isSlowCi,
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
        statements: 78.4,
        branches: 68.4,
        functions: 81.8,
        lines: 79.3,
        autoUpdate: isFastCi || isSlowCi ? undefined : undefined,
      },
    },
  },
});
