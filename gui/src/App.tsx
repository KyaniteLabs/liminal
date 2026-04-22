import { useState, useEffect, useReducer, useRef } from 'react';
import {
  liveOrganismReducer,
  INITIAL_LIVE_ORGANISM_STATE,
  switchToLiveOrganismView,
  setPreviewRunResult,
} from './gui/liveOrganismState';
import { CuratorMode } from './components/CuratorMode';
import { ActivityDashboard } from './components/ActivityDashboard';
import { CompostVisualizer } from './components/CompostVisualizer';
import { OperatorCockpit } from './components/OperatorCockpit';
import { useEventStream } from './components/activity/hooks';

// State types
interface MergeProposal {
  proposed: {
    type: string;
    musicCode?: string;
    visualCode?: string;
    code?: string;
  };
  versionA?: number;
  versionB?: number;
}

interface RunResult {
  result?: {
    iterations: number;
    finalScore: number;
  };
  projectDirName?: string;
}

interface LiveMusicLoading {
  music: boolean;
  visuals: boolean;
}

interface CreateTraits {
  bpm: number;
  palette: string;
}

interface GuiIteration {
  version?: number;
  type?: string;
  musicCode?: string;
  visualCode?: string;
  code?: string;
  id?: number;
  timestamp?: number;
}

interface ConfigResponse {
  effective?: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKeyStored?: boolean;
  };
  loop?: {
    maxIterations?: number;
    timeoutMinutes?: number;
  };
  creative?: {
    minQualityScore?: number;
  };
  galleryPath?: string;
}

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL) ? import.meta.env.VITE_API_BASEURL : '/api';

// Base64 for Strudel embed URL hash (UTF-8 safe)
function base64UrlCode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  /* Visual state handled by .atelier-tab / .atelier-tab--active in CSS.
     Only active flag drives className; this object is kept minimal
     for any dynamic overrides that CSS custom properties can't express. */
});

