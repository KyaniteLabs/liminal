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
    expect(app).toContain("artifactReady={activeMode.id === 'generate' && hasSyncTarget}");
    expect(bridgeHook).toContain("parsed.type === 'status.updated'");
  });

  it('does not tell users to generate again once a preview is mounted', () => {
    expect(shell).toContain('artifactReady');
    expect(shell).toContain("showGeneratePreviewReady");
    expect(shell).toContain('Preview is ready');
    expect(shell).toContain('Use the message box to revise, make a variation, or polish this direction.');
  });


  it('keeps secondary modes available without making the default surface a dashboard', () => {
    expect(shell).toContain('liminal-primary-mode');
    expect(shell).toContain('liminal-secondary-tools');
    expect(shell).toContain('More tools');
    expect(shell).toContain('More Generate tools');
  });

  it('does not force the secondary tools drawer closed on every render', () => {
    expect(shell).toContain('secondaryToolsOpen');
    expect(shell).toContain('onToggle');
    expect(shell).not.toContain('open={activeMode !== primaryMode.id}');
  });

  it('keeps internal process receipts out of the default preview panel', () => {
    expect(app).not.toContain('liminal-stage-process');
    expect(app).not.toContain('liminal-human-review-strip');
    expect(app).toContain('Manual Review Pack');
  });

  it('does not surface stale EventSource disconnects from replaced sessions', () => {
    expect(bridgeHook).toContain('disconnectCurrentSource');
    expect(bridgeHook).toContain('sourceRef.current !== es');
    expect(bridgeHook).toContain('es.readyState !== EventSource.CLOSED');
    expect(bridgeHook).toContain('!opened');
  });

  it('wraps long inspector receipts and review details inside the right rail', () => {
    expect(css).toContain('.liminal-inspector-grid small,');
    expect(css).toContain('.liminal-review-panel small');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('grid-template-columns: minmax(0, 0.7fr) auto');
  });

  it('keeps sandboxed preview iframes from delegating sensor permissions', () => {
    expect(app).toContain(`const SENSOR_PERMISSION_POLICY = "accelerometer 'none'; gyroscope 'none'; magnetometer 'none'";`);
    expect(app).toContain('allow={SENSOR_PERMISSION_POLICY}');
    expect(app).not.toContain('allow="accelerometer;');
  });

  it('keeps reduced-motion and visible preview-status fallbacks in CSS', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('liminal-stage-empty--blocked');
  });
});
