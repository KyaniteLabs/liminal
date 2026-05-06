import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOperatorPromptRequest } from '../../gui/src/components/OperatorCockpit';

const read = (path: string) => readFileSync(path, 'utf8');

describe('user-facing TUI/GUI surface contract', () => {
  it('documents the shared chat-first user-surface contract', () => {
    const doc = read('docs/USER_SURFACE_CONTRACT.md');

    expect(doc).toContain('Chat First, Preview First');
    for (const surface of ['Studio GUI', 'Operator TUI']) {
      expect(doc).toContain(surface);
    }
    for (const state of ['Brief', 'Medium', 'Generate', 'Preview', 'Revise / Variation / Polish', 'Details']) {
      expect(doc).toContain(state);
    }
    for (const rule of [
      'Cancel stops active generation',
      'Confirm mutates only after review',
      'GUI and TUI consume the same bridge events',
      'Prompt beats stale selectors',
      'A pop-up alone is not enough',
    ]) {
      expect(doc).toContain(rule);
    }
  });

  it('keeps stale GUI/TUI copy and unreachable legacy create UI out of source', () => {
    const app = read('gui/src/App.tsx');
    const bubbleReadme = read('bubbletea/README.md');

    expect(app).not.toContain('node scripts/start-gui.js');
    expect(app).not.toContain('Run the Ralph loop: same prompt every iteration');
    expect(app).not.toContain('visuals run live below');
    expect(app).toContain('pnpm gui');
    expect(app).toContain('Hydra remains read-only here');
    expect(app).not.toContain('visuals are shown as sandbox-pending code');
    expect(bubbleReadme).not.toContain('Bubble Tea MVP Shell');
    expect(bubbleReadme).toContain('Bubble Tea Operator Cockpit');
  });

  it('marks the standalone cockpit prompt path as explicit creative workbench input', () => {
    expect(buildOperatorPromptRequest('paint the moon')).toEqual({
      text: 'paint the moon',
      mode: 'chat',
      clientIntent: 'creative',
      executionMode: 'draft',
    });
  });

  it('adds accessible navigation, current state, live status, and reduced-motion affordances to the workbench shell', () => {
    const shell = read('gui/src/components/WorkbenchShell.tsx');
    const css = read('gui/src/index.css');

    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain('aria-current');
    expect(shell).toContain('aria-live="polite"');
    expect(shell).toContain('aria-busy');
    expect(css).toContain('.liminal-skip-link');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
