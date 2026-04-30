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
  stageBusy: boolean;
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
  stageBusy,
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
  const activeModeLabel = modes.find((mode) => mode.id === activeMode)?.label ?? 'Generate';
  const activeSurfaceLabel = formatLegacyTab(activeTab);
  const userPrompt = prompt.trim();
  const artifactHeading = stageBusy
    ? 'Liminal is generating…'
    : userPrompt
      ? 'Ready to generate your preview'
      : 'Start with a prompt, then preview here';
  const artifactDetail = stageBusy
    ? 'Live output will appear in the side panel as soon as it is available.'
    : userPrompt
      ? 'Click Generate and I’ll keep the conversation focused while the artifact opens on the right.'
      : 'The preview panel stays quiet until there is something visual or playable to inspect.';
  const runStatusText = stageBusy
    ? `${runLabel} in progress`
    : runDisabled
      ? 'Describe an artifact to enable generation'
      : `${runLabel} ready`;

  return (
    <div className="liminal-workbench liminal-workbench--chat-first">
      <a className="liminal-skip-link" href="#main-content">Skip to main content</a>
      <header className="liminal-commandbar">
        <div className="liminal-brand">
          <span className="liminal-brand__mark">L</span>
          <div>
            <h1>Liminal Studio</h1>
            <p>Codex for creative coding</p>
          </div>
        </div>
        <details className="liminal-runtime-details">
          <summary aria-label="Runtime details">
            <span>Runtime</span>
            <strong>{providerLabel}</strong>
          </summary>
          <div className="liminal-runtime-details__body" aria-label="Runtime status">
            <span><b>Agent</b>{providerLabel}</span>
            <span><b>Judge</b>{evaluatorLabel}</span>
            <span><b>Run details</b>{inspectorLabel}</span>
          </div>
        </details>
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

      <main id="main-content" className="liminal-chat-surface" aria-label="Creative coding conversation">
        <div className="liminal-chat-timeline" aria-live="polite">
          <article className="liminal-chat-message liminal-chat-message--assistant">
            <span className="liminal-chat-kicker">AI creative coding agent</span>
            <h2>What should we make?</h2>
            <p>
              Describe a sketch, scene, shader, sound, or visual system. I’ll ask for missing details
              when useful, generate the artifact, then help you revise or polish it.
            </p>
            <div className="liminal-chat-chips" aria-label="Preserved capabilities">
              <span>Generate</span>
              <span>Preview</span>
              <span>Revise</span>
              <span>Polish</span>
            </div>
          </article>

          {userPrompt ? (
            <article className="liminal-chat-message liminal-chat-message--user" aria-label="Current prompt draft">
              <span>You</span>
              <p>{userPrompt}</p>
            </article>
          ) : null}

          <article className="liminal-artifact-card" aria-label="Artifact preview card">
            <div>
              <span>{stageBusy ? 'Working artifact' : 'Artifact preview'}</span>
              <strong>{artifactHeading}</strong>
              <small>{artifactDetail}</small>
            </div>
            <a href="#liminal-preview-panel">View preview</a>
          </article>

          {children ? (
            <section className="liminal-legacy-panel" aria-label="Supplemental panel">
              {children}
            </section>
          ) : null}

          <details className="liminal-receipt-details" open={stageBusy}>
            <summary>
              <span>Work log</span>
              <strong>{stageBusy ? 'live' : 'collapsed'}</strong>
            </summary>
            <section className="liminal-timeline" aria-label="Generation timeline" role="status" aria-live="polite">
              {timelineSlot}
            </section>
          </details>

          <details className="liminal-advanced-drawer">
            <summary>
              <span>Advanced settings and run details</span>
              <strong>{activeModeLabel} · {activeSurfaceLabel}</strong>
            </summary>
            <aside className="liminal-inspector" aria-label="Advanced settings and run details">
              <div className="liminal-inspector__header">
                <span>Behind the scenes</span>
                <small>{inspectorLabel}</small>
              </div>
              {inspectorSlot}
            </aside>
          </details>
        </div>

        <section className="liminal-chat-composer" aria-label="Message composer">
          <div className="liminal-composer-head">
            <label className="liminal-composer-label" htmlFor="workbench-prompt">Message Liminal</label>
            <span>{activeModeLabel} · {activeSurfaceLabel}</span>
          </div>
          <textarea
            id="workbench-prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={4}
            placeholder="Create a p5.js sketch of luminous blue-green particles orbiting a dark center…"
            aria-describedby="workbench-run-status"
          />
          <div className="liminal-composer-actions">
            {audioSlot ? (
              <details className="liminal-composer-options">
                <summary>Options</summary>
                <div>{audioSlot}</div>
              </details>
            ) : null}
            <button className="liminal-run-button" type="button" onClick={onRun} disabled={runDisabled} aria-busy={stageBusy}>
              {runLabel}
            </button>
            <p id="workbench-run-status" className="sr-only" aria-live="polite">{runStatusText}</p>
          </div>
        </section>
      </main>

      <aside id="liminal-preview-panel" className="liminal-preview-panel" aria-label="Live preview and artifact panel" aria-busy={stageBusy}>
        <div className="liminal-preview-panel__header">
          <span>Preview</span>
          <strong>Your artifact</strong>
          <small>Generated sketches, shaders, images, motion, and playable sound open here.</small>
        </div>
        <div className="liminal-preview-panel__stage liminal-stage">
          {stageSlot}
        </div>
      </aside>
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
