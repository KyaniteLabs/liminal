import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchMode } from '../gui/workbenchState';
import { useTuiBridgeSession } from '../gui/useTuiBridgeSession';

/**
 * ShowcaseStage — the A+C entry view: a near-black room where Sinter's best
 * work renders live and large. The program comes from the quality archive
 * (each domain's top-scored piece first); the gallery's newest projects are
 * the fallback when the archive is empty. The chat line is a real bench:
 * prompts run through the bridge session without leaving the room, and when
 * a run produces a preview the stage hangs the fresh work. The art is the
 * only thing that moves; chrome stays still.
 */

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

/** Audio domains can't hang on a visual stage. */
const AUDIO_DOMAINS = new Set(['strudel', 'tone', 'music', 'audio']);

interface StageProps {
  modes: WorkbenchMode[];
  onNavigate: (modeId: string) => void;
}

interface ArchiveTop {
  id: string;
  domain: string;
  prompt: string;
  qualityScore: number;
  createdAt: string;
}

interface StageWork {
  /** Stable identity for strip selection. */
  key: string;
  /** Headline shown in the caption. */
  title: string;
  /** Provenance line under the title. */
  meta: string;
  /** Short label for the program strip. */
  stripLabel: string;
  previewUrl: string;
}

function prettifyProject(name: string): string {
  return name
    .replace(/^\d{4}-\d{2}-\d{2}--?/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || name;
}

function prettifyPrompt(prompt: string): string {
  // Archive prompts carry cycle/timestamp suffixes; the stage shows the idea.
  return prompt.replace(/\s+[—–-]+\s*(cycle|archivefix).*$/i, '').trim() || prompt;
}

function archiveWork(top: ArchiveTop): StageWork {
  const title = prettifyPrompt(top.prompt);
  return {
    key: top.id,
    title,
    meta: `${top.domain} · scored ${top.qualityScore.toFixed(2)} · archive`,
    stripLabel: top.domain,
    previewUrl: `${API}/archive/${encodeURIComponent(top.id)}/render`,
  };
}

function galleryWork(project: string, iterationCount: number): StageWork {
  return {
    key: project,
    title: prettifyProject(project),
    meta: `${iterationCount} iteration${iterationCount === 1 ? '' : 's'} · gallery`,
    stripLabel: prettifyProject(project),
    previewUrl: `${API}/gallery/${encodeURIComponent(project)}/render`,
  };
}

export function ShowcaseStage({ modes, onNavigate }: StageProps) {
  const [program, setProgram] = useState<StageWork[]>([]);
  const [featured, setFeatured] = useState<StageWork | null>(null);
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

  const featureWork = useCallback((work: StageWork) => {
    setShowRun(false);
    setFeatured(work);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The archive's curated tops are the program; gallery is the fallback.
        const tops: ArchiveTop[] = await fetch(`${API}/archive/tops?limit=12`)
          .then((r) => (r.ok ? r.json() : { tops: [] }))
          .then((d) => (Array.isArray(d.tops) ? d.tops : []))
          .catch(() => []);
        const visualTops = tops.filter((t) => !AUDIO_DOMAINS.has(t.domain));
        if (!cancelled && visualTops.length > 0) {
          const works = visualTops.map(archiveWork);
          setProgram(works);
          setFeatured(works[0]);
          setLoading(false);
          return;
        }
        const res = await fetch(`${API}/gallery`);
        if (!res.ok) throw new Error(`gallery list: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const list: string[] = Array.isArray(data.projects) ? [...data.projects].sort().reverse() : [];
        const works: StageWork[] = [];
        for (const project of list.slice(0, 8)) {
          try {
            const detail = await fetch(`${API}/gallery/${encodeURIComponent(project)}`).then((r) => r.json());
            const iterations = Array.isArray(detail.iterations) ? detail.iterations : [];
            if (iterations.length > 0) works.push(galleryWork(project, iterations.length));
          } catch {
            // Skip unreadable projects; the stage shows what it can.
          }
          if (cancelled) return;
        }
        setProgram(works);
        setFeatured(works[0] ?? null);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setStageError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      <h1 className="sr-only">Sinter Studio — Showcase</h1>
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
            title={`Featured work: ${featured.title}`}
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
            <strong>{featured.title}</strong>
            <span>{featured.meta}</span>
          </div>
        )}

        {program.length > 1 && (
          <div className="stage-strip" role="group" aria-label="Program of works">
            {program.map((work) => (
              <button
                key={work.key}
                type="button"
                aria-pressed={!showRun && featured?.key === work.key}
                className={!showRun && featured?.key === work.key ? 'stage-strip__item stage-strip__item--active' : 'stage-strip__item'}
                onClick={() => featureWork(work)}
              >
                {work.stripLabel}
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
