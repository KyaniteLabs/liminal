import React, { Suspense, useState, useEffect, useReducer, useRef } from 'react';
import {
  liveOrganismReducer,
  INITIAL_LIVE_ORGANISM_STATE,
  switchToLiveOrganismView,
  setPreviewRunResult,
  type GuiTab,
} from './gui/liveOrganismState';
import { WorkbenchShell } from './components/WorkbenchShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEventStream } from './components/activity/hooks';
import {
  buildWorkbenchRunOptionsForMode,
  buildWorkbenchPrompt,
  CREATE_MODE_OPTIONS,
  detectPromptCreateMode,
  getCreateModeOption,
  requiresBridgeSession,
  usesOrganismApi,
  type CreateModeId,
  type WorkbenchExecutionMode,
} from './gui/createModes';
import { analyzeSingFrame, summarizeAudioSing, freqToNote, type AudioSingFrame } from './gui/audioSing';
import { buildSingPreviewHtml, buildDefaultSingPreviewHtml } from './gui/singPreview';
import { formatMicCaptureError } from '../../src/shared/micPermission';
import { getWorkbenchMode, shouldRenderLegacyPanel, WORKBENCH_MODES, type WorkbenchMode } from './gui/workbenchState';
import { latestClarificationRequest, latestCognitiveReceipt, latestRunReceipt } from './gui/workbenchTelemetry';
import { useTuiBridgeSession } from './gui/useTuiBridgeSession';

