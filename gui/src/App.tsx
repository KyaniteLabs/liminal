import { useState, useEffect, useReducer, useRef } from 'react';
import {
  liveOrganismReducer,
  INITIAL_LIVE_ORGANISM_STATE,
  switchToLiveOrganismView,
  setPreviewRunResult,
  type GuiTab,
} from './gui/liveOrganismState';
import { CuratorMode } from './components/CuratorMode';
import { ActivityDashboard } from './components/ActivityDashboard';
import { CompostVisualizer } from './components/CompostVisualizer';
import { OperatorCockpit } from './components/OperatorCockpit';
import { WorkbenchShell } from './components/WorkbenchShell';
import { useEventStream } from './components/activity/hooks';
import {
  buildWorkbenchRunOptions,
  buildWorkbenchPrompt,
  CREATE_MODE_OPTIONS,
  detectPromptCreateMode,
  getCreateModeOption,
  requiresBridgeSession,
  usesOrganismApi,
  type CreateModeId,
  type WorkbenchExecutionMode,
} from './gui/createModes';
import { summarizeAudioSync, type AudioSyncFrame } from './gui/audioSync';
import { buildSyncPreviewHtml } from './gui/syncPreview';
import { getWorkbenchMode, shouldRenderLegacyPanel, WORKBENCH_MODES, type WorkbenchMode } from './gui/workbenchState';
import { latestClarificationRequest } from './gui/workbenchTelemetry';
import { useTuiBridgeSession } from './gui/useTuiBridgeSession';

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

type MicStatus = 'idle' | 'recording' | 'ready' | 'error';

interface ConfigResponse {
  effective?: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKeyStored?: boolean;
  };
  roles?: Record<string, {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKeyStored?: boolean;
  }>;
  loop?: {
    maxIterations?: number;
    timeoutMinutes?: number;
  };
  creative?: {
    minQualityScore?: number;
  };
  galleryPath?: string;
}

interface ImproveProposal {
  id: string;
  title: string;
  category: string;
  score: number;
  evidence: string[];
  measurableTarget: string;
  expectedVerification: string[];
}

interface ImproveReport {
  runType: string;
  summary: string;
  proposals: ImproveProposal[];
  mlFeatures: Array<{
    id: string;
    launchLabel: string;
    proofCommand: string;
  }>;
}

