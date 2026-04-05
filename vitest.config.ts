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
      reporters: ['text', 'json-summary'],
      thresholds: {
        // Coverage ratchet: these values auto-increase when coverage improves.
        // Coverage can only go UP, never DOWN. Any decrease fails CI.
        // DO NOT manually lower these values — let the ratchet handle them.
        statements: 55.59,
        branches: 47.99,
        functions: 55.8,
        lines: 56.36,
        autoUpdate: true,
      },
    },
  },
});
