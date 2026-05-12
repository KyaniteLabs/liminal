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

  return (
    <div className="liminal-canvas">
      <a className="liminal-skip-link" href="#main-content">Skip to main content</a>

      {/* Stage: full viewport — the art lives here */}
      <main id="main-content" className="liminal-canvas__stage" aria-label="Live preview canvas" aria-busy={stageBusy}>
        {stageSlot}
      </main>

      {/* Top bar: minimal floating strip */}
      <header className="liminal-canvas__topbar">
        <div className="liminal-canvas__brand">
          <span className="liminal-canvas__brand-mark">L</span>
        </div>

        <nav className="liminal-canvas__modes" aria-label="Workbench modes">
          <button
            type="button"
            className={`liminal-canvas__mode-btn ${primaryMode.id === activeMode ? 'liminal-canvas__mode-btn--active' : ''}`}
            aria-current={primaryMode.id === activeMode ? 'page' : undefined}
            onClick={() => onModeChange(primaryMode)}
          >
            {primaryMode.label}
          </button>
          {generateTabs.length > 1 && (
            <details className="liminal-canvas__dropdown">
              <summary>Tools</summary>
              <div className="liminal-canvas__dropdown-body">
                {generateTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`liminal-canvas__dropdown-item ${tab === activeTab ? 'liminal-canvas__dropdown-item--active' : ''}`}
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
            >
              <summary>More</summary>
              <div className="liminal-canvas__dropdown-body">
                {secondaryModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`liminal-canvas__dropdown-item ${mode.id === activeMode ? 'liminal-canvas__dropdown-item--active' : ''}`}
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
        <div className={`liminal-canvas__status ${stageBusy ? 'liminal-canvas__status--active' : ''} ${showRecovery ? 'liminal-canvas__status--alert' : ''}`}>
          <span className="liminal-canvas__status-dot" />
          <span>{statusLabel}</span>
        </div>

        {/* Model pill */}
        <details className="liminal-canvas__model">
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
          >
            Log
          </button>
          <button
            type="button"
            className={`liminal-canvas__toggle ${detailsOpen ? 'liminal-canvas__toggle--active' : ''}`}
            onClick={() => setDetailsOpen(!detailsOpen)}
            aria-label="Toggle details"
            aria-pressed={detailsOpen}
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
          <textarea
            id="workbench-prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={1}
            placeholder="Describe what to create..."
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
              <button className="liminal-stop-button" type="button" onClick={onCancelRun} aria-label="Stop generation">
                Stop
              </button>
            ) : null}
            <button className="liminal-run-button" type="button" onClick={onRun} disabled={runDisabled} aria-busy={stageBusy}>
              {runLabel}
            </button>
          </div>
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