export default function App() {
  const [liveState, dispatchLive] = useReducer(liveOrganismReducer, INITIAL_LIVE_ORGANISM_STATE);
  const { activeTab, previewUrl, runError } = liveState;
  const { events: compostEvents, connected: compostConnected } = useEventStream();

  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Live organism: gallery selection
  const [projects, setProjects] = useState<string[]>([]);
  const [iterations, setIterations] = useState<GuiIteration[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedIterationIndex, setSelectedIterationIndex] = useState<number>(0);
  const [previewRunning, setPreviewRunning] = useState<boolean>(false);
  const [galleryApiFailed, setGalleryApiFailed] = useState<boolean>(false);

  // Merge / Approve: proposal from /api/merge or /api/propose-mutate
  const [mergeProposal, setMergeProposal] = useState<MergeProposal | null>(null);
  const [mergeApiError, setMergeApiError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState<boolean>(false);

  // Create (run loop): prompt, run status, result
  const [createPrompt, setCreatePrompt] = useState<string>('');
  const [createMaxIterations, setCreateMaxIterations] = useState<number>(5);
  const [createMode, setCreateMode] = useState<string>('p5');
  const [createTraits, setCreateTraits] = useState<CreateTraits>({ bpm: 120, palette: '' });
  const [runStatus, setRunStatus] = useState<string>('');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [createRunError, setCreateRunError] = useState<string | null>(null);

  // Live Music: generated code
  const [liveMusicPrompt, setLiveMusicPrompt] = useState<string>('ambient glitch');
  const [musicCode, setMusicCode] = useState<string>('');
  const [visualsCode, setVisualsCode] = useState<string>('');
  const [liveMusicLoading, setLiveMusicLoading] = useState<LiveMusicLoading>({ music: false, visuals: false });
  const hydraContainerRef = useRef<HTMLDivElement>(null);

  // Form state: effective + loop + creative + galleryPath; on save we build userConfig
  const [provider, setProvider] = useState<string>('lmstudio');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('local-model');
  const [apiKey, setApiKey] = useState<string>('');
  const [maxIterations, setMaxIterations] = useState<number>(20);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);
  const [minQualityScore, setMinQualityScore] = useState<number>(0.7);
  const [galleryPath, setGalleryPath] = useState<string>('gallery');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/config`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (cancelled) return;
        setConfig(data);
        setProvider(data.effective?.provider ?? 'lmstudio');
        setBaseUrl(data.effective?.baseUrl ?? '');
        setModel(data.effective?.model ?? 'local-model');
        setApiKey(data.effective?.apiKeyStored ? '(stored)' : '');
        setMaxIterations(data.loop?.maxIterations ?? 20);
        setTimeoutMinutes(data.loop?.timeoutMinutes ?? 30);
        setMinQualityScore(data.creative?.minQualityScore ?? 0.7);
        setGalleryPath(data.galleryPath ?? 'gallery');
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load gallery projects when switching to Live organism tab
  useEffect(() => {
    if (activeTab !== 'live') return;
    setGalleryApiFailed(false);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/gallery`);
        if (!res.ok) {
          if (!cancelled) setGalleryApiFailed(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setProjects(data.projects || []);
        if ((data.projects || []).length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0]);
        }
      } catch (_) {
        if (!cancelled) setGalleryApiFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  // Load iterations when project selected
  useEffect(() => {
    if (activeTab !== 'live' || !selectedProject) {
      setIterations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/gallery/${encodeURIComponent(selectedProject)}`);
        if (!res.ok) {
          if (res.status === 404 && API === '/api') {
            console.warn('Gallery project 404: ensure the backend is running on port 5174 (run "npm run gui" in another terminal).');
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setIterations(data.iterations || []);
        setSelectedIterationIndex(0);
      } catch (err) { console.warn('Failed to load iterations:', err); }
    })();
    return () => { cancelled = true; };
  }, [activeTab, selectedProject]);

  // Hydra: show generated visuals code as read-only text (execution disabled for security)
  useEffect(() => {
    if (!visualsCode || activeTab !== 'liveMusic') return;
    const el = hydraContainerRef.current;
    if (!el) return;

    // Clear previous content safely
    while (el.firstChild) el.removeChild(el.firstChild);

    const notice = document.createElement('div');
    notice.style.color = '#f66';
    notice.style.padding = '12px';
    notice.style.fontFamily = 'var(--font-body)';
    notice.style.fontSize = '13px';
    notice.textContent = 'Preview disabled \u2014 generated code is untrusted. Visual preview requires isolated runtime (coming soon).';
    el.appendChild(notice);

    const pre = document.createElement('pre');
    pre.style.color = 'var(--atelier-success)';
    pre.style.padding = '12px';
    pre.style.fontFamily = 'var(--font-mono)';
    pre.style.fontSize = '12px';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.textContent = visualsCode;
    el.appendChild(pre);

    return () => { while (el.firstChild) el.removeChild(el.firstChild); };
  }, [visualsCode, activeTab]);

  const handleRunInPreview = async () => {
    const iteration = iterations[selectedIterationIndex];
    const code = iteration?.code ?? '';
    const version = (iteration?.version != null ? Number(iteration.version) : selectedIterationIndex + 1) || 1;
    dispatchLive(setPreviewRunResult(null, null));
    setPreviewRunning(true);
    try {
      const res = await fetch(`${API}/preview/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        dispatchLive(setPreviewRunResult(null, data.error || res.statusText));
        return;
      }
      const url = data.url || `/preview?version=${version}`;
      dispatchLive(setPreviewRunResult(url, null));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      dispatchLive(setPreviewRunResult(null, msg));
    } finally {
      setPreviewRunning(false);
    }
  };

  const handleMerge = async () => {
    if (!selectedProject || iterations.length < 2) return;
    setMergeApiError(null);
    const vA = iterations[0]?.version ?? 1;
    const vB = iterations[1]?.version ?? 2;
    try {
      const res = await fetch(`${API}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: selectedProject.replace(/^\d{4}-\d{2}-\d{2}--/, ''), dirName: selectedProject, versionA: vA, versionB: vB }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.proposed) {
        setMergeProposal({ proposed: data.proposed, versionA: vA, versionB: vB });
      } else {
        setMergeProposal(null);
        setMergeApiError(res.status === 404 ? 'Backend not running? Start with: node scripts/start-gui.js' : (data.error || 'Merge failed'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setMergeProposal(null);
      setMergeApiError(msg);
    }
  };

  const handleMutate = async () => {
    if (!selectedProject || iterations.length < 1) return;
    setMergeApiError(null);
    const it = iterations[selectedIterationIndex];
    const v = it?.version ?? selectedIterationIndex + 1;
    try {
      const res = await fetch(`${API}/propose-mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirName: selectedProject, version: v, traits: { bpm: 100, palette: '' } }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.proposed) {
        setMergeProposal({ proposed: data.proposed });
      } else {
        setMergeProposal(null);
        setMergeApiError(res.status === 404 ? 'Backend not running? Start with: node scripts/start-gui.js' : (data.error || 'Mutate failed'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setMergeProposal(null);
      setMergeApiError(msg);
    }
  };

  const handleApprove = async () => {
    if (!mergeProposal?.proposed || !selectedProject) return;
    setApproveLoading(true);
    try {
      const res = await fetch(`${API}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirName: selectedProject, proposed: mergeProposal.proposed }),
      });
      if (res.ok) {
        setMergeProposal(null);
        const data = await res.json().catch(() => ({}));
        const list = await fetch(`${API}/gallery/${encodeURIComponent(selectedProject)}`).then((r) => r.json()).catch(() => ({}));
        setIterations(list.iterations || []);
        setSelectedIterationIndex((list.iterations || []).length - 1);
      }
    } finally {
      setApproveLoading(false);
    }
  };

  const handleCreateRun = async () => {
    const prompt = createPrompt.trim();
    if (!prompt) return;
    setRunStatus('running');
    setCreateRunError(null);
    setRunResult(null);
    try {
      const res = await fetch(`${API}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          maxIterations: createMaxIterations,
          mode: createMode,
          traits: createMode === 'organism' ? createTraits : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateRunError(data.error || res.statusText);
        setRunStatus('error');
        return;
      }
      setRunResult(data);
      setRunStatus('done');
      setProjects((prev) => (data.projectDirName ? [data.projectDirName, ...prev] : prev));
      if (data.projectDirName) setSelectedProject(data.projectDirName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setCreateRunError(msg);
      setRunStatus('error');
    }
  };

  const handleGenerateMusic = async () => {
    setLiveMusicLoading((l) => ({ ...l, music: true }));
    setMusicCode('');
    try {
      const res = await fetch(`${API}/live-music/music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: liveMusicPrompt.trim() || 'ambient' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) setMusicCode(data.code);
      else setMusicCode(data.error || 'Failed');
    } finally {
      setLiveMusicLoading((l) => ({ ...l, music: false }));
    }
  };

  const handleGenerateVisuals = async () => {
    setLiveMusicLoading((l) => ({ ...l, visuals: true }));
    setVisualsCode('');
    try {
      const res = await fetch(`${API}/live-music/visuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: liveMusicPrompt.trim() || 'reactive' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) setVisualsCode(data.code);
      else setVisualsCode(data.error || 'Failed');
    } finally {
      setLiveMusicLoading((l) => ({ ...l, visuals: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const providerName = provider;
      const payload = {
        defaultProvider: providerName,
        providers: {
          [providerName]: {
            baseUrl: baseUrl || undefined,
            model: model || undefined,
            apiKey: apiKey || undefined,
          },
        },
        loop: { maxIterations, timeoutMinutes },
        creative: { minQualityScore },
        galleryPath: galleryPath || 'gallery',
      };
      const res = await fetch(`${API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMessage('Config saved to ~/.liminal/config.json');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--atelier-text-muted)', fontFamily: 'var(--font-body)' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px', maxWidth: 920, margin: '0 auto' }}>
      <a href="#main-content" className="atelier-skip-link">Skip to content</a>
      <h1 className="atelier-title" style={{ marginBottom: 8 }}>Liminal</h1>
      <p style={{ margin: '0 0 24px', color: 'var(--atelier-text-muted)', fontSize: 15 }}>Creative coding studio — generate, merge, and evolve sketches.</p>
      <nav className="atelier-tabs" role="tablist" aria-label="Main sections">
        <button
          type="button"
          className={`atelier-tab${activeTab === 'config' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'config'}
          onClick={() => dispatchLive(switchToLiveOrganismView('config'))}
        >
          Config
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'create' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'create'}
          onClick={() => dispatchLive(switchToLiveOrganismView('create'))}
        >
          Create
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'cockpit' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'cockpit'}
          onClick={() => dispatchLive(switchToLiveOrganismView('cockpit'))}
        >
          Cockpit
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'live' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'live'}
          onClick={() => dispatchLive(switchToLiveOrganismView('live'))}
        >
          Live organism
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'liveMusic' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'liveMusic'}
          onClick={() => dispatchLive(switchToLiveOrganismView('liveMusic'))}
        >
          Live Music
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'curator' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'curator'}
          onClick={() => dispatchLive(switchToLiveOrganismView('curator'))}
        >
          Curator
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'activity' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'activity'}
          onClick={() => dispatchLive(switchToLiveOrganismView('activity'))}
        >
          Activity
        </button>
        <button
          type="button"
          className={`atelier-tab${activeTab === 'compost' ? ' atelier-tab--active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'compost'}
          onClick={() => dispatchLive(switchToLiveOrganismView('compost'))}
        >
          Compost
        </button>
      </nav>

      <main id="main-content">
      {activeTab === 'config' && (
        <form id="atelier-config-form" onSubmit={(e: React.FormEvent) => e.preventDefault()} className="atelier-panel" style={{ maxWidth: 560 }} autoComplete="off">
          {error && (
            <div className="atelier-alert atelier-alert--error" style={{ marginBottom: 12 }}>{error}</div>
          )}
          {message && (
            <div className="atelier-alert atelier-alert--success" style={{ marginBottom: 12 }}>{message}</div>
          )}

          <section style={{ marginBottom: 24 }}>
            <h2 className="atelier-heading">LLM</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span className="atelier-label">Provider</span>
            <select
              value={provider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProvider(e.target.value)}
              className="atelier-select"
            >
              <option value="lmstudio">lmstudio</option>
              <option value="minimax">minimax</option>
              <option value="ollama">ollama</option>
              <option value="openai">openai</option>
              <option value="hybrid">hybrid</option>
            </select>
          </label>
          <label>
            <span className="atelier-label">Base URL</span>
            <input
              type="url"
              value={baseUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaseUrl(e.target.value)}
              placeholder="https://…"
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">Model</span>
            <input
              type="text"
              value={model}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setModel(e.target.value)}
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">API key (masked)</span>
            <input
              type="password"
              form="atelier-config-form"
              value={apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              className="atelier-input"
            />
          </label>
          <p style={{ fontSize: 12, color: 'var(--atelier-text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Keys are stored locally in ~/.liminal/config.json. Never sent to the frontend after saving.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="atelier-heading">Loop</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span className="atelier-label">Max iterations</span>
            <input
              type="number"
              min={1}
              max={100}
              value={maxIterations}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxIterations(Number(e.target.value))}
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">Timeout (minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={timeoutMinutes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeoutMinutes(Number(e.target.value))}
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">Min quality score (0–1)</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={minQualityScore}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinQualityScore(Number(e.target.value))}
              className="atelier-input"
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="atelier-heading">Gallery</h2>
        <label>
          <span className="atelier-label">Gallery path</span>
          <input
            type="text"
            value={galleryPath}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGalleryPath(e.target.value)}
            placeholder="gallery"
            className="atelier-input"
          />
        </label>
      </section>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="atelier-btn atelier-btn--primary"
      >
        {saving ? 'Saving…' : 'Save config'}
      </button>
        </form>
      )}

      {activeTab === 'create' && (
        <div className="atelier-panel" style={{ maxWidth: 560 }}>
          <h2 className="atelier-heading">Generate art</h2>
          <p style={{ color: 'var(--atelier-text-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Run the Ralph loop: same prompt every iteration, context accumulates. Use a rich prompt and an LLM in Config for varied, creative output.
          </p>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="atelier-label">Prompt</span>
            <textarea
              value={createPrompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreatePrompt(e.target.value)}
              placeholder="e.g. Create a calming blue particle system with soft gradients"
              rows={3}
              className="atelier-textarea"
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="atelier-label" style={{ marginRight: 8 }}>Max iterations</span>
            <input
              type="number"
              min={1}
              max={20}
              value={createMaxIterations}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateMaxIterations(Number(e.target.value))}
              className="atelier-input"
              style={{ width: 72 }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="atelier-label" style={{ marginRight: 8 }}>Run mode</span>
            <select
              value={createMode}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateMode(e.target.value)}
              className="atelier-select"
              style={{ width: 'auto', minWidth: 200 }}
            >
              <option value="p5">p5</option>
              <option value="organism">organism (Strudel + Hydra)</option>
            </select>
          </label>
          {createMode === 'organism' && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <label>
                <span className="atelier-label" style={{ marginRight: 4 }}>BPM</span>
                <input
                  type="number"
                  min={60}
                  max={240}
                  value={createTraits.bpm || 120}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateTraits((t) => ({ ...t, bpm: Number(e.target.value) }))}
                  className="atelier-input"
                  style={{ width: 80, marginLeft: 4 }}
                />
              </label>
              <label>
                <span className="atelier-label" style={{ marginRight: 4 }}>Palette</span>
                <input
                  type="text"
                  placeholder="e.g. warm, mono"
                  value={createTraits.palette || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateTraits((t) => ({ ...t, palette: e.target.value }))}
                  className="atelier-input"
                  style={{ width: 120, marginLeft: 4 }}
                />
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={handleCreateRun}
            disabled={runStatus === 'running' || !createPrompt.trim()}
            className="atelier-btn atelier-btn--primary"
          >
            {runStatus === 'running' ? 'Running…' : 'Run'}
          </button>
          {runStatus === 'done' && runResult && (
            <div className="atelier-alert atelier-alert--success" style={{ marginTop: 16 }}>
              Done: {runResult.result?.iterations} iterations, score {runResult.result?.finalScore?.toFixed(2)}. Go to Live organism and select &quot;{runResult.projectDirName}&quot;.
            </div>
          )}
          {runStatus === 'error' && createRunError && (
            <div className="atelier-alert atelier-alert--error" style={{ marginTop: 16 }}>{createRunError}</div>
          )}
        </div>
      )}

      {activeTab === 'liveMusic' && (
        <div className="atelier-panel" style={{ maxWidth: 960, width: '100%' }}>
          <h2 className="atelier-heading">Live Music</h2>
          <p style={{ color: 'var(--atelier-text-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Generate Strudel (music) and Hydra (visuals). Music runs in the embedded REPL; visuals run live below.
          </p>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span className="atelier-label">Prompt</span>
            <input
              type="text"
              value={liveMusicPrompt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLiveMusicPrompt(e.target.value)}
              placeholder="e.g. ambient glitch, anxious build"
              className="atelier-input"
              style={{ maxWidth: 400 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={handleGenerateMusic}
              disabled={liveMusicLoading.music}
              className="atelier-btn atelier-btn--music"
            >
              {liveMusicLoading.music ? '…' : 'Generate music (Strudel)'}
            </button>
            <button
              type="button"
              onClick={handleGenerateVisuals}
              disabled={liveMusicLoading.visuals}
              className="atelier-btn atelier-btn--visual"
            >
              {liveMusicLoading.visuals ? '…' : 'Generate visuals (Hydra)'}
            </button>
          </div>

          {musicCode && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 13, color: 'var(--atelier-music)', margin: 0, fontFamily: 'var(--font-body)', fontWeight: 600 }}>Strudel — music runs here</h3>
                <button
                  type="button"
                  className="atelier-btn atelier-btn--secondary"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => {
                    try {
                      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
                      if (ac.state !== 'running') ac.resume();
                    } catch (err) { console.warn('AudioContext resume failed:', err); }
                  }}
                >
                  Play
                </button>
                <span style={{ fontSize: 12, color: 'var(--atelier-text-dim)' }}>Click inside the Strudel box below to allow sound.</span>
              </div>
              <iframe
                title="Strudel REPL"
                src={`https://strudel.cc/embed/#${base64UrlCode(musicCode)}`}
                style={{ width: '100%', height: 380, border: '1px solid var(--atelier-border)', borderRadius: 'var(--atelier-radius-sm)', background: '#0a090c' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          )}

          {visualsCode && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: 'var(--atelier-visual)', marginBottom: 8, fontFamily: 'var(--font-body)', fontWeight: 600 }}>Hydra — code scrolling, visuals below</h3>
              <div
                style={{
                  overflow: 'hidden',
                  height: 52,
                  background: '#0a090c',
                  border: '1px solid var(--atelier-border)',
                  borderRadius: 'var(--atelier-radius-sm)',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    animation: 'atelier-scroll-code 15s linear infinite',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    color: 'var(--atelier-success)',
                  }}
                >
                  <span style={{ marginRight: 120 }}>{visualsCode.replace(/\s+/g, ' ')}</span>
                  <span style={{ marginRight: 120 }}>{visualsCode.replace(/\s+/g, ' ')}</span>
                </div>
              </div>
              <div
                ref={hydraContainerRef}
                style={{
                  width: '100%',
                  minHeight: 320,
                  background: '#000',
                  border: '1px solid var(--atelier-border)',
                  borderRadius: 'var(--atelier-radius-sm)',
                  overflow: 'hidden',
                }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'curator' && (
        <CuratorMode apiBase={API} onEvolve={(candidateId) => {
          // Navigate to Create tab with the selected candidate as context
          setSelectedProject(candidateId);
          dispatchLive(switchToLiveOrganismView('live'));
        }} />
      )}

      {activeTab === 'activity' && (
        <ActivityDashboard />
      )}

      {activeTab === 'cockpit' && (
        <OperatorCockpit />
      )}

      {activeTab === 'compost' && (
        <CompostVisualizer events={compostEvents} connected={compostConnected} />
      )}

      {activeTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {galleryApiFailed && (
            <div className="atelier-alert atelier-alert--warn">
              Gallery API not reachable. Start the backend: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>node scripts/start-gui.js</code> (then reload). Backend must run on port 5174.
            </div>
          )}
          <div className="atelier-panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <label>
                <span style={{ marginRight: 8, color: 'var(--atelier-text-muted)', fontSize: 13 }}>Project</span>
                <select
                  value={selectedProject}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProject(e.target.value)}
                  className="atelier-select"
                  style={{ width: 'auto', minWidth: 180 }}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ marginRight: 8, color: 'var(--atelier-text-muted)', fontSize: 13 }}>Iteration</span>
                <select
                  value={selectedIterationIndex}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedIterationIndex(Number(e.target.value))}
                  className="atelier-select"
                  style={{ width: 'auto', minWidth: 80 }}
                >
                  {iterations.map((it, i) => (
                    <option key={i} value={i}>v{(it.version != null ? it.version : i + 1)}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleRunInPreview}
                disabled={previewRunning || !iterations.length}
                className="atelier-btn atelier-btn--primary"
              >
                {previewRunning ? 'Running…' : 'Run preview'}
              </button>
              {iterations.length >= 2 && (
                <button
                  type="button"
                  onClick={handleMerge}
                  className="atelier-btn atelier-btn--secondary"
                >
                  Merge with…
                </button>
              )}
              {iterations.length >= 1 && (
                <button
                  type="button"
                  onClick={handleMutate}
                  className="atelier-btn"
                  style={{ background: 'var(--atelier-warn)', color: 'var(--atelier-bg)' }}
                >
                  Mutate
                </button>
              )}
            </div>
          </div>
          {mergeApiError && (
            <div className="atelier-alert atelier-alert--error">{mergeApiError}</div>
          )}
          {mergeProposal && (
            <div className="atelier-panel atelier-panel--raised" style={{ borderColor: 'rgba(90, 155, 110, 0.3)' }}>
              <h3 className="atelier-heading" style={{ color: 'var(--atelier-success)' }}>Proposed (merge/mutate) <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--atelier-text-muted)', marginLeft: 8 }}>AI-generated — verify before approving</span></h3>
              <pre className="atelier-code" style={{ maxHeight: 160 }}>
                {mergeProposal.proposed.type === 'organism'
                  ? (mergeProposal.proposed.musicCode || '') + '\n---\n' + (mergeProposal.proposed.visualCode || '')
                  : (mergeProposal.proposed.code || '')}
              </pre>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button type="button" onClick={handleApprove} disabled={approveLoading} className="atelier-btn atelier-btn--primary">
                  {approveLoading ? '…' : 'Approve'}
                </button>
                <button type="button" onClick={() => setMergeProposal(null)} className="atelier-btn atelier-btn--secondary">
                  Reject
                </button>
              </div>
            </div>
          )}
          {iterations.length > 0 && (() => {
            const it = iterations[selectedIterationIndex];
            const code = it?.type === 'organism'
              ? (it.musicCode || '') + '\n\n--- visual ---\n\n' + (it.visualCode || '')
              : (it?.code ?? '');
            return (
              <div className="atelier-panel">
                <h3 className="atelier-heading">Code (v{(it?.version ?? selectedIterationIndex + 1)}) <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--atelier-text-muted)', marginLeft: 8 }}>generated — review before executing</span></h3>
                <pre className="atelier-code" style={{ maxHeight: 280 }}>
                  <code>{code || '(empty)'}</code>
                </pre>
              </div>
            );
          })()}
          {runError && (
            <div className="atelier-alert atelier-alert--error">{runError}</div>
          )}
          {previewUrl && (
            <div style={{ flex: 1, minHeight: 400, border: '1px solid var(--atelier-border)', borderRadius: 'var(--atelier-radius)', overflow: 'hidden', position: 'relative' }}>
              <iframe
                title="Live organism"
                src={previewUrl}
                sandbox="allow-scripts"
                style={{ width: '100%', height: '100%', minHeight: 400, border: 0, background: '#000' }}
              />
              <div style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'rgba(0,0,0,0.7)',
                color: 'var(--atelier-text-muted)',
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                pointerEvents: 'none',
                zIndex: 10,
              }}>
                isolated preview
              </div>
            </div>
          )}
          {!previewUrl && !runError && activeTab === 'live' && (
            <p style={{ color: 'var(--atelier-text-muted)', fontSize: 14 }}>Select a project and iteration, then click Run preview to see the live sketch.</p>
          )}
        </div>
      )}
      </main>
    </div>
  );
}
