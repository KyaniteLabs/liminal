import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('GUI bundle performance budget', () => {
  it('code-splits heavy Studio panels and enforces a post-build bundle budget', () => {
    const app = read('gui/src/App.tsx');
    const vite = read('gui/vite.config.js');
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(app).toContain('React.lazy');
    expect(app).toContain("import('./components/CompostVisualizer')");
    expect(app).toContain("import('./components/OperatorCockpit')");
    expect(app).toContain('<Suspense');
    expect(vite).toContain('manualChunks');
    expect(vite).toContain('chunkSizeWarningLimit: 500');
    expect(pkg.scripts['proof:gui-bundle-budget']).toBe('tsx scripts/proof/gui-bundle-budget.ts');
  });
});
