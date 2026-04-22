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
  providerLabel: string;
  evaluatorLabel: string;
  stageSlot: React.ReactNode;
  inspectorSlot: React.ReactNode;
  timelineSlot: React.ReactNode;
  leftSlot: React.ReactNode;
  children: React.ReactNode;
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
  providerLabel,
  evaluatorLabel,
  stageSlot,
  inspectorSlot,
  timelineSlot,
  leftSlot,
  children,
}: WorkbenchShellProps) {
  return (
    <div className="liminal-workbench">
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
        <button className="liminal-run-button" type="button" onClick={onRun} disabled={runDisabled}>
          {runLabel}
        </button>
      </header>

      <aside className="liminal-left-rail">
        <nav aria-label="Workbench modes">
          {modes.map((mode) => (
            <div key={mode.id} className="liminal-rail-group">
              <button
                type="button"
                className={mode.id === activeMode ? 'liminal-rail-button liminal-rail-button--active' : 'liminal-rail-button'}
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

      <section className="liminal-stage" aria-label="Live stage">
        {stageSlot}
      </section>

      <aside className="liminal-inspector">
        <div className="liminal-inspector__header">
          <span>Inspector</span>
          <small>{evaluatorLabel}</small>
        </div>
        {inspectorSlot}
      </aside>

      <section className="liminal-timeline" aria-label="Generation timeline">
        {timelineSlot}
      </section>

      <main id="main-content" className="liminal-legacy-panel">
        {children}
      </main>
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
