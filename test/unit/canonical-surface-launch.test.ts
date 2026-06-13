import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('canonical user-surface launch contract', () => {
  it('keeps the blessed GUI command and removes every retired TUI launch script', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts.build).toBe('tsc --incremental false');
    expect(pkg.scripts.gui).toBe('pnpm build && node scripts/utils/start-studio.js');
    expect(pkg.scripts.studio).toBe('npm run gui');
    // The Go Bubble Tea cockpit and the legacy Ink fallback were removed (ADR 0005).
    expect(pkg.scripts.tui).toBeUndefined();
    expect(pkg.scripts['tui:ink']).toBeUndefined();
    expect(pkg.scripts['tui:bridge']).toBeUndefined();
    expect(pkg.scripts['tui:bubbletea']).toBeUndefined();
    expect(pkg.scripts['bubbletea:test']).toBeUndefined();
    expect(pkg.scripts['gui:all']).toBeUndefined();
  });

  it('routes the CLI to Studio and keeps the bridge, with no Go/Ink TUI launch path', () => {
    const cli = read('bin/sinter');

    expect(cli).toContain("spawn(npmCmd, ['run', 'gui']");
    // The bridge server (backs the GUI + launch-proof gates) stays.
    expect(cli).toContain("cmd === 'bridge'");
    // No retired cockpit launch commands remain.
    expect(cli).not.toContain("cmd === 'tui'");
    expect(cli).not.toContain("cmd === 'bubbletea'");
    expect(cli).not.toContain("dist/tui/InteractiveMode.js");
  });

  it('documents Studio as the single invested user surface, not a terminal cockpit', () => {
    const readme = read('README.md');
    const contract = read('docs/USER_SURFACE_CONTRACT.md');

    expect(readme).toContain('pnpm gui');
    expect(readme).not.toContain('pnpm tui');
    expect(readme).not.toContain('Ink-based terminal UI');
    expect(contract).toContain('Canonical launch commands');
    expect(contract).toContain('Studio GUI: `pnpm gui`');
    expect(contract).not.toContain('Operator TUI: `pnpm tui`');
  });
});