const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASEURL) ? import.meta.env.VITE_API_BASEURL : '/api';
const STORED_SECRET_SENTINEL = '(stored)';
const PROVIDER_OPTIONS = ['lmstudio', 'minimax', 'glm', 'openai', 'openrouter', 'ollama', 'kimi', 'moonshot', 'custom'];
const PROVIDER_PRESETS: Record<string, { baseUrl: string; model: string; evaluatorModel?: string }> = {
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  minimax: { baseUrl: 'https://api.minimax.io/anthropic', model: 'MiniMax-M2.7' },
  glm: { baseUrl: 'https://api.z.ai/api/anthropic', model: 'GLM-5v-turbo', evaluatorModel: 'GLM-5v-turbo' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4', evaluatorModel: 'gpt-4o' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-5.4-mini', evaluatorModel: 'google/gemini-2.5-flash' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
  kimi: { baseUrl: 'https://api.kimi.com/coding/v1', model: 'k2p5' },
  moonshot: { baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k2.5' },
  custom: { baseUrl: 'http://localhost:8000/v1', model: 'custom-model' },
};

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
  const bridge = useTuiBridgeSession();

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
  const [createMode, setCreateMode] = useState<CreateModeId>('auto');
  const [createExecutionMode, setCreateExecutionMode] = useState<WorkbenchExecutionMode>('draft');
  const [createTraits, setCreateTraits] = useState<CreateTraits>({ bpm: 120, palette: '' });
  const [clarificationAnswer, setClarificationAnswer] = useState<string>('');
  const [draftAdjustment, setDraftAdjustment] = useState<string>('');
  const [runStatus, setRunStatus] = useState<string>('');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [createRunError, setCreateRunError] = useState<string | null>(null);
  const [improveReport, setImproveReport] = useState<ImproveReport | null>(null);
  const [improveLoading, setImproveLoading] = useState<boolean>(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  // Live Music: generated code
  const [liveMusicPrompt, setLiveMusicPrompt] = useState<string>('ambient glitch');
  const [musicCode, setMusicCode] = useState<string>('');
  const [visualsCode, setVisualsCode] = useState<string>('');
  const [liveMusicLoading, setLiveMusicLoading] = useState<LiveMusicLoading>({ music: false, visuals: false });
  const hydraContainerRef = useRef<HTMLDivElement>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const micFramesRef = useRef<AudioSyncFrame[]>([]);
  const micStartPendingRef = useRef<boolean>(false);
  const micActiveRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micLastFrameAtRef = useRef<number>(0);
  const syncCanvasRef = useRef<HTMLCanvasElement>(null);
  const syncFrameRef = useRef<HTMLIFrameElement>(null);

  // Form state: effective + loop + creative + galleryPath; on save we build userConfig
  const [provider, setProvider] = useState<string>('lmstudio');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [model, setModel] = useState<string>('local-model');
  const [apiKey, setApiKey] = useState<string>('');
  const [evaluatorProvider, setEvaluatorProvider] = useState<string>('openrouter');
  const [evaluatorBaseUrl, setEvaluatorBaseUrl] = useState<string>('https://openrouter.ai/api/v1');
  const [evaluatorModel, setEvaluatorModel] = useState<string>('google/gemini-2.5-flash');
  const [evaluatorApiKey, setEvaluatorApiKey] = useState<string>('');
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
        setApiKey(data.effective?.apiKeyStored ? STORED_SECRET_SENTINEL : '');
        const evaluator = data.roles?.evaluator;
        setEvaluatorProvider(evaluator?.provider ?? 'openrouter');
        setEvaluatorBaseUrl(evaluator?.baseUrl ?? 'https://openrouter.ai/api/v1');
        setEvaluatorModel(evaluator?.model ?? 'google/gemini-2.5-flash');
        setEvaluatorApiKey(evaluator?.apiKeyStored ? STORED_SECRET_SENTINEL : '');
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

  useEffect(() => () => {
    stopMicCapture(false);
  }, []);

  function frameRms(values: Uint8Array): number {
    let sum = 0;
    for (const value of values) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / values.length);
  }

  function frameCentroid(values: Uint8Array): number {
    let total = 0;
    let weighted = 0;
    for (let index = 0; index < values.length; index++) {
      total += values[index];
      weighted += values[index] * index;
    }
    return total ? weighted / total / values.length : 0;
  }

  function drawSyncOverlay(rms: number, centroid: number, timestamp: number) {
    const canvas = syncCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * scale));
    const height = Math.max(1, Math.floor(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = 'screen';
    const viewWidth = rect.width;
    const viewHeight = rect.height;
    const hue = Math.round(190 + centroid * 170) % 360;
    const pulse = Math.max(0.03, Math.min(1, rms * 4));
    const t = timestamp / 1000;

    for (let index = 0; index < 5; index++) {
      const radius = 40 + index * 58 + pulse * 150 + Math.sin(t * 2 + index) * 16;
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${(hue + index * 24) % 360}, 95%, 68%, ${0.15 + pulse * 0.28})`;
      ctx.lineWidth = 1 + pulse * 8;
      ctx.ellipse(viewWidth / 2, viewHeight / 2, radius * 1.55, radius * 0.55, Math.sin(t + index) * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let index = 0; index < 42; index++) {
      const angle = index * 0.73 + t * (0.6 + pulse * 2.2);
      const radius = 36 + (index % 14) * 22 + pulse * 120;
      const x = viewWidth / 2 + Math.cos(angle) * radius;
      const y = viewHeight / 2 + Math.sin(angle * 1.7) * radius * 0.45;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${(hue + index * 11) % 360}, 100%, 72%, ${0.18 + pulse * 0.55})`;
      ctx.arc(x, y, 2 + pulse * 12, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  async function startMicCapture() {
    if (micStartPendingRef.current) return;
    if (micStatus === 'recording' || micActiveRef.current) {
      stopMicCapture(true);
      return;
    }
    setMicError(null);
    if (!hasSyncTarget) {
      setMicStatus('error');
      setMicError('Design an artifact first, then sync voice to it.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('error');
      setMicError('Browser microphone input is unavailable.');
      return;
    }
    micStartPendingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      micStreamRef.current = stream;
      micContextRef.current = audioContext;
      micAnalyserRef.current = analyser;
      micFramesRef.current = [];
      micLastFrameAtRef.current = 0;
      micActiveRef.current = true;
      setMicStatus('recording');
      setMessage('Syncing voice to the current stage object. Click Stop Sync to freeze it.');

      const timeData = new Uint8Array(analyser.fftSize);
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const tick = (timestamp: number) => {
        const currentAnalyser = micAnalyserRef.current;
        if (!currentAnalyser) return;
        if (timestamp - micLastFrameAtRef.current >= 33) {
          currentAnalyser.getByteTimeDomainData(timeData);
          currentAnalyser.getByteFrequencyData(frequencyData);
          const frame = {
            rms: frameRms(timeData),
            centroid: frameCentroid(frequencyData),
          };
          micFramesRef.current.push(frame);
          syncFrameRef.current?.contentWindow?.postMessage({
            type: 'liminal-audio-frame',
            frame,
          }, '*');
          drawSyncOverlay(frame.rms, frame.centroid, timestamp);
          micLastFrameAtRef.current = timestamp;
        }
        micRafRef.current = window.requestAnimationFrame(tick);
      };
      micRafRef.current = window.requestAnimationFrame(tick);
    } catch (err) {
      setMicStatus('error');
      setMicError(err instanceof Error ? err.message : 'Microphone permission failed.');
    } finally {
      micStartPendingRef.current = false;
    }
  }

  function stopMicCapture(commitPrompt = true) {
    micStartPendingRef.current = false;
    micActiveRef.current = false;
    if (micRafRef.current != null) window.cancelAnimationFrame(micRafRef.current);
    micRafRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    void micContextRef.current?.close?.();
    micContextRef.current = null;
    micAnalyserRef.current = null;

    if (!commitPrompt) return;
    const frames = micFramesRef.current;
    if (frames.length === 0) {
      setMicStatus('error');
      setMicError('No microphone frames were captured.');
      return;
    }
    const summary = summarizeAudioSync(frames);
    setMicStatus('ready');
    setMicError(null);
    setMessage(`Voice sync applied to current stage: ${summary.label}.`);
  }

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
    const currentMode = detectPromptCreateMode(prompt) ?? createMode;
    if (!usesOrganismApi(currentMode)) {
      await bridge.submitPrompt(buildWorkbenchPrompt(currentMode, prompt), {
        clientIntent: 'creative',
        ...buildWorkbenchRunOptions(createExecutionMode, createMaxIterations),
      });
      return;
    }
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
          mode: 'organism',
          traits: createTraits,
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
        roles: {
          generator: {
            provider: providerName,
            baseUrl: baseUrl || undefined,
            model: model || undefined,
            apiKey: apiKey || undefined,
          },
          evaluator: {
            provider: evaluatorProvider || undefined,
            baseUrl: evaluatorBaseUrl || undefined,
            model: evaluatorModel || undefined,
            apiKey: evaluatorApiKey || undefined,
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

  const chooseProvider = (nextProvider: string) => {
    setProvider(nextProvider);
    const preset = PROVIDER_PRESETS[nextProvider];
    if (!preset) return;
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
  };

  const chooseEvaluatorProvider = (nextProvider: string) => {
    setEvaluatorProvider(nextProvider);
    const preset = PROVIDER_PRESETS[nextProvider];
    if (!preset) return;
    setEvaluatorBaseUrl(preset.baseUrl);
    setEvaluatorModel(preset.evaluatorModel || preset.model);
  };

  const scanImproveOpportunities = async () => {
    setImproveLoading(true);
    setImproveError(null);
    try {
      const res = await fetch(`${API}/improve/scan`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setImproveReport(data);
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : String(err));
    } finally {
      setImproveLoading(false);
    }
  };

  const activeMode = getWorkbenchMode(activeTab);
  const liveGenerator = bridge.session?.roles?.generator;
  const liveEvaluator = bridge.session?.roles?.evaluator;
  const providerLabel = liveGenerator
    ? `${liveGenerator.provider || 'unknown'} / ${liveGenerator.model || 'unknown'}`
    : `${provider || 'unknown'} / ${model || 'unknown'}`;
  const evaluatorLabel = liveEvaluator
    ? `${liveEvaluator.provider || 'unknown'} / ${liveEvaluator.model || 'unknown'}`
    : `${evaluatorProvider || 'unknown'} / ${evaluatorModel || 'unknown'}`;
  const runNeedsBridgeSession = activeMode.id === 'generate' && requiresBridgeSession(createMode);
  const runLabel = runNeedsBridgeSession && !bridge.session
    ? 'Connecting'
    : activeMode.id === 'improve'
      ? improveLoading ? 'Scanning' : 'Scan'
    : bridge.submitting || runStatus === 'running'
      ? createExecutionMode === 'draft' ? 'Drafting' : 'Proving'
      : createExecutionMode === 'draft' ? 'Draft' : 'Prove';
  const bridgeSummary = bridge.summary;
  const bridgePreview = bridge.preview;
  const bridgeCodePreview = bridge.codePreview;
  const clarificationRequest = activeMode.id === 'generate' ? latestClarificationRequest(bridge.events) : null;
  const syncPreviewHtml = bridgeCodePreview?.code ? buildSyncPreviewHtml(bridgeCodePreview.code) : '';
  const hasDirectSyncTarget = Boolean(syncPreviewHtml);
  const hasSyncTarget = Boolean(previewUrl || bridgePreview || hasDirectSyncTarget);
  const promptCreateMode = detectPromptCreateMode(createPrompt);
  const effectiveCreateMode = promptCreateMode ?? createMode;
  const createModeOption = getCreateModeOption(effectiveCreateMode);
  const selectedCreateModeOption = getCreateModeOption(createMode);
  const promptOverridesMode = Boolean(promptCreateMode && promptCreateMode !== createMode);
  const draftReady = activeMode.id === 'generate' && !bridgeSummary.active && bridgeSummary.processSteps.some((step) => step.id === 'ready' && step.status === 'done');

  const handleWorkbenchRun = () => {
    if (activeMode.id === 'improve') {
      void scanImproveOpportunities();
      return;
    }
    if (activeMode.id === 'generate') {
      if (usesOrganismApi(effectiveCreateMode)) {
        void handleCreateRun();
        return;
      }
      void bridge.submitPrompt(buildWorkbenchPrompt(effectiveCreateMode, createPrompt), {
        clientIntent: 'creative',
        ...buildWorkbenchRunOptions(createExecutionMode, createMaxIterations),
      });
      return;
    }
    void handleCreateRun();
  };

  const handleClarificationSubmit = () => {
    const answer = clarificationAnswer.trim();
    if (!answer) return;
    const prompt = createPrompt.trim();
    const clarifiedPrompt = prompt ? `${prompt}\n\nClarification answer: ${answer}` : answer;
    setCreatePrompt(clarifiedPrompt);
    setClarificationAnswer('');
    const clarifiedMode = detectPromptCreateMode(clarifiedPrompt) ?? createMode;
    void bridge.submitPrompt(buildWorkbenchPrompt(clarifiedMode, clarifiedPrompt), {
      clientIntent: 'creative',
      ...buildWorkbenchRunOptions(createExecutionMode, createMaxIterations),
    });
  };

  const submitDraftFollowup = (instruction: string, executionMode: WorkbenchExecutionMode) => {
    const basePrompt = createPrompt.trim() || 'Continue the current draft.';
    const codeContext = bridgeCodePreview?.code
      ? `\n\nCurrent draft code excerpt:\n${bridgeCodePreview.code.slice(0, 5000)}`
      : '';
    const followupPrompt = `${basePrompt}\n\n${instruction}${codeContext}`;
    const followupMode = detectPromptCreateMode(followupPrompt) ?? createMode;
    setCreatePrompt(followupPrompt);
    setCreateExecutionMode(executionMode);
    setDraftAdjustment('');
    void bridge.submitPrompt(buildWorkbenchPrompt(followupMode, followupPrompt), {
      clientIntent: 'creative',
      ...buildWorkbenchRunOptions(executionMode, createMaxIterations),
    });
  };

  const handleDraftAdjustment = () => {
    const adjustment = draftAdjustment.trim();
    if (!adjustment) return;
    submitDraftFollowup(`Adjust the current draft: ${adjustment}`, 'draft');
  };

  const handleWorkbenchModeChange = (mode: WorkbenchMode) => {
    dispatchLive(switchToLiveOrganismView(mode.legacyTabs[0] as GuiTab));
  };

  const improveSlot = (
    <div className="liminal-improve-lane">
      <div className="liminal-improve-lane__header">
        <span>{improveReport?.runType || 'improve'}</span>
        <strong>{improveLoading ? 'Scanning system' : `${improveReport?.proposals.length ?? 0} proposals`}</strong>
        <small>{improveError || improveReport?.summary || 'Green systems can still improve.'}</small>
      </div>
      <div className="liminal-improve-proposals">
        {improveError && <div className="atelier-alert atelier-alert--error">{improveError}</div>}
        {!improveError && !improveReport && !improveLoading && (
          <button type="button" className="atelier-btn atelier-btn--primary" onClick={() => void scanImproveOpportunities()}>
            Scan opportunities
          </button>
        )}
        {improveReport?.proposals.map((proposal) => (
          <article className="liminal-improve-proposal" key={proposal.id}>
            <div>
              <span>{proposal.category}</span>
              <strong>{proposal.title}</strong>
            </div>
            <b>{proposal.score}</b>
            <p>{proposal.measurableTarget}</p>
            <small>{proposal.expectedVerification.join(' && ')}</small>
          </article>
        ))}
      </div>
    </div>
  );

  const stageSlot = activeMode.id === 'improve' ? improveSlot : (
    <div className="liminal-stage-frame">
      {previewUrl ? (
        <iframe title="Live preview" src={previewUrl} sandbox="allow-scripts" />
      ) : syncPreviewHtml ? (
        <iframe
          ref={syncFrameRef}
          title="Syncable generated stage"
          srcDoc={syncPreviewHtml}
          sandbox="allow-scripts"
        />
      ) : bridgePreview?.type === 'image' && bridgePreview.src ? (
        <figure className="liminal-stage-preview">
          <img
            src={bridgePreview.src}
            alt="Generated preview"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
          <figcaption>{bridgePreview.label}</figcaption>
        </figure>
      ) : bridgePreview?.type === 'code' ? (
        <pre className="liminal-stage-code">{bridgePreview.code}</pre>
      ) : (
        <div className={bridgeSummary.active ? 'liminal-stage-empty liminal-stage-empty--active' : 'liminal-stage-empty'}>
          {bridgeSummary.active && <i className="liminal-stage-pulse" aria-hidden="true" />}
          <span>Stage</span>
          <strong>{bridgeSummary.active ? bridgeSummary.stageTitle : runStatus === 'running' ? 'Generating' : 'Ready'}</strong>
          <small>{bridgeSummary.active ? bridgeSummary.stageSubtitle : createModeOption.stageLabel}</small>
        </div>
      )}
      {(bridgeSummary.active || bridgeSummary.processSteps.some((step) => step.status === 'done')) && (
        <div className="liminal-stage-process" aria-label="Generation process">
          {bridgeSummary.processSteps.map((step) => (
            <div className={`liminal-stage-process__step liminal-stage-process__step--${step.status}`} key={step.id}>
              <span>{step.label}</span>
              <small>{step.detail}</small>
            </div>
          ))}
        </div>
      )}
      {hasSyncTarget && !hasDirectSyncTarget && <canvas ref={syncCanvasRef} className="liminal-sync-overlay" aria-hidden="true" />}
    </div>
  );

  const inspectorSlot = (
    <div className="liminal-inspector-grid">
      <div>
        <span>Generator</span>
        <strong>{providerLabel}</strong>
      </div>
      <div>
        <span>Evaluator</span>
        <strong>{evaluatorLabel}</strong>
        {liveEvaluator && <small>Vision: {liveEvaluator.multimodal}</small>}
      </div>
      <div>
        <span>Loop</span>
        <strong>{activeMode.id === 'improve' ? 'improve' : bridgeSummary.phase}</strong>
      </div>
      <div>
        <span>Quality Gate</span>
        <strong>{minQualityScore.toFixed(1)}</strong>
      </div>
      <div>
        <span>Iterations</span>
        <strong>{createMaxIterations}</strong>
      </div>
      {activeTab === 'create' && (
        <div className="liminal-control-panel">
          {bridge.error && <div className="atelier-alert atelier-alert--error">{bridge.error}</div>}
          {bridge.session?.pendingAction && (
            <button type="button" className="atelier-btn atelier-btn--primary" onClick={() => void bridge.confirmPending()}>
              Confirm: {bridge.session.pendingAction.title}
            </button>
          )}
          {bridgeSummary.active && (
            <button type="button" className="atelier-btn atelier-btn--secondary" onClick={() => void bridge.cancelCurrent()}>
              Stop
            </button>
          )}
          <label>
            <span>Execution</span>
            <select
              value={createExecutionMode}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCreateExecutionMode(event.target.value as WorkbenchExecutionMode)}
            >
              <option value="draft">Draft</option>
              <option value="prove">Prove</option>
            </select>
            <small>{createExecutionMode === 'draft' ? 'Fast first artifact with immediate preview.' : 'Runs scoring, repair, and proof telemetry.'}</small>
          </label>
          <label>
            <span>Max iterations</span>
            <input
              type="number"
              min={1}
              max={20}
              value={createMaxIterations}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCreateMaxIterations(Number(event.target.value))}
            />
          </label>
          <label>
            <span>Run mode</span>
            <select
              value={createMode}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setCreateMode(event.target.value as CreateModeId)}
            >
              {CREATE_MODE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <small>
              {promptOverridesMode
                ? `Prompt says ${createModeOption.label}; using it instead of ${selectedCreateModeOption.label}.`
                : `Default target: ${createModeOption.stageLabel}. Explicit prompt words override this.`}
            </small>
          </label>
          {usesOrganismApi(effectiveCreateMode) && (
            <div className="liminal-control-row">
              <label>
                <span>BPM</span>
                <input
                  type="number"
                  min={60}
                  max={240}
                  value={createTraits.bpm || 120}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCreateTraits((current) => ({ ...current, bpm: Number(event.target.value) }))}
                />
              </label>
              <label>
                <span>Palette</span>
                <input
                  type="text"
                  value={createTraits.palette || ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setCreateTraits((current) => ({ ...current, palette: event.target.value }))}
                />
              </label>
            </div>
          )}
        </div>
      )}
      <button type="button" className="atelier-btn atelier-btn--secondary" onClick={() => dispatchLive(switchToLiveOrganismView('config'))}>
        Settings
      </button>
    </div>
  );

  const timelineSlot = (
    <div>
      <div className="liminal-timeline-row">
        <span>{activeMode.id === 'improve' ? (improveLoading ? 'scanning' : improveReport?.runType || 'ready') : bridgeSummary.active ? bridgeSummary.timelineStatus : runStatus || 'idle'}</span>
        <strong>{activeMode.id === 'improve' ? `proposals ${improveReport?.proposals.length ?? 0}` : bridgeSummary.active ? bridgeSummary.timelinePrimary : runResult?.result ? `score ${runResult.result.finalScore?.toFixed(2)}` : activeMode.label}</strong>
        <small>{activeMode.id === 'improve' ? improveError || improveReport?.summary || 'No scan yet' : bridgeSummary.active ? bridgeSummary.timelineSecondary : createRunError || bridge.error || runError || selectedProject || 'No artifact selected'}</small>
      </div>
      {activeMode.id === 'generate' && (
        <div className="liminal-process-meter" aria-label={`Generation progress ${Math.round(bridgeSummary.progressPercent * 100)} percent`}>
          <div className="liminal-process-meter__track">
            <div className="liminal-process-meter__fill" style={{ width: `${Math.max(3, Math.round(bridgeSummary.progressPercent * 100))}%` }} />
          </div>
          <div className="liminal-process-rail">
            {bridgeSummary.processSteps.map((step) => (
              <div className={`liminal-process-step liminal-process-step--${step.status}`} key={step.id}>
                <span>{step.label}</span>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      {bridgeSummary.recentActivity.length > 0 && (
        <div className="liminal-timeline-events">
          {bridgeSummary.recentActivity.map((item, index) => (
            <div className={`liminal-timeline-event liminal-timeline-event--${item.status || 'info'}`} key={`${item.label}-${index}`}>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
      )}
      {activeMode.id === 'generate' && clarificationRequest && (
        <form
          className="liminal-clarification"
          onSubmit={(event) => {
            event.preventDefault();
            handleClarificationSubmit();
          }}
        >
          <div>
            <span>Answer needed</span>
            <strong>{clarificationRequest.question}</strong>
            <small>{clarificationRequest.reason}</small>
          </div>
          <input
            type="text"
            value={clarificationAnswer}
            onChange={(event) => setClarificationAnswer(event.target.value)}
            placeholder="Example: a glowing iceberg city with blue glass, slow drifting fog"
          />
          <button type="submit" disabled={bridge.submitting || !clarificationAnswer.trim()}>
            Answer and draft
          </button>
        </form>
      )}
      {activeMode.id === 'generate' && draftReady && !clarificationRequest && (
        <form
          className="liminal-draft-actions"
          onSubmit={(event) => {
            event.preventDefault();
            handleDraftAdjustment();
          }}
        >
          <div>
            <span>Draft ready</span>
            <strong>Adjust direction</strong>
            <small>{bridgePreview?.label || bridgeCodePreview?.label || 'first artifact mounted'}</small>
          </div>
          <input
            type="text"
            value={draftAdjustment}
            onChange={(event) => setDraftAdjustment(event.target.value)}
            placeholder="Make it darker, slower, bigger, stranger..."
          />
          <button type="submit" disabled={bridge.submitting || !draftAdjustment.trim()}>
            Revise draft
          </button>
          <button
            type="button"
            onClick={() => submitDraftFollowup('Make a fresh draft variation with a different composition while preserving the core idea.', 'draft')}
            disabled={bridge.submitting}
          >
            New draft
          </button>
          <button
            type="button"
            onClick={() => submitDraftFollowup('Polish and prove this direction with scoring, repair, and preview evidence.', 'prove')}
            disabled={bridge.submitting}
          >
            Prove
          </button>
        </form>
      )}
      {bridgeSummary.stageTimings.length > 0 && (
        <div className="liminal-timeline-events">
          {bridgeSummary.stageTimings.map((item) => (
            <div className="liminal-timeline-event liminal-timeline-event--ok" key={`${item.label}-${item.durationLabel}`}>
              <span>{item.label}</span>
              <small>{item.durationLabel}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const leftSlot = (
    <div className="liminal-rail-meta">
      {activeMode.id === 'improve' ? (
        <>
          <span>Proposals</span>
          <strong>{improveReport?.proposals.length ?? 0}</strong>
          <span>ML labels</span>
          <strong>{improveReport?.mlFeatures.length ?? 0}</strong>
        </>
      ) : (
        <>
      <span>Projects</span>
      <strong>{projects.length}</strong>
      <span>Artifacts</span>
      <strong>{iterations.length}</strong>
        </>
      )}
    </div>
  );

  const audioSlot = (
    <div className="liminal-audio-input">
      <button
        type="button"
        className={micStatus === 'recording' ? 'liminal-audio-button liminal-audio-button--recording' : 'liminal-audio-button'}
        disabled={!hasSyncTarget && micStatus !== 'recording'}
        onClick={() => void startMicCapture()}
      >
        {micStatus === 'recording' ? 'Stop Sync' : 'Sync'}
      </button>
      <small>{micError || (micStatus === 'recording' ? (hasDirectSyncTarget ? 'voice driving object' : 'voice driving overlay') : micStatus === 'ready' ? 'voice sync applied' : hasSyncTarget ? (hasDirectSyncTarget ? 'direct object sync' : 'overlay sync') : 'design first')}</small>
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--atelier-text-muted)', fontFamily: 'var(--font-body)' }}>
        Loading…
      </div>
    );
  }

  return (
    <WorkbenchShell
      activeMode={activeMode.id}
      activeTab={activeTab}
      modes={WORKBENCH_MODES}
      onModeChange={handleWorkbenchModeChange}
      onTabChange={(tab) => dispatchLive(switchToLiveOrganismView(tab as GuiTab))}
      prompt={createPrompt}
      onPromptChange={setCreatePrompt}
      onRun={handleWorkbenchRun}
      runDisabled={activeMode.id === 'improve' ? improveLoading : bridge.submitting || runStatus === 'running' || !createPrompt.trim() || (runNeedsBridgeSession && !bridge.session)}
      runLabel={bridge.submitting ? 'Sending' : bridge.session?.pendingAction ? 'Review' : runLabel}
      audioSlot={audioSlot}
      providerLabel={providerLabel}
      evaluatorLabel={evaluatorLabel}
      stageSlot={stageSlot}
      inspectorSlot={inspectorSlot}
      timelineSlot={timelineSlot}
      leftSlot={leftSlot}
    >
      {shouldRenderLegacyPanel(activeTab) && (
      <>
      {activeTab === 'config' && (
        <form id="atelier-config-form" onSubmit={(e: React.FormEvent) => e.preventDefault()} className="atelier-panel" style={{ maxWidth: 560 }} autoComplete="off">
          {error && (
            <div className="atelier-alert atelier-alert--error" style={{ marginBottom: 12 }}>{error}</div>
          )}
          {message && (
            <div className="atelier-alert atelier-alert--success" style={{ marginBottom: 12 }}>{message}</div>
          )}

          <section style={{ marginBottom: 24 }}>
            <h2 className="atelier-heading">Generator</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span className="atelier-label">Provider</span>
            <select
              value={provider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => chooseProvider(e.target.value)}
              className="atelier-select"
            >
              {PROVIDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
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
        <h2 className="atelier-heading">Evaluator</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label>
            <span className="atelier-label">Provider</span>
            <select
              value={evaluatorProvider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => chooseEvaluatorProvider(e.target.value)}
              className="atelier-select"
            >
              {PROVIDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span className="atelier-label">Base URL</span>
            <input
              type="url"
              value={evaluatorBaseUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEvaluatorBaseUrl(e.target.value)}
              placeholder="https://…"
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">Model</span>
            <input
              type="text"
              value={evaluatorModel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEvaluatorModel(e.target.value)}
              className="atelier-input"
            />
          </label>
          <label>
            <span className="atelier-label">API key (masked)</span>
            <input
              type="password"
              form="atelier-config-form"
              value={evaluatorApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEvaluatorApiKey(e.target.value)}
              placeholder="••••••••"
              autoComplete="off"
              className="atelier-input"
            />
          </label>
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
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateMode(e.target.value as CreateModeId)}
              className="atelier-select"
              style={{ width: 'auto', minWidth: 200 }}
            >
              {CREATE_MODE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <small className="atelier-help" style={{ display: 'block', marginTop: 4 }}>
              {promptOverridesMode
                ? `Prompt says ${createModeOption.label}; using it instead of ${selectedCreateModeOption.label}.`
                : `Default target: ${createModeOption.stageLabel}. Explicit prompt words override this.`}
            </small>
          </label>
          {usesOrganismApi(effectiveCreateMode) && (
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
            {runStatus === 'running' ? (createExecutionMode === 'draft' ? 'Drafting…' : 'Proving…') : (createExecutionMode === 'draft' ? 'Draft' : 'Prove')}
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
      </>
      )}
    </WorkbenchShell>
  );
}
