import React, { useCallback, useEffect, useState } from 'react';
import type { WorkbenchMode } from '../gui/workbenchState';

/**
 * ShowcaseStage — the A+C entry view: a near-black room where the newest
 * gallery work renders live and large, with a ghost rail for real views and a
 * single chat line that hands a prompt to the Create flow. The art is the only
 * thing that moves; chrome stays still.
 */

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL)
  ? import.meta.env.VITE_API_BASEURL
  : '/api';

interface StageProps {
  modes: WorkbenchMode[];
  onNavigate: (modeId: string) => void;
  onCreate: (prompt: string) => void;
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

export function ShowcaseStage({ modes, onNavigate, onCreate }: StageProps) {
  const [projects, setProjects] = useState<string[]>([]);
  const [featured, setFeatured] = useState<FeaturedWork | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');

  const featureProject = useCallback(async (project: string) => {
    setLoading(true);
    setStageError(null);
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = prompt.trim();
    if (value) onCreate(value);
  };

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
        {featured && (
          <iframe
            className="stage-frame"
            src={featured.previewUrl}
            title={`Featured work: ${prettifyProject(featured.project)}`}
            sandbox="allow-scripts"
          />
        )}
        {!featured && !loading && (
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
        {loading && <div className="stage-empty"><p>Hanging the work…</p></div>}

        {featured && (
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
                aria-selected={featured?.project === p}
                className={featured?.project === p ? 'stage-strip__item stage-strip__item--active' : 'stage-strip__item'}
                onClick={() => void featureProject(p)}
              >
                {prettifyProject(p)}
              </button>
            ))}
          </div>
        )}
      </main>

      <form id="stage-chat" className="stage-chat" onSubmit={submit}>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should we make?"
          aria-label="Describe what to create"
        />
        <button type="submit" disabled={!prompt.trim()}>Create</button>
      </form>
    </div>
  );
}
