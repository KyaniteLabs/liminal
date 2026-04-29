import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const shell = fs.readFileSync('gui/src/components/WorkbenchShell.tsx', 'utf8');
const app = fs.readFileSync('gui/src/App.tsx', 'utf8');
const css = fs.readFileSync('gui/src/index.css', 'utf8');
const bridgeHook = fs.readFileSync('gui/src/gui/useTuiBridgeSession.ts', 'utf8');

describe('GUI workbench accessibility contract', () => {
  it('keeps the workbench navigable and announced for assistive technology', () => {
    expect(shell).toContain('liminal-skip-link');
    expect(shell).toContain('id="workbench-prompt"');
    expect(shell).toContain('htmlFor="workbench-prompt"');
    expect(shell).toContain('aria-describedby="workbench-run-status"');
    expect(shell).toContain('id="workbench-run-status"');
    expect(shell).toContain('aria-live="polite"');
    expect(shell).toContain('aria-busy');
    expect(shell).toContain('aria-label="Generation timeline"');
    expect(app).toContain("stageBusy={bridgeSummary.active || runStatus === 'running'}");
    expect(bridgeHook).toContain("parsed.type === 'status.updated'");
  });

  it('keeps reduced-motion and visible preview-status fallbacks in CSS', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('liminal-stage-empty--blocked');
  });
});
