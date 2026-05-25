import React from 'react';
import type { WorkbenchMode, WorkbenchModeId } from '../gui/workbenchState';

interface WorkbenchShellProps {
  activeMode: WorkbenchModeId;
  activeTab: string;
  modes: WorkbenchMode[];
  onModeChange: (mode: WorkbenchMode) => void;
  onTabChange: (tab: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRun: () => void;
  onRunPrompt?: (prompt: string) => void;
  onCancelRun?: () => void;
  runDisabled: boolean;
  stageBusy: boolean;
  artifactReady: boolean;
  runLabel: string;
  audioSlot?: React.ReactNode;
  providerLabel: string;
  evaluatorLabel: string;
  inspectorLabel: string;
  stageSlot: React.ReactNode;
  inspectorSlot: React.ReactNode;
  timelineSlot: React.ReactNode;
  leftSlot: React.ReactNode;
  recourseSlot?: React.ReactNode;
  recourseState?: 'failed' | 'stopped';
  conversationNotice?: string | null;
  children?: React.ReactNode;
}

export function WorkbenchShell({
  activeMode,
  activeTab,
  modes,
  onModeChange,
  onTabChange,
  prompt,
  onPromptChange,
  onRun,
  onRunPrompt,
  onCancelRun,
  runDisabled,
  stageBusy,
  artifactReady,
  runLabel,
  audioSlot,
  providerLabel,
  evaluatorLabel,
  inspectorLabel,
  stageSlot,
  inspectorSlot,
  timelineSlot,
  leftSlot,
  recourseSlot,
  recourseState,
  conversationNotice,
  children,
}: WorkbenchShellProps) {
  const primaryMode = modes.find((mode) => mode.id === 'generate') ?? modes[0];
  const activeModeObject = modes.find((mode) => mode.id === activeMode) ?? primaryMode;
  const secondaryModes = modes.filter((mode) => mode.id !== primaryMode.id);
  const generateTabs = primaryMode.legacyTabs;
  const activeModeLabel = activeModeObject.label;
  const activeSurfaceLabel = formatLegacyTab(activeTab);
  const [secondaryToolsOpen, setSecondaryToolsOpen] = React.useState(activeMode !== primaryMode.id);
  const [timelineOpen, setTimelineOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const userPrompt = prompt.trim();
  const showRecovery = Boolean(recourseSlot);
  const showStopped = recourseState === 'stopped';

  React.useEffect(() => {
    if (activeMode !== primaryMode.id) {
      setSecondaryToolsOpen(true);
    }
  }, [activeMode, primaryMode.id]);

  React.useEffect(() => {
    if (stageBusy) setTimelineOpen(true);
  }, [stageBusy]);

  const statusLabel = stageBusy
    ? 'Generating'
    : showRecovery
      ? showStopped ? 'Stopped' : 'Failed'
      : artifactReady
        ? 'Preview ready'
        : 'Idle';

  const starters = [
    { label: 'Neon city at midnight', prompt: 'A neon-lit cyberpunk city at midnight with rain reflections, p5.js canvas animation' },
    { label: 'Ocean waves', prompt: 'Generative ocean waves with a dark sky, soothing blue and teal palette, p5.js animation' },
    { label: 'Particle galaxy', prompt: 'A spiral galaxy made of particles that slowly rotate, WebGL Three.js, deep purple and gold' },
    { label: 'Sound reactive', prompt: 'A minimal audio-reactive visualization using p5.js that responds to microphone input with flowing shapes' },
  ];

  const handleStarter = (starterPrompt: string) => {
    onPromptChange(starterPrompt);
    if (onRunPrompt) {
      onRunPrompt(starterPrompt);
    } else {
      onRun();
    }
  };

  const showStarters = !artifactReady && !stageBusy && !showRecovery && !userPrompt;

  return (
    <div className="liminal-canvas">
      <a className="liminal-skip-link" href="#main-content">Skip to main content</a>

      {/* Stage: full viewport — the art lives here */}
      <main id="main-content" className="liminal-canvas__stage" aria-label="Live preview canvas" aria-busy={stageBusy}>
        {stageSlot}
      </main>

      {/* Starter prompts — shown when canvas is empty */}
      {showStarters && (
        <div className="liminal-canvas__starters" aria-label="Quick start suggestions">
          {starters.map((s) => (
            <button
              key={s.label}
              type="button"
              className="liminal-canvas__starter-chip"
              onClick={() => handleStarter(s.prompt)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Top bar: minimal floating strip */}
      <header className="liminal-canvas__topbar">
        <div className="liminal-canvas__brand" title="Liminal — creative coding studio">
          <span className="liminal-canvas__brand-mark">L</span>
        </div>

        <nav className="liminal-canvas__modes" aria-label="Workbench modes">
          <button
            type="button"
            className={`liminal-canvas__mode-btn ${primaryMode.id === activeMode ? 'liminal-canvas__mode-btn--active' : ''}`}
            aria-current={primaryMode.id === activeMode ? 'page' : undefined}
            title={`Create from a text prompt (currently ${primaryMode.id === activeMode ? 'active' : 'inactive'})`}
            onClick={() => onModeChange(primaryMode)}
          >
            {primaryMode.label}
          </button>
          {generateTabs.length > 1 && (
            <details className="liminal-canvas__dropdown" title="Switch between creative tools">
              <summary>Tools</summary>
              <div className="liminal-canvas__dropdown-body">
                {generateTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`liminal-canvas__dropdown-item ${tab === activeTab ? 'liminal-canvas__dropdown-item--active' : ''}`}
                    title={`Switch to ${formatLegacyTab(tab)}`}
                    onClick={() => {
                      if (activeMode !== primaryMode.id) onModeChange(primaryMode);
                      onTabChange(tab);
                    }}
                  >
                    {formatLegacyTab(tab)}
                  </button>
                ))}
              </div>
            </details>
          )}
          {secondaryModes.length > 0 && (
            <details
              className="liminal-canvas__dropdown"
              open={secondaryToolsOpen}
              onToggle={(e) => setSecondaryToolsOpen(e.currentTarget.open)}
              title="Additional workbench modes"
            >
              <summary>More</summary>
              <div className="liminal-canvas__dropdown-body">
                {secondaryModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`liminal-canvas__dropdown-item ${mode.id === activeMode ? 'liminal-canvas__dropdown-item--active' : ''}`}
                    title={`Switch to ${mode.label} mode`}
                    onClick={() => onModeChange(mode)}
                  >
                    {mode.label}
                  </button>
                ))}
                {activeModeObject.id !== primaryMode.id && activeModeObject.legacyTabs.length > 1 && (
                  activeModeObject.legacyTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`liminal-canvas__dropdown-item ${tab === activeTab ? 'liminal-canvas__dropdown-item--active' : ''}`}
                      title={`Switch to ${formatLegacyTab(tab)}`}
                      onClick={() => onTabChange(tab)}
                    >
                      {formatLegacyTab(tab)}
                    </button>
                  ))
                )}
              </div>
            </details>
          )}
        </nav>

        {/* Status indicator */}
        <div className={`liminal-canvas__status ${stageBusy ? 'liminal-canvas__status--active' : ''} ${showRecovery ? 'liminal-canvas__status--alert' : ''}`} title={`Status: ${statusLabel}`}>
          <span className="liminal-canvas__status-dot" />
          <span>{statusLabel}</span>
        </div>

        {/* Model pill */}
        <details className="liminal-canvas__model" title="View AI model details">
          <summary>
            <span>Model</span>
            <strong>{providerLabel}</strong>
          </summary>
          <div className="liminal-canvas__model-body">
            <span><b>Agent</b>{providerLabel}</span>
            <span><b>Judge</b>{evaluatorLabel}</span>
            <span><b>Details</b>{inspectorLabel}</span>
          </div>
        </details>

        {/* Panel toggles */}
        <div className="liminal-canvas__toggles">
          <button
            type="button"
            className={`liminal-canvas__toggle ${timelineOpen ? 'liminal-canvas__toggle--active' : ''}`}
            onClick={() => setTimelineOpen(!timelineOpen)}
            aria-label="Toggle work log"
            aria-pressed={timelineOpen}
            title="Show or hide the generation work log"
          >
            Log
          </button>
          <button
            type="button"
            className={`liminal-canvas__toggle ${detailsOpen ? 'liminal-canvas__toggle--active' : ''}`}
            onClick={() => setDetailsOpen(!detailsOpen)}
            aria-label="Toggle details"
            aria-pressed={detailsOpen}
            title="Show model details and session info"
          >
            Info
          </button>
          {children && (
            <button
              type="button"
              className={`liminal-canvas__toggle ${legacyOpen ? 'liminal-canvas__toggle--active' : ''}`}
              onClick={() => setLegacyOpen(!legacyOpen)}
              aria-label="Toggle panels"
              aria-pressed={legacyOpen}
              title="Show advanced control panels"
            >
              Panels
            </button>
          )}
        </div>
      </header>

      {/* Timeline overlay panel */}
      {timelineOpen && (
        <aside className="liminal-canvas__overlay liminal-canvas__overlay--left" aria-label="Work log">
          <div className="liminal-canvas__overlay-header">
            <span>Work log</span>
            <strong>{stageBusy ? 'live' : showRecovery ? showStopped ? 'stopped' : 'needs recovery' : 'collapsed'}</strong>
            <button type="button" className="liminal-canvas__overlay-close" onClick={() => setTimelineOpen(false)} aria-label="Close panel">&times;</button>
          </div>
          <section className="liminal-timeline" role="status" aria-live="polite">
            {timelineSlot}
          </section>
        </aside>
      )}

      {/* Details overlay panel */}
      {detailsOpen && (
        <aside className="liminal-canvas__overlay liminal-canvas__overlay--right" aria-label="Details">
          <div className="liminal-canvas__overlay-header">
            <span>Details</span>
            <strong>{activeModeLabel} · {activeSurfaceLabel}</strong>
            <button type="button" className="liminal-canvas__overlay-close" onClick={() => setDetailsOpen(false)} aria-label="Close panel">&times;</button>
          </div>
          <div className="liminal-inspector">
            <div className="liminal-inspector__header">
              <span>Behind the scenes</span>
              <small>{inspectorLabel}</small>
            </div>
            {inspectorSlot}
          </div>
          <details className="liminal-rail-meta-details" open>
            <summary>Session</summary>
            {leftSlot}
          </details>
        </aside>
      )}

      {/* Legacy panels overlay */}
      {legacyOpen && children && (
        <aside className="liminal-canvas__overlay liminal-canvas__overlay--full" aria-label="Legacy panels">
          <div className="liminal-canvas__overlay-header">
            <span>{activeModeLabel}</span>
            <strong>{activeSurfaceLabel}</strong>
            <button type="button" className="liminal-canvas__overlay-close" onClick={() => setLegacyOpen(false)} aria-label="Close panel">&times;</button>
          </div>
          <section className="liminal-legacy-panel">
            {children}
          </section>
        </aside>
      )}

      {/* Recourse floating card */}
      {recourseSlot}

      {/* Bottom prompt bar */}
      <footer className="liminal-canvas__promptbar">
        <div className="liminal-canvas__promptbar-inner">
          <label htmlFor="workbench-prompt" className="sr-only">Describe what to create</label>
          <textarea
            id="workbench-prompt"
            value={prompt}
            onChange={(event) => {
              onPromptChange(event.target.value);
              const el = event.target;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 200) + 'px';
            }}
            rows={1}
            placeholder="Describe what to create... (e.g. 'a neon city with rain reflections, p5.js')"
            aria-describedby="workbench-run-status"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !runDisabled) {
                e.preventDefault();
                onRun();
              }
            }}
          />
          <div className="liminal-canvas__promptbar-actions">
            {audioSlot}
            {stageBusy && onCancelRun ? (
              <button className="liminal-stop-button" type="button" onClick={onCancelRun} aria-label="Stop generation" title="Cancel the current generation">
                Stop
              </button>
            ) : null}
            <button className="liminal-run-button" type="button" onClick={onRun} disabled={runDisabled} aria-busy={stageBusy} title={runDisabled ? 'Type a prompt first' : `Run ${runLabel} (Enter)`}>
              {runLabel}
            </button>
          </div>
        </div>
        <div className="liminal-canvas__promptbar-hint">
          {conversationNotice || (
            <>
              <kbd>Enter</kbd> to run · <kbd>Shift+Enter</kbd> for new line
            </>
          )}
        </div>
        <p id="workbench-run-status" className="sr-only" aria-live="polite">
          {stageBusy ? `${runLabel} in progress` : runDisabled ? 'Describe an artifact to enable generation' : `${runLabel} ready`}
        </p>
      </footer>
    </div>
  );
}

function formatLegacyTab(tab: string): string {
  const labels: Record<string, string> = {
    create: 'Create',
    cockpit: 'Cockpit',
    liveMusic: 'Music',
    live: 'Live',
    curator: 'Curator',
    compost: 'Compost',
    activity: 'Activity',
    config: 'Config',
  };
  return labels[tab] ?? tab;
}
