import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('canonical user-surface launch contract', () => {
  it('keeps exactly one blessed GUI command and one blessed operator TUI command', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts.gui).toBe('node scripts/utils/start-studio.js');
    expect(pkg.scripts.studio).toBe('npm run gui');
    expect(pkg.scripts.tui).toBe('npm run build && node scripts/start-bubbletea-tui.mjs');
    expect(pkg.scripts['tui:ink']).toBe('node scripts/compat/ink-tui-compat.mjs');
    expect(pkg.scripts['gui:all']).toBeUndefined();
    expect(pkg.scripts['tui:bubbletea']).toBeUndefined();
  });

  it('routes CLI studio/tui surfaces to Studio and Bubble Tea, not legacy Ink', () => {
    const cli = read('bin/liminal');

    expect(cli).toContain('tui                         Launch Bubble Tea operator cockpit');
    expect(cli).toContain("spawn(npmCmd, ['run', 'gui']");
    expect(cli).not.toContain("spawn(npmCmd, ['run', 'gui:all']");
    expect(cli).not.toContain("cmd === 'tui') {  // Launch the Natural Language TUI");
    expect(cli).not.toContain("import('../dist/tui/HarnessTUI.js')");
  });

  it('documents Studio as the GUI cockpit and Bubble Tea as the operator cockpit', () => {
    const readme = read('README.md');
    const contract = read('docs/USER_SURFACE_CONTRACT.md');

    expect(readme).toContain('pnpm gui');
    expect(readme).toContain('pnpm tui');
    expect(readme).not.toContain('Ink-based terminal UI');
    expect(contract).toContain('Canonical launch commands');
    expect(contract).toContain('Studio GUI: `pnpm gui`');
    expect(contract).toContain('Operator TUI: `pnpm tui`');
    expect(contract).toContain('Legacy Ink TUI is compatibility-only');
  });
});
