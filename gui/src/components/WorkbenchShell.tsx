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
  runDisabled: boolean;
  runLabel: string;
  audioSlot?: React.ReactNode;
  providerLabel: string;
  evaluatorLabel: string;
  inspectorLabel: string;
  stageSlot: React.ReactNode;
  inspectorSlot: React.ReactNode;
  timelineSlot: React.ReactNode;
  leftSlot: React.ReactNode;
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
  runDisabled,
  runLabel,
  audioSlot,
  providerLabel,
  evaluatorLabel,
  inspectorLabel,
  stageSlot,
  inspectorSlot,
  timelineSlot,
  leftSlot,
  children,
}: WorkbenchShellProps) {
  const runStatusText = runDisabled ? `${runLabel} in progress` : `${runLabel} ready`;

  return (
    <div className="liminal-workbench">
      <a className="liminal-skip-link" href="#main-content">Skip to main content</a>
      <header className="liminal-commandbar">
        <div className="liminal-brand">
          <span className="liminal-brand__mark">L</span>
          <div>
            <h1>Liminal Studio</h1>
            <p>{providerLabel}</p>
          </div>
        </div>
        <label className="liminal-command">
          <span>Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={2}
            placeholder="Describe the visual, instrument, behavior, or system to generate"
          />
        </label>
        <div className="liminal-command-actions">
          {audioSlot}
          <button className="liminal-run-button" type="button" onClick={onRun} disabled={runDisabled} aria-busy={runDisabled}>
            {runLabel}
          </button>
          <p className="sr-only" aria-live="polite">{runStatusText}</p>
        </div>
      </header>

      <aside className="liminal-left-rail">
        <nav aria-label="Workbench modes">
          {modes.map((mode) => (
            <div key={mode.id} className="liminal-rail-group">
              <button
                type="button"
                className={mode.id === activeMode ? 'liminal-rail-button liminal-rail-button--active' : 'liminal-rail-button'}
                aria-current={mode.id === activeMode ? 'page' : undefined}
                onClick={() => onModeChange(mode)}
              >
                {mode.label}
              </button>
              {mode.id === activeMode && mode.legacyTabs.length > 1 && (
                <div className="liminal-subnav">
                  {mode.legacyTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={tab === activeTab ? 'liminal-subnav-button liminal-subnav-button--active' : 'liminal-subnav-button'}
                      aria-current={tab === activeTab ? 'page' : undefined}
                      onClick={() => onTabChange(tab)}
                    >
                      {formatLegacyTab(tab)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="liminal-left-rail__content">{leftSlot}</div>
      </aside>

      <main id="main-content" className="liminal-stage" aria-label="Live stage">
        {stageSlot}
      </main>

      <aside className="liminal-inspector">
        <div className="liminal-inspector__header">
          <span>Inspector</span>
          <small>{inspectorLabel}</small>
        </div>
        {inspectorSlot}
      </aside>

      <section className="liminal-timeline" aria-label="Generation timeline">
        {timelineSlot}
      </section>

      {children ? (
        <section className="liminal-legacy-panel" aria-label="Supplemental panel">
          {children}
        </section>
      ) : null}
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