const CuratorMode = React.lazy(() => import('./components/CuratorMode').then((module) => ({ default: module.CuratorMode })));
const ActivityDashboard = React.lazy(() => import('./components/ActivityDashboard').then((module) => ({ default: module.ActivityDashboard })));
const CompostVisualizer = React.lazy(() => import('./components/CompostVisualizer').then((module) => ({ default: module.CompostVisualizer })));
const OperatorCockpit = React.lazy(() => import('./components/OperatorCockpit').then((module) => ({ default: module.OperatorCockpit })));

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
const SENSOR_PERMISSION_POLICY = "accelerometer 'none'; gyroscope 'none'; magnetometer 'none'";
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
  const [previewStuck, setPreviewStuck] = useState(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [failedPreviewSrc, setFailedPreviewSrc] = useState<string | null>(null);
  const [improveReport, setImproveReport] = useState<ImproveReport | null>(null);
  const [improveLoading, setImproveLoading] = useState<boolean>(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  // Live AV: generated code
  const [liveMusicPrompt, setLiveMusicPrompt] = useState<string>('ambient glitch');
  const [musicCode, setMusicCode] = useState<string>('');
  const [visualsCode, setVisualsCode] = useState<string>('');
  const [liveMusicLoading, setLiveMusicLoading] = useState<LiveMusicLoading>({ music: false, visuals: false });
  const hydraContainerRef = useRef<HTMLDivElement>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [micError, setMicError] = useState<string | null>(null);
  const MIC_MAX_FRAMES = 1800; // ~30s at 60fps
  const micFramesRef = useRef<AudioSingFrame[]>([]);
  const micStartPendingRef = useRef<boolean>(false);
  const micActiveRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micWorkletRef = useRef<AudioWorkletNode | null>(null);
  const micWorkletFrameRef = useRef<{ rms: number; onset: boolean; pitch: number; confidence: number; voiced: boolean } | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micFallbackIntervalRef = useRef<number | null>(null);
  const micLastFrameAtRef = useRef<number>(0);
  const singFrameRef = useRef<HTMLIFrameElement>(null);

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

  // Preview watchdog: detect stuck iframes (infinite loops in generated code)
  useEffect(() => {
    if (!previewUrl) { setPreviewStuck(false); return; }
    setPreviewStuck(false);
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'liminal-preview-ready') {
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
        window.removeEventListener('message', onMessage);
      }
    };
    window.addEventListener('message', onMessage);
    previewTimeoutRef.current = setTimeout(() => {
      setPreviewStuck(true);
      window.removeEventListener('message', onMessage);
    }, 10_000);
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      window.removeEventListener('message', onMessage);
    };
  }, [previewUrl]);

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

  function sendSingFrame(frame: AudioSingFrame) {
    const target = singFrameRef.current?.contentWindow;
    if (target) {
      const origin = singFrameRef.current.src
        ? new URL(singFrameRef.current.src, window.location.href).origin
        : window.location.origin;
      target.postMessage({ type: 'liminal-audio-frame', frame }, origin);
    }
  }

  async function startMicCapture() {
    if (micStartPendingRef.current) return;
    if (micStatus === 'recording' || micActiveRef.current) {
      stopMicCapture(true);
      return;
    }
    setMicError(null);
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
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      micStreamRef.current = stream;
      micContextRef.current = audioContext;
      micAnalyserRef.current = analyser;
      micFramesRef.current = [];
      micLastFrameAtRef.current = 0;
      micActiveRef.current = true;
      setMicStatus('recording');
      setMessage('Sing into the microphone and watch the visuals respond to your voice. Click Stop to freeze.');

      const frequencyData = new Uint8Array(analyser.frequencyBinCount);
      const sampleRate = audioContext.sampleRate;
      let prevRms = 0;

      // Compute spectral centroid from the latest AnalyserNode FFT data
      function computeCentroid(): number {
        const currentAnalyser = micAnalyserRef.current;
        if (!currentAnalyser) return 0;
        currentAnalyser.getByteFrequencyData(frequencyData);
        let total = 0;
        let weighted = 0;
        for (let i = 0; i < frequencyData.length; i++) {
          total += frequencyData[i];
          weighted += frequencyData[i] * i;
        }
        return total ? weighted / total / frequencyData.length : 0;
      }

      // Forward a complete audio frame to the iframe immediately
      function forwardFrame(partial: { rms: number; onset: boolean; pitch: number; confidence: number; voiced: boolean }) {
        const now = performance.now();
        const frame: AudioSingFrame = {
          rms: partial.rms,
          centroid: computeCentroid(),
          pitch: partial.pitch,
          note: partial.voiced ? freqToNote(partial.pitch) : '',
          onset: partial.onset,
          voiced: partial.voiced,
          confidence: partial.confidence,
          capturedAt: now,
        };
        micFramesRef.current.push(frame);
        if (micFramesRef.current.length > MIC_MAX_FRAMES) {
          micFramesRef.current = micFramesRef.current.slice(-MIC_MAX_FRAMES);
        }
        sendSingFrame(frame);
        micLastFrameAtRef.current = now;
      }

      // Try AudioWorklet for low-latency time-domain analysis
      let workletLoaded = false;
      try {
        await audioContext.audioWorklet.addModule('/audio-sing-worklet.js');
        const workletNode = new AudioWorkletNode(audioContext, 'audio-sing-processor');
        source.connect(workletNode);
        workletNode.port.onmessage = (event) => {
          if (!micActiveRef.current) return;
          forwardFrame(event.data);
        };
        micWorkletRef.current = workletNode;
        workletLoaded = true;
      } catch (workletErr) {
        console.warn('AudioWorklet not available, falling back to AnalyserNode-only:', workletErr);
      }

      // Fallback: AnalyserNode-only at ~120fps (8ms) — faster than rAF
      if (!workletLoaded) {
        micFallbackIntervalRef.current = window.setInterval(() => {
          if (!micActiveRef.current || !micAnalyserRef.current) return;
          const currentAnalyser = micAnalyserRef.current;
          const timeData = new Uint8Array(currentAnalyser.fftSize);
          currentAnalyser.getByteTimeDomainData(timeData);
          currentAnalyser.getByteFrequencyData(frequencyData);
          const frame = analyzeSingFrame(timeData, frequencyData, sampleRate, prevRms);
          prevRms = frame.rms;
          micFramesRef.current.push(frame);
          if (micFramesRef.current.length > MIC_MAX_FRAMES) {
            micFramesRef.current = micFramesRef.current.slice(-MIC_MAX_FRAMES);
          }
          sendSingFrame(frame);
          micLastFrameAtRef.current = performance.now();
        }, 8);
      }
    } catch (err) {
      setMicStatus('error');
      setMicError(formatMicCaptureError(err, 'try Sing again'));
    } finally {
      micStartPendingRef.current = false;
    }
  }

  function voiceSummaryToPrompt(summary: ReturnType<typeof summarizeAudioSing>): string {
    const parts: string[] = ['Create voice-reactive generative visuals.'];

    if (summary.avgPitch > 0) {
      const note = freqToNote(summary.avgPitch);
      parts.push(`The voice centered around ${note} (${Math.round(summary.avgPitch)} Hz).`);
    }

    if (summary.peakRms > 0.22) parts.push('The voice was powerful and intense — use bold, dramatic motion.');
    else if (summary.peakRms > 0.09) parts.push('The voice was expressive and dynamic — use flowing, organic movement.');
    else parts.push('The voice was soft and gentle — use subtle, delicate animations.');

    if (summary.avgCentroid > 0.5) parts.push('The tone was bright — lean into warm golds, oranges, and high-energy colors.');
    else if (summary.avgCentroid > 0.2) parts.push('The tone was balanced — use a rich, varied color palette.');
    else parts.push('The tone was deep — use cool blues, purples, and deep hues.');

    parts.push(`Duration of vocal input: ${summary.durationSeconds.toFixed(1)} seconds.`);
    parts.push('Use window.__liminalAudio inside the animation loop. Map rms to scale and density. Map centroid to color and speed. The result should feel synesthetic — seeing sound.');

    return parts.join(' ');
  }

  function stopMicCapture(commitPrompt = true) {
    micStartPendingRef.current = false;
    micActiveRef.current = false;
    if (micRafRef.current != null) window.cancelAnimationFrame(micRafRef.current);
    micRafRef.current = null;
    if (micFallbackIntervalRef.current != null) window.clearInterval(micFallbackIntervalRef.current);
    micFallbackIntervalRef.current = null;
    micWorkletRef.current?.port.close();
    micWorkletRef.current?.disconnect();
    micWorkletRef.current = null;
    micWorkletFrameRef.current = null;
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
    const summary = summarizeAudioSing(frames);
    setMicStatus('ready');
    setMicError(null);
    setMessage(`Voice captured: ${summary.label}. Generating visuals from your voice...`);

    if (!hasDirectSingTarget) {
      const voicePrompt = voiceSummaryToPrompt(summary);
      setCreateMode('sing');
      setCreatePrompt(voicePrompt);
      const singHint = getCreateModeOption('sing').promptHint;
      void bridge.submitPrompt(`${singHint}\n\nUser prompt: ${voicePrompt}`, {
        clientIntent: 'creative',
        ...buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, 'sing', timeoutMinutes),
      });
    }
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
        setMergeApiError(res.status === 404 ? 'Backend not running? Start with: pnpm gui' : (data.error || 'Merge failed'));
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
        setMergeApiError(res.status === 404 ? 'Backend not running? Start with: pnpm gui' : (data.error || 'Mutate failed'));
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
        ...buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, currentMode, timeoutMinutes),
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
          ...(config?.roles?.harness ? {
            harness: {
              provider: config.roles.harness.provider,
              baseUrl: config.roles.harness.baseUrl,
              model: config.roles.harness.model,
              apiKey: config.roles.harness.apiKeyStored ? STORED_SECRET_SENTINEL : undefined,
            },
          } : {}),
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
  const liveHarness = bridge.session?.roles?.harness;
  const liveEvaluator = bridge.session?.roles?.evaluator;
  const providerLabel = liveGenerator
    ? `${liveGenerator.provider || 'unknown'} / ${liveGenerator.model || 'unknown'}`
    : `${provider || 'unknown'} / ${model || 'unknown'}`;
  const evaluatorLabel = liveEvaluator
    ? `${liveEvaluator.provider || 'unknown'} / ${liveEvaluator.model || 'unknown'}`
    : `${evaluatorProvider || 'unknown'} / ${evaluatorModel || 'unknown'}`;
  const inspectorLabel = liveHarness
    ? `${liveHarness.provider || 'unknown'} / ${liveHarness.model || 'unknown'}`
    : `${config?.roles?.harness?.provider || provider || 'unknown'} / ${config?.roles?.harness?.model || model || 'unknown'}`;
  const runNeedsBridgeSession = activeMode.id === 'generate' && requiresBridgeSession(createMode);
  const runLabel = runNeedsBridgeSession && !bridge.session
    ? 'Connecting'
    : activeMode.id === 'improve'
      ? improveLoading ? 'Scanning' : 'Scan'
    : bridge.submitting || runStatus === 'running'
      ? createExecutionMode === 'draft' ? 'Generating' : 'Polishing'
      : createExecutionMode === 'draft' ? 'Generate' : 'Polish';
  const bridgeSummary = bridge.summary;
  const bridgePreview = bridge.preview;
  const bridgeImagePreview = bridgePreview?.type === 'image' && bridgePreview.src ? bridgePreview : null;
  const bridgeImagePreviewFailed = Boolean(bridgeImagePreview && failedPreviewSrc === bridgeImagePreview.src);
  const bridgeCodePreview = bridge.codePreview;
  const runReceipt = activeMode.id === 'generate' ? latestRunReceipt(bridge.events, bridge.session) : null;
  const runFailedBeforePreview = activeMode.id === 'generate' && runReceipt?.outcome === 'failed' && !bridgeSummary.active;
  const runStoppedBeforePreview = activeMode.id === 'generate' && runReceipt?.outcome === 'stopped' && !bridgeSummary.active;
  const stageBlocked = bridgeSummary.phase === 'preview missing' || bridgeSummary.phase === 'disconnected' || runFailedBeforePreview || runStoppedBeforePreview;
  const stageEmptyKicker = stageBlocked ? 'Preview' : bridgeSummary.active ? 'Working' : 'Preview';
  const stageEmptyHeading = stageBlocked
    ? runStoppedBeforePreview ? 'Generation stopped' : runFailedBeforePreview ? 'No preview was produced' : 'Preview unavailable'
    : bridgeSummary.active
      ? bridgeSummary.stageTitle
      : runStatus === 'running'
        ? 'Generating'
        : 'No artifact yet';
  const stageEmptyDetail = stageBlocked
    ? runStoppedBeforePreview ? 'Generation stopped by operator. Edit the prompt, try again, or switch medium when ready.' : runFailedBeforePreview ? 'The run stopped before an artifact could be mounted. Use a recovery action or edit the prompt.' : bridgeSummary.stageSubtitle
    : bridgeSummary.active
      ? bridgeSummary.stageSubtitle
      : 'Type a prompt below or click a suggestion to get started.';
  const clarificationRequest = activeMode.id === 'generate' ? latestClarificationRequest(bridge.events) : null;
  const cognitiveReceipt = activeMode.id === 'generate' ? latestCognitiveReceipt(bridge.events) : null;
  const singPreviewHtml = bridgeCodePreview?.code ? buildSingPreviewHtml(bridgeCodePreview.code) : '';
  const defaultSingPreview = micStatus === 'recording' && !singPreviewHtml ? buildDefaultSingPreviewHtml() : '';
  const activeSingPreview = singPreviewHtml || defaultSingPreview;
  const hasDirectSingTarget = Boolean(singPreviewHtml);
  const hasSingTarget = Boolean(previewUrl || bridgePreview || hasDirectSingTarget);
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
        ...buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, effectiveCreateMode, timeoutMinutes),
      });
      return;
    }
    void handleCreateRun();
  };

  const handleWorkbenchRunPrompt = (promptText: string) => {
    setCreatePrompt(promptText);
    if (activeMode.id === 'generate') {
      const mode = detectPromptCreateMode(promptText) ?? createMode;
      void bridge.submitPrompt(buildWorkbenchPrompt(mode, promptText), {
        clientIntent: 'creative',
        ...buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, mode, timeoutMinutes),
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
      ...buildWorkbenchRunOptionsForMode(createExecutionMode, createMaxIterations, clarifiedMode, timeoutMinutes),
    });
  };

  const submitDraftFollowup = (instruction: string, executionMode: WorkbenchExecutionMode, revisionKind: 'revise' | 'variation' | 'polish' = 'revise') => {
    const basePrompt = createPrompt.trim() || 'Continue the current artifact.';
    const codeContext = bridgeCodePreview?.code
      ? `\n\nCurrent artifact code excerpt:\n${bridgeCodePreview.code.slice(0, 5000)}`
      : '';
    const followupPrompt = `${basePrompt}\n\n${instruction}${codeContext}`;
    const followupMode = detectPromptCreateMode(followupPrompt) ?? createMode;
    setCreatePrompt(followupPrompt);
    setCreateExecutionMode(executionMode);
    setDraftAdjustment('');
    void bridge.submitPrompt(buildWorkbenchPrompt(followupMode, followupPrompt), {
      clientIntent: 'creative',
      ...buildWorkbenchRunOptionsForMode(executionMode, createMaxIterations, followupMode, timeoutMinutes),
      creativePreferences: runReceipt ? { priorRunReceipt: runReceipt, revisionKind } : undefined,
    });
  };

  const failureRecoveryText = runReceipt?.failure?.message || 'The last generation stopped before a usable artifact appeared.';

  const handleRetryFailedRun = () => {
    const prompt = createPrompt.trim();
    if (!prompt) return;
    const retryMode = detectPromptCreateMode(prompt) ?? createMode;
    setCreateExecutionMode('draft');
    void bridge.submitPrompt(buildWorkbenchPrompt(retryMode, prompt), {
      clientIntent: 'creative',
      ...buildWorkbenchRunOptionsForMode('draft', createMaxIterations, retryMode, timeoutMinutes),
    });
  };

  const handleSafePolishFailedRun = () => {
    submitDraftFollowup(
      `Recover from the failed run and produce a complete, browser-safe artifact. Avoid undefined helper functions, incomplete wrappers, or placeholder code. Previous failure: ${failureRecoveryText}`,
      'prove',
      'polish',
    );
  };

  const handleSwitchMediumAfterFailure = () => {
    const baseIdea = (createPrompt.trim() || 'Create the same visual idea.')
      .replace(/\bglsl\s+fragment\s+shader\b/gi, 'browser visual')
      .replace(/\bfragment\s+shader\b/gi, 'browser visual')
      .replace(/\bglsl\s+shader\b/gi, 'browser visual')
      .replace(/\bglsl\b/gi, 'browser visual')
      .replace(/\bshader\b/gi, 'visual')
      .replace(/\bbrowser visual(?:\s+browser visual)+\b/gi, 'browser visual')
      .replace(/\bvisual(?:\s+visual)+\b/gi, 'visual')
      .replace(/\s+/g, ' ')
      .trim();
    const fallbackPrompt = `Create a p5.js sketch that preserves this idea: ${baseIdea}\n\nUse p5.js for a reliable browser preview, keep the motion and mood, and use only p5 browser APIs.`;
    const fallbackMode: CreateModeId = 'p5';
    setCreatePrompt(fallbackPrompt);
    setCreateMode(fallbackMode);
    setCreateExecutionMode('draft');
    void bridge.submitPrompt(buildWorkbenchPrompt(fallbackMode, fallbackPrompt), {
      clientIntent: 'creative',
      ...buildWorkbenchRunOptionsForMode('draft', createMaxIterations, fallbackMode, timeoutMinutes),
    });
  };

  const handleDraftAdjustment = () => {
    const adjustment = draftAdjustment.trim();
    if (!adjustment) return;
    submitDraftFollowup(`Adjust the current artifact: ${adjustment}`, 'draft', 'revise');
  };

  const handleWorkbenchModeChange = (mode: WorkbenchMode) => {
    dispatchLive(switchToLiveOrganismView(mode.legacyTabs[0] as GuiTab));
  };

  const runRecourseSlot = activeMode.id === 'generate' && (runFailedBeforePreview || runStoppedBeforePreview) ? (
    <section className="liminal-recourse-card" role="alert" aria-label={runReceipt?.outcome === 'stopped' ? 'Generation stopped' : 'Generation recovery'}>
      <div className="liminal-recourse-card__copy">
        <span>{runReceipt?.outcome === 'stopped' ? 'Stopped' : 'Needs recovery'}</span>
        <strong>{runReceipt?.outcome === 'stopped' ? 'Generation stopped' : 'That run did not finish.'}</strong>
        <small>{runReceipt?.outcome === 'stopped' ? 'Generation stopped by operator.' : runReceipt?.failure?.message || failureRecoveryText}</small>
        <small>Medium: {runReceipt.creativeDomain} · Model: {runReceipt.providerModel}</small>
      </div>
      <div className="liminal-recourse-card__actions" aria-label={runReceipt?.outcome === 'stopped' ? 'Stopped run actions' : 'Recovery actions'}>
        <button type="button" onClick={handleRetryFailedRun} disabled={bridge.submitting || !createPrompt.trim()}>
          Try again
        </button>
        {runReceipt?.outcome !== 'stopped' && (
          <button type="button" onClick={handleSafePolishFailedRun} disabled={bridge.submitting}>
            Polish safely
          </button>
        )}
        <button type="button" onClick={handleSwitchMediumAfterFailure} disabled={bridge.submitting}>
          Switch medium
        </button>
      </div>
    </section>
  ) : null;

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
    <ErrorBoundary name="Stage">
    <div className="liminal-stage-frame">
      {previewStuck && (
        <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.85)', color: '#ff6b6b', textAlign: 'center', padding: '2rem' }}>
          <div>
            <strong style={{ fontSize: 16 }}>Preview may be stuck</strong>
            <p style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>The generated script didn't respond within 10 seconds. It may contain an infinite loop.</p>
            <button type="button" className="atelier-btn atelier-btn--secondary" style={{ marginTop: 12 }} onClick={() => setPreviewStuck(false)}>Dismiss</button>
          </div>
        </div>
      )}
      {previewUrl ? (
        <iframe title="Live preview" src={previewUrl} allow={SENSOR_PERMISSION_POLICY} sandbox="allow-scripts" />
      ) : activeSingPreview ? (
        <iframe
          ref={singFrameRef}
          title="Voice-reactive stage"
          srcDoc={activeSingPreview}
          allow={SENSOR_PERMISSION_POLICY}
          sandbox="allow-scripts"
        />
      ) : bridgeImagePreview ? (
        <figure className={bridgeImagePreviewFailed ? 'liminal-stage-preview liminal-stage-preview--failed' : 'liminal-stage-preview'}>
          {bridgeImagePreviewFailed ? (
            <div className="liminal-stage-preview-error" role="alert">
              <span>Preview</span>
              <strong>Image preview failed to load</strong>
              <small>{bridgeImagePreview.label}</small>
              <button type="button" className="atelier-btn atelier-btn--secondary" onClick={() => setFailedPreviewSrc(null)}>
                Retry preview
              </button>
            </div>
          ) : (
            <img
              src={bridgeImagePreview.src}
              alt="Generated preview"
              onLoad={() => {
                if (failedPreviewSrc === bridgeImagePreview.src) setFailedPreviewSrc(null);
              }}
              onError={() => setFailedPreviewSrc(bridgeImagePreview.src ?? null)}
            />
          )}
          <figcaption>{bridgeImagePreview.label}</figcaption>
        </figure>
      ) : (bridgePreview?.type === 'html' || bridgePreview?.type === 'music') && bridgePreview.content ? (
        <figure className={`liminal-stage-embed liminal-stage-embed--${bridgePreview.type}`}>
          <iframe
            title={bridgePreview.type === 'music' ? 'Inline music preview' : 'Inline HTML preview'}
            srcDoc={bridgePreview.content}
            allow={SENSOR_PERMISSION_POLICY}
            sandbox="allow-scripts"
          />
          <figcaption>{bridgePreview.label}</figcaption>
        </figure>
      ) : bridgePreview?.type === 'code' ? (
        <pre className="liminal-stage-code">{bridgePreview.code}</pre>
      ) : (
        <div className={stageBlocked ? 'liminal-stage-empty liminal-stage-empty--blocked' : bridgeSummary.active ? 'liminal-stage-empty liminal-stage-empty--active' : 'liminal-stage-empty'}>
          {bridgeSummary.active && <i className="liminal-stage-pulse" aria-hidden="true" />}
          <span>{stageEmptyKicker}</span>
          <strong>{stageEmptyHeading}</strong>
          <small>{stageEmptyDetail}</small>
          {bridgeSummary.liveRun && (
            <div
              className={bridgeSummary.liveRun.showSlowNotice ? 'liminal-live-run liminal-live-run--slow' : 'liminal-live-run'}
              aria-label="Live generation status"
            >
              <span>{bridgeSummary.liveRun.statusLabel}</span>
              <strong>{bridgeSummary.liveRun.elapsedLabel} elapsed</strong>
              <small>{bridgeSummary.liveRun.detail}</small>
              <small>{bridgeSummary.liveRun.attemptLabel} · {bridgeSummary.liveRun.timeoutLabel} · {bridgeSummary.liveRun.etaLabel}</small>
              <button type="button" className="liminal-live-run__stop" onClick={() => void bridge.cancelCurrent()}>
                Stop
              </button>
              <em>{bridgeSummary.liveRun.reassurance}</em>
            </div>
          )}
        </div>
      )}

    </div>
    </ErrorBoundary>
  );

  const inspectorSlot = (
    <ErrorBoundary name="Inspector">
    <div className="liminal-inspector-grid">
      <div>
        <span>Generator</span>
        <strong>{providerLabel}</strong>
      </div>
      <div>
        <span>Harness</span>
        <strong>{inspectorLabel}</strong>
        {liveHarness && <small>{liveHarness.purpose}</small>}
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
      {runReceipt && (
        <div className="liminal-run-receipt">
          <span>{runReceipt.heading}</span>
          <strong>{runReceipt.creativeDomain} · {runReceipt.phase}</strong>
          <small>Provider/model: {runReceipt.providerModel}</small>
          {runReceipt.artifact && <small>Artifact: {runReceipt.artifact.label}{runReceipt.artifact.path ? ` · ${runReceipt.artifact.path}` : ''}</small>}
          {runReceipt.preview && <small>Preview: {runReceipt.preview.type}{runReceipt.preview.inline ? ' inline' : ' pending'}{runReceipt.preview.path ? ` · ${runReceipt.preview.path}` : ''}</small>}
          {runReceipt.failure && <small>Failure: {runReceipt.failure.message}</small>}
          {runReceipt.prior?.artifact && <small>Prior {runReceipt.prior.revisionKind}: {runReceipt.prior.artifact.label}{runReceipt.prior.artifact.path ? ` · ${runReceipt.prior.artifact.path}` : ''}</small>}
        </div>
      )}
      {cognitiveReceipt && (
        <div className="liminal-cognitive-receipt">
          <span>{cognitiveReceipt.heading}</span>
          <strong>{cognitiveReceipt.loop} · write-back {cognitiveReceipt.writeBackStatus}</strong>
          <small>{cognitiveReceipt.writeBackSummary}</small>
          <ul>
            {cognitiveReceipt.writeBackItems.map((item, index) => (
              <li key={`${item.organ}-${index}`}>
                <b>{item.organ}</b>
                <em>{item.status}</em>
                <small>{item.detail}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {activeMode.id === 'generate' && (
        <div className={`liminal-review-panel liminal-review-panel--${bridgeSummary.humanReview.status}`}>
          <span>Manual Review Pack</span>
          <strong>{bridgeSummary.humanReview.status === 'ready' ? 'human-only checks' : bridgeSummary.humanReview.status}</strong>
          {bridgeSummary.humanReview.checks.map((check) => (
            <small key={check.label}><b>{check.label}</b>: {check.detail}</small>
          ))}
        </div>
      )}
      {activeTab === 'create' && (
        <div className="liminal-control-panel">
          {bridge.error && <div className="atelier-alert atelier-alert--error">{bridge.error}</div>}
          {bridge.session?.pendingAction && (
            <div className="liminal-pending-action-card" role="group" aria-label="Pending action review">
              <span>Pending review</span>
              <strong>{bridge.session.pendingAction.title}</strong>
              {bridge.session.pendingAction.description && <small>{bridge.session.pendingAction.description}</small>}
              <div className="liminal-control-row">
                <button type="button" className="atelier-btn atelier-btn--primary" onClick={() => void bridge.confirmPending()}>
                  Confirm
                </button>
                <button type="button" className="atelier-btn atelier-btn--secondary" onClick={() => void bridge.cancelPending()}>
                  Cancel
                </button>
              </div>
            </div>
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
              <option value="draft">Generate</option>
              <option value="prove">Polish</option>
            </select>
            <small>{createExecutionMode === 'draft' ? 'Fast first artifact with immediate preview.' : 'Runs quality scoring, repair, and preview checks.'}</small>
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
    </ErrorBoundary>
  );

  const timelineSlot = (
    <ErrorBoundary name="Timeline">
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
            Answer and generate
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
            <span>Preview ready</span>
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
            Revise
          </button>
          <button
            type="button"
            onClick={() => submitDraftFollowup('Make a fresh variation with a different composition while preserving the core idea.', 'draft', 'variation')}
            disabled={bridge.submitting}
          >
            New variation
          </button>
          <button
            type="button"
            onClick={() => submitDraftFollowup('Polish this direction with quality scoring, repair, and preview checks.', 'prove', 'polish')}
            disabled={bridge.submitting}
          >
            Polish
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
    </ErrorBoundary>
  );

  const leftSlot = (
    <ErrorBoundary name="Panel">
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
    </ErrorBoundary>
  );

  const audioSlot = (
    <ErrorBoundary name="Audio">
    <div className="liminal-audio-input">
      <button
        type="button"
        className={micStatus === 'recording' ? 'liminal-audio-button liminal-audio-button--recording' : 'liminal-audio-button'}
        disabled={micStatus === 'recording' ? false : bridge.submitting}
        onClick={() => void startMicCapture()}
      >
        {micStatus === 'recording' ? 'Stop Singing' : 'Sing'}
      </button>
      <small>{micError || (micStatus === 'recording' ? 'your voice is driving the visuals' : micStatus === 'ready' ? 'voice captured — visuals generated' : hasDirectSingTarget ? 'sing to bring it to life' : 'sing to generate voice-reactive visuals')}</small>
    </div>
    </ErrorBoundary>
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
      onRunPrompt={handleWorkbenchRunPrompt}
      onCancelRun={bridgeSummary.active ? () => void bridge.cancelCurrent() : undefined}
      runDisabled={activeMode.id === 'improve' ? improveLoading : bridge.submitting || runStatus === 'running' || !createPrompt.trim() || (runNeedsBridgeSession && !bridge.session)}
      stageBusy={bridgeSummary.active || runStatus === 'running'}
      artifactReady={activeMode.id === 'generate' && hasSingTarget}
      runLabel={bridge.submitting ? 'Sending' : bridge.session?.pendingAction ? 'Review' : runLabel}
      audioSlot={audioSlot}
      providerLabel={providerLabel}
      evaluatorLabel={evaluatorLabel}
      inspectorLabel={inspectorLabel}
      stageSlot={stageSlot}
      inspectorSlot={inspectorSlot}
      timelineSlot={timelineSlot}
      leftSlot={leftSlot}
      recourseSlot={runRecourseSlot}
      recourseState={runStoppedBeforePreview ? 'stopped' : runFailedBeforePreview ? 'failed' : undefined}
    >
      {shouldRenderLegacyPanel(activeTab) && (
      <ErrorBoundary name="Legacy Panel">
      <Suspense fallback={<div className="atelier-panel">Loading Studio surface…</div>}>
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


      {activeTab === 'liveMusic' && (
        <div className="atelier-panel" style={{ maxWidth: 960, width: '100%' }}>
          <h2 className="atelier-heading">Live AV</h2>
          <p style={{ color: 'var(--atelier-text-muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            Generate Strudel music and Hydra video-synth code. Strudel runs in the embedded REPL; Hydra remains read-only here.
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
                allow="autoplay; clipboard-write; encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          )}

          {visualsCode && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: 'var(--atelier-visual)', marginBottom: 8, fontFamily: 'var(--font-body)', fontWeight: 600 }}>Hydra — read-only video synth code</h3>
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
              Gallery API not reachable. Start the backend: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>pnpm gui</code> (then reload). Backend must run on port 5174.
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
                allow={SENSOR_PERMISSION_POLICY}
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
      </Suspense>
      </ErrorBoundary>
      )}
    </WorkbenchShell>
  );
}
