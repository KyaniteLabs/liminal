import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchMode } from '../gui/workbenchState';
import { useTuiBridgeSession } from '../gui/useTuiBridgeSession';

/**
 * ShowcaseStage — the A+C entry view: a near-black room where the newest
 * gallery work renders live and large. The chat line is a real bench: prompts
 * run through the bridge session without leaving the room, and when a run
 * produces a preview the stage hangs the fresh work. The art is the only
 * thing that moves; chrome stays still.
 */

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

interface StageProps {
  modes: WorkbenchMode[];
  onNavigate: (modeId: string) => void;
}

interface FeaturedWork {
  project: string;
  iterationCount: number;
  previewUrl: string;
}

function prettifyProject(name: string): string {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}--?/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || name;
}

export function ShowcaseStage({ modes, onNavigate }: StageProps) {
  const [projects, setProjects] = useState<string[]>([]);
  const [featured, setFeatured] = useState<FeaturedWork | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [showRun, setShowRun] = useState(false);
  const queuedPromptRef = useRef<string | null>(null);

  const bridge = useTuiBridgeSession();
  const runActive = bridge.submitting || bridge.summary.active;
  const runPreview = bridge.preview;
  const pending = bridge.session?.pendingAction ?? null;

  const featureProject = useCallback(async (project: string) => {
    setLoading(true);
    setStageError(null);
    setShowRun(false);
    try {
      const res = await fetch(`${API}/gallery/${encodeURIComponent(project)}`);
      if (!res.ok) throw new Error(`gallery/${project}: ${res.status}`);
      const data = await res.json();
      const iterations = Array.isArray(data.iterations) ? data.iterations : [];
      if (iterations.length === 0) throw new Error('no iterations');
      setFeatured({
        project,
        iterationCount: iterations.length,
        previewUrl: `${API}/gallery/${encodeURIComponent(project)}/render`,
      });
    } catch (e) {
      setStageError(e instanceof Error ? e.message : String(e));
      setFeatured(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/gallery`);
        if (!res.ok) throw new Error(`gallery list: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: string[] = Array.isArray(data.projects) ? [...data.projects].sort().reverse() : [];
        setProjects(list.slice(0, 8));
        if (list.length > 0) void featureProject(list[0]);
        else setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setStageError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [featureProject]);

  // A prompt submitted before the session existed waits here until the
  // session arrives, then runs — keeps the submit handler race-free.
  useEffect(() => {
    if (bridge.session?.sessionId && queuedPromptRef.current) {
      const queued = queuedPromptRef.current;
      queuedPromptRef.current = null;
      void bridge.submitPrompt(queued, { clientIntent: 'creative' });
    }
  }, [bridge.session?.sessionId, bridge]);

  // When a run yields a visual preview, the stage hangs the fresh work.
  useEffect(() => {
    if (runPreview && (runPreview.type === 'html' || runPreview.type === 'music' || runPreview.type === 'image')) {
      setShowRun(true);
    }
  }, [runPreview]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = prompt.trim();
    if (!value || runActive) return;
    setLastPrompt(value);
    setPrompt('');
    if (bridge.session?.sessionId) {
      // The stage bench is a creative surface: route straight to generation
      // instead of letting the classifier file poetic prompts under chat.
      void bridge.submitPrompt(value, { clientIntent: 'creative' });
    } else {
      queuedPromptRef.current = value;
      void bridge.createSession();
    }
  };

  const runFrame = showRun && runPreview
    ? runPreview.type === 'image' && runPreview.src
      ? <img className="stage-frame stage-frame--img" src={runPreview.src} alt={lastPrompt ?? runPreview.label} />
      : typeof runPreview.content === 'string'
        ? <iframe className="stage-frame" srcDoc={runPreview.content} title={lastPrompt ?? runPreview.label} sandbox="allow-scripts" />
        : null
    : null;

  return (
    <div className="stage-room">
      <a className="sinter-skip-link" href="#stage-chat">Skip to prompt</a>
      <nav className="stage-rail" aria-label="Studio views">
        <span className="stage-rail__mark" aria-hidden="true">S</span>
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={mode.id === 'showcase' ? 'stage-rail__item stage-rail__item--active' : 'stage-rail__item'}
            onClick={() => onNavigate(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </nav>

      <main className="stage-canvas" aria-label="Featured work">
        {runFrame ?? (featured && (
          <iframe
            className="stage-frame"
            src={featured.previewUrl}
            title={`Featured work: ${prettifyProject(featured.project)}`}
            sandbox="allow-scripts"
          />
        ))}
        {!runFrame && !featured && !loading && (
          <div className="stage-empty">
            {stageError ? (
              <>
                <h2>The gallery isn&apos;t reachable</h2>
                <p>Start the studio backend from a terminal: <code>sinter studio</code></p>
                <p className="stage-empty__detail">{stageError}</p>
              </>
            ) : (
              <>
                <h2>No works yet</h2>
                <p>Describe something below and Sinter will make the first one.</p>
              </>
            )}
          </div>
        )}
        {!runFrame && loading && <div className="stage-empty"><p>Hanging the work…</p></div>}

        {runFrame ? (
          <div className="stage-caption">
            <strong>{lastPrompt ?? 'New work'}</strong>
            <span>fresh from this session · unsaved</span>
          </div>
        ) : featured && (
          <div className="stage-caption">
            <strong>{prettifyProject(featured.project)}</strong>
            <span>{featured.iterationCount} iteration{featured.iterationCount === 1 ? '' : 's'} · gallery</span>
          </div>
        )}

        {projects.length > 1 && (
          <div className="stage-strip" role="listbox" aria-label="Recent works">
            {projects.map((p) => (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={!showRun && featured?.project === p}
                className={!showRun && featured?.project === p ? 'stage-strip__item stage-strip__item--active' : 'stage-strip__item'}
                onClick={() => void featureProject(p)}
              >
                {prettifyProject(p)}
              </button>
            ))}
          </div>
        )}
      </main>

      <div className="stage-bench">
        {bridge.error && (
          <p className="stage-bench__line stage-bench__line--error" role="alert">{bridge.error}</p>
        )}
        {pending && (
          <div className="stage-bench__line stage-bench__pending">
            <span>{pending.title}{pending.description ? ` — ${pending.description}` : ''}</span>
            <button type="button" onClick={() => void bridge.confirmPending()}>Confirm</button>
            <button type="button" className="stage-bench__ghost" onClick={() => void bridge.cancelPending()}>Cancel</button>
          </div>
        )}
        {runActive && !pending && (
          <div className="stage-bench__line" aria-live="polite">
            <span className="stage-bench__pulse" aria-hidden="true" />
            <span>{bridge.summary.phase || 'working'}{lastPrompt ? ` — ${lastPrompt}` : ''}</span>
            <button type="button" className="stage-bench__ghost" onClick={() => void bridge.cancelCurrent()}>Stop</button>
          </div>
        )}
        <form id="stage-chat" className="stage-chat" onSubmit={submit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={runActive ? 'Working — you can queue the next idea' : 'What should we make?'}
            aria-label="Describe what to create"
          />
          <button type="submit" disabled={!prompt.trim() || runActive}>Create</button>
        </form>
      </div>
    </div>
  );
}
