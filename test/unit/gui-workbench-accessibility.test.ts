import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const shell = fs.readFileSync('gui/src/components/WorkbenchShell.tsx', 'utf8');
const app = fs.readFileSync('gui/src/App.tsx', 'utf8');
const css = fs.readFileSync('gui/src/index.css', 'utf8');
const bridgeHook = fs.readFileSync('gui/src/gui/useTuiBridgeSession.ts', 'utf8');
const studioConversation = fs.readFileSync('gui/src/gui/studioConversation.ts', 'utf8');

describe('GUI workbench accessibility contract', () => {
  it('keeps the workbench navigable and announced for assistive technology', () => {
    expect(shell).toContain('liminal-skip-link');
    expect(shell).toContain('id="workbench-prompt"');
    expect(shell).toContain('htmlFor="workbench-prompt"');
    expect(shell).toContain('aria-describedby="workbench-run-status"');
    expect(shell).toContain('id="workbench-run-status"');
    expect(shell).toContain('aria-live="polite"');
    expect(shell).toContain('aria-busy');
    expect(shell).toContain('aria-label="Work log"');
    expect(app).toContain("stageBusy={bridgeSummary.active || runStatus === 'running'}");
    expect(app).toContain("artifactReady={activeMode.id === 'generate' && hasSingTarget}");
    expect(bridgeHook).toContain("parsed.type === 'status.updated'");
  });

  it('does not tell users to generate again once a preview is mounted', () => {
    expect(shell).toContain('artifactReady');
    expect(shell).toContain('Preview ready');
    expect(app).toContain('draftReady');
    expect(app).toContain('Adjust direction');
  });

  it('keeps the active-run stop control beside the composer instead of hiding it in details', () => {
    expect(shell).toContain('onCancelRun');
    expect(shell).toContain('aria-label="Stop generation"');
    expect(shell).toContain('liminal-stop-button');
    expect(app).toContain('onCancelRun={bridgeSummary.active ? () => void bridge.cancelCurrent() : undefined}');
  });

  it('keeps secondary modes available without making the default surface a dashboard', () => {
    expect(shell).toContain('liminal-canvas__mode-btn');
    expect(shell).toContain('liminal-canvas__dropdown');
    expect(shell).toContain('More');
    expect(shell).toContain('Tools');
  });

  it('does not force the secondary tools drawer closed on every render', () => {
    expect(shell).toContain('secondaryToolsOpen');
    expect(shell).toContain('onToggle');
    expect(shell).not.toContain('open={activeMode !== primaryMode.id}');
  });

  it('keeps closed navigation drawers from overlapping visible rail controls', () => {
    expect(css).toContain('.liminal-canvas__dropdown');
    expect(css).toContain('display: none');
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
    expect(css).toContain('.liminal-inspector-grid');
    expect(css).toContain('.liminal-review-panel');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('grid-template-columns: minmax(0, 0.7fr) auto');
  });

  it('keeps sandboxed preview iframes from delegating sensor permissions', () => {
    expect(app).toContain(`const SENSOR_PERMISSION_POLICY = "accelerometer 'none'; gyroscope 'none'; magnetometer 'none'";`);
    expect(app).toContain('allow={SENSOR_PERMISSION_POLICY}');
    expect(app).not.toContain('allow="accelerometer;');
  });

  it('shows a visible recovery state when an inline image preview fails to load', () => {
    expect(app).toContain('failedPreviewSrc');
    expect(app).toContain('liminal-stage-preview-error');
    expect(app).toContain('role="alert"');
    expect(app).toContain('Image preview failed to load');
    expect(app).not.toContain("event.currentTarget.style.display = 'none'");
  });

  it('shows visible recourse when a generation run fails before preview', () => {
    expect(shell).toContain('recourseSlot');
    expect(shell).toContain('showRecovery');
    expect(shell).toContain('needs recovery');
    expect(app).toContain('liminal-recourse-card');
    expect(app).toContain('runFailedBeforePreview');
    expect(app).toContain('No preview was produced');
    expect(app).toContain('That run did not finish.');
    expect(app).toContain('Try again');
    expect(app).toContain('Polish safely');
    expect(app).toContain('Switch medium');
    expect(app).toContain('browser visual');
    expect(css).toContain('.liminal-recourse-card');
    expect(css).toContain('overflow-wrap: anywhere');
  });

  it('passes the visible loop timeout into every Studio Generate submission', () => {
    const directSubmissions = app.match(/buildWorkbenchRunOptionsForMode\([^)]*timeoutMinutes/g)?.length ?? 0;
    const routedComposerSubmissions = app.match(/buildStudioComposerSubmission\(\{[\s\S]*?timeoutMinutes,[\s\S]*?priorRunReceipt: runReceipt,[\s\S]*?\}\);/g)?.length ?? 0;

    expect(directSubmissions + routedComposerSubmissions).toBe(7);
    expect(studioConversation).toContain('buildWorkbenchRunOptionsForMode(input.executionMode, input.maxIterations, mode, input.timeoutMinutes)');
    expect(app).not.toContain('buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, effectiveCreateMode),');
    expect(app).not.toContain("buildWorkbenchRunOptionsForMode('draft', createMaxIterations, retryMode),");
    expect(app).not.toContain('audio-sing-worklet');
  });

  it('keeps operator-stopped runs visible with retry recourse instead of resetting to ready', () => {
    expect(bridgeHook).toContain('cancelledRunEventFromStatus');
    expect(bridgeHook).toContain("type: 'generation.cancelled'");
    expect(bridgeHook).toContain("reason: 'operator-stop'");
    expect(bridgeHook).toContain("await refreshStatus()");
    expect(app).toContain('runStoppedBeforePreview');
    expect(app).toContain("runReceipt?.outcome === 'stopped'");
    expect(app).toContain('Generation stopped');
    expect(app).toContain('Generation stopped by operator.');
    expect(app).toContain("runReceipt?.outcome === 'stopped' ?");
    expect(app).toContain('Generation stopped');
  });

  it('keeps reduced-motion and visible preview-status fallbacks in CSS', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('liminal-stage-empty--blocked');
  });
});
