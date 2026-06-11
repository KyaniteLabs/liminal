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
  /** True when the studio backend is unreachable — shows the remedy banner. */
  backendDown?: boolean;
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
  onCancelRun,
  runDisabled,
  stageBusy,
  artifactReady,
  runLabel,
  audioSlot,
  providerLabel,
  backendDown,
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
  const userPrompt = prompt.trim();
  const showRecovery = Boolean(recourseSlot);
  const showStopped = recourseState === 'stopped';
  const showGeneratePreviewReady = activeMode === 'generate' && artifactReady;
  const artifactHeading = stageBusy
    ? 'Sinter is generating…'
    : showRecovery
      ? showStopped ? 'Generation stopped' : 'No preview was produced'
    : showGeneratePreviewReady
      ? 'Preview is ready'
    : userPrompt
      ? 'Ready to generate your preview'
      : 'Start with a prompt, then preview here';
  const artifactDetail = stageBusy
    ? 'Live output will appear in the side panel as soon as it is available.'
    : showRecovery
      ? showStopped ? 'The run was stopped. Edit the prompt or try again when ready.' : 'Use a recovery action, or edit the prompt and try again.'
    : showGeneratePreviewReady
      ? 'Use the message box to revise, make a variation, or polish this direction.'
    : userPrompt
      ? 'Click Generate and I’ll keep the conversation focused while the artifact opens on the right.'
      : 'The preview panel stays quiet until there is something visual or playable to inspect.';
  const runStatusText = stageBusy
    ? `${runLabel} in progress`
    : runDisabled
      ? 'Describe an artifact to enable generation'
      : `${runLabel} ready`;

  React.useEffect(() => {
    if (activeMode !== primaryMode.id) {
      setSecondaryToolsOpen(true);
    }
  }, [activeMode, primaryMode.id]);

  return (
    <div className="sinter-workbench sinter-workbench--chat-first">
      <a className="sinter-skip-link" href="#main-content">Skip to main content</a>
      {backendDown && (
        <div className="atelier-alert atelier-alert--warn sinter-backend-banner" role="alert">
          Studio backend isn&apos;t reachable — generation and live data are paused.
          Start it from a terminal: <code>sinter studio</code>
        </div>
      )}
      <header className="sinter-commandbar">
        <div className="sinter-brand">
          <span className="sinter-brand__mark">S</span>
          <div>
            <h1>Sinter Studio</h1>
            <p>Creative coding studio</p>
          </div>
        </div>
        <details className="sinter-runtime-details">
          <summary aria-label="Runtime details">
            <span>Model</span>
            <strong>{providerLabel}</strong>
          </summary>
          <div className="sinter-runtime-details__body" aria-label="Runtime status">
            <span><b>Agent</b>{providerLabel}</span>
            <span><b>Judge</b>{evaluatorLabel}</span>
            <span><b>Details</b>{inspectorLabel}</span>
          </div>
        </details>
      </header>

      <aside className="sinter-left-rail">
        <nav aria-label="Workbench modes">
          <div className="sinter-rail-group">
            <button
              type="button"
              className={primaryMode.id === activeMode ? 'sinter-primary-mode sinter-rail-button sinter-rail-button--active' : 'sinter-primary-mode sinter-rail-button'}
              aria-current={primaryMode.id === activeMode ? 'page' : undefined}
              onClick={() => onModeChange(primaryMode)}
            >
              {primaryMode.label}
            </button>
            {generateTabs.length > 1 && (
              <details className="sinter-subnav sinter-subnav--drawer">
                <summary aria-label="More Generate tools">Create tools</summary>
                <div className="sinter-subnav__body">
                  {generateTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={tab === activeTab ? 'sinter-subnav-button sinter-subnav-button--active' : 'sinter-subnav-button'}
                      aria-current={tab === activeTab ? 'page' : undefined}
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
          </div>
          {secondaryModes.length > 0 && (
            <details
              className="sinter-secondary-tools"
              open={secondaryToolsOpen}
              onToggle={(event) => setSecondaryToolsOpen(event.currentTarget.open)}
            >
              <summary aria-label="More tools">More</summary>
              <div className="sinter-secondary-tools__body">
                {secondaryModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={mode.id === activeMode ? 'sinter-rail-button sinter-rail-button--active' : 'sinter-rail-button'}
                    aria-current={mode.id === activeMode ? 'page' : undefined}
                    onClick={() => onModeChange(mode)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </details>
          )}
          {activeModeObject.id !== primaryMode.id && activeModeObject.legacyTabs.length > 1 && (
            <details className="sinter-subnav sinter-subnav--drawer" open>
              <summary>{activeModeLabel} views</summary>
              <div className="sinter-subnav__body">
                {activeModeObject.legacyTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={tab === activeTab ? 'sinter-subnav-button sinter-subnav-button--active' : 'sinter-subnav-button'}
                    aria-current={tab === activeTab ? 'page' : undefined}
                    onClick={() => onTabChange(tab)}
                  >
                    {formatLegacyTab(tab)}
                  </button>
                ))}
              </div>
            </details>
          )}
        </nav>
        <details className="sinter-left-rail__content sinter-rail-meta-details">
          <summary>Session</summary>
          {leftSlot}
        </details>
      </aside>

      <main id="main-content" className="sinter-chat-surface" aria-label="Creative coding conversation">
        <div className="sinter-chat-timeline" aria-live="polite">
          <article className="sinter-chat-message sinter-chat-message--assistant">
            <span className="sinter-chat-kicker">AI creative coding agent</span>
            <h2>What should we make?</h2>
            <p>
              Describe a sketch, scene, shader, sound, or visual system. I’ll ask for missing details
              when useful, generate the artifact, then help you revise or polish it.
            </p>
            <div className="sinter-chat-chips" aria-label="Preserved capabilities">
              <span>Generate</span>
              <span>Preview</span>
              <span>Revise</span>
              <span>Polish</span>
            </div>
          </article>

          {userPrompt ? (
            <article className="sinter-chat-message sinter-chat-message--user" aria-label="Current prompt draft">
              <span>You</span>
              <p>{userPrompt}</p>
            </article>
          ) : null}

          <article className="sinter-artifact-card" aria-label="Artifact preview card">
            <div>
              <span>{stageBusy ? 'Working artifact' : 'Artifact preview'}</span>
              <strong>{artifactHeading}</strong>
              <small>{artifactDetail}</small>
            </div>
            <a href="#sinter-preview-panel">View preview</a>
          </article>

          {recourseSlot}

          {children ? (
            <section className="sinter-legacy-panel" aria-label="Supplemental panel">
              {children}
            </section>
          ) : null}

          <details className="sinter-receipt-details" open={stageBusy || Boolean(recourseSlot)}>
            <summary>
              <span>Work log</span>
              <strong>{stageBusy ? 'live' : showRecovery ? showStopped ? 'stopped' : 'needs recovery' : 'collapsed'}</strong>
            </summary>
            <section className="sinter-timeline" aria-label="Generation timeline" role="status" aria-live="polite">
              {timelineSlot}
            </section>
          </details>

          <details className="sinter-advanced-drawer">
            <summary>
              <span>Details</span>
              <strong>{activeModeLabel} · {activeSurfaceLabel}</strong>
            </summary>
            <aside className="sinter-inspector" aria-label="Details">
              <div className="sinter-inspector__header">
                <span>Behind the scenes</span>
                <small>{inspectorLabel}</small>
              </div>
              {inspectorSlot}
            </aside>
          </details>
        </div>

        <section className="sinter-chat-composer" aria-label="Message composer">
          <div className="sinter-composer-head">
            <label className="sinter-composer-label" htmlFor="workbench-prompt">Message Sinter</label>
            <span>{stageBusy ? 'Working' : 'Ready'}</span>
          </div>
          <textarea
            id="workbench-prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            rows={4}
            placeholder="Create a p5.js sketch of luminous blue-green particles orbiting a dark center…"
            aria-describedby="workbench-run-status"
          />
          {conversationNotice ? (
            <p className="sinter-composer-notice" role="status">{conversationNotice}</p>
          ) : null}
          <div className="sinter-composer-actions">
            {audioSlot ? (
              <details className="sinter-composer-options">
                <summary>Options</summary>
                <div>{audioSlot}</div>
              </details>
            ) : null}
            {stageBusy && onCancelRun ? (
              <button className="sinter-stop-button" type="button" onClick={onCancelRun} aria-label="Stop active generation">
                Stop
              </button>
            ) : null}
            <button className="sinter-run-button" type="button" onClick={onRun} disabled={runDisabled} aria-busy={stageBusy}>
              {runLabel}
            </button>
            <p id="workbench-run-status" className="sr-only" aria-live="polite">{runStatusText}</p>
          </div>
        </section>
      </main>

      <aside id="sinter-preview-panel" className="sinter-preview-panel" aria-label="Live preview and artifact panel" aria-busy={stageBusy}>
        <div className="sinter-preview-panel__header">
          <span>Preview</span>
          <strong>Your artifact</strong>
          <small>Generated sketches, shaders, images, motion, and playable sound open here.</small>
        </div>
        <div className="sinter-preview-panel__stage sinter-stage">
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
