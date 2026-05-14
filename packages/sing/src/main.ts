import { validateSingPreset, type SingPresetArtifact } from '@liminal/audio-core/PresetSchema.js';
import type { VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';
import { createSingRenderer, stabilizeSingFrame, type SingRenderer, type SingUniformFrame } from './render/pipeline';
import { SessionRecorder } from './recording/SessionRecorder';
import './style.css';

const canvas = requireElement<HTMLCanvasElement>('#sing-canvas');
const statusEl = requireElement<HTMLElement>('#sing-status');
const startButton = requireElement<HTMLButtonElement>('#sing-start');
const recordButton = requireElement<HTMLButtonElement>('#sing-record');

let renderer: SingRenderer | null = null;
let stream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let sharedFrame: Float32Array | null = null;
let animationId: number | null = null;
let latestFrame: VoiceFeatureFrame | null = null;
let stableFrame: SingUniformFrame | null = null;
let sessionRecorder: SessionRecorder | null = null;
let recording = false;

const preset = await loadPreset();
if (preset) {
  renderer = createSingRenderer(canvas, preset);
  renderIdle();
  setStatus(`${preset.name} ready`);
} else {
  startButton.disabled = true;
  recordButton.disabled = true;
  setStatus('Open a generated Sing preset from Studio');
}

startButton.addEventListener('click', () => {
  if (stream) {
    void stopInstrument();
  } else {
    void startInstrument();
  }
});

recordButton.addEventListener('click', () => {
  if (!stream) return;
  if (recording) {
    void stopRecording();
  } else {
    startRecording();
  }
});

window.addEventListener('resize', () => renderer?.resize());
window.addEventListener('pagehide', () => {
  void stopInstrument();
});

async function loadPreset(): Promise<SingPresetArtifact | null> {
  const presetUrl = new URLSearchParams(window.location.search).get('preset');
  if (!presetUrl) return null;

  const response = await fetch(presetUrl);
  if (!response.ok) throw new Error(`Unable to load Sing preset: ${response.status}`);
  const validation = validateSingPreset(await response.json());
  if (!validation.ok) throw new Error(`Invalid Sing preset: ${validation.error}`);
  return validation.preset;
}

async function startInstrument(): Promise<void> {
  if (!preset || !renderer) {
    setStatus('Open a generated Sing preset from Studio');
    return;
  }
  if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    setStatus('Serve Sing with COOP/COEP headers to enable live mic analysis');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Microphone input is unavailable in this browser');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Web Audio is unavailable in this browser');
    audioContext = new AudioContextCtor();
    await audioContext.audioWorklet.addModule(new URL('./audio/worklet.ts', import.meta.url));

    const source = audioContext.createMediaStreamSource(stream);
    workletNode = new AudioWorkletNode(audioContext, 'sing-voice-processor');
    sharedFrame = new Float32Array(new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 8));
    workletNode.port.postMessage({ type: 'shared-frame', buffer: sharedFrame.buffer });
    workletNode.port.onmessage = (event: MessageEvent<{ type: string; frame: VoiceFeatureFrame }>) => {
      if (event.data?.type !== 'voice-frame') return;
      latestFrame = event.data.frame;
      if (recording) sessionRecorder?.appendTelemetry(event.data.frame);
    };

    const silent = audioContext.createGain();
    silent.gain.value = 0;
    source.connect(workletNode).connect(silent).connect(audioContext.destination);
    startButton.textContent = 'Stop mic';
    recordButton.disabled = false;
    setStatus('listening');
    renderLive();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to start microphone');
    await stopInstrument();
  }
}

async function stopInstrument(): Promise<void> {
  if (recording) await stopRecording();
  if (animationId != null) window.cancelAnimationFrame(animationId);
  animationId = null;
  workletNode?.port.close();
  workletNode?.disconnect();
  workletNode = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  await audioContext?.close();
  audioContext = null;
  sharedFrame = null;
  latestFrame = null;
  stableFrame = null;
  startButton.textContent = 'Start mic';
  recordButton.disabled = true;
  setStatus(preset ? `${preset.name} ready` : 'Open a generated Sing preset from Studio');
  if (preset) renderIdle();
}

function renderIdle(): void {
  const startedAt = performance.now();
  const loop = () => {
    renderer?.render({
      rms: 0.08 + Math.sin(performance.now() / 900) * 0.025,
      pitchHz: 220 + Math.sin(performance.now() / 1400) * 90,
      centroid: 0.3,
      spectralFlux: 0,
      onset: 0,
      voiced: 0,
      confidence: 0,
      elapsedSeconds: (performance.now() - startedAt) / 1000,
    });
    if (!stream) animationId = window.requestAnimationFrame(loop);
  };
  loop();
}

function renderLive(): void {
  const loop = () => {
    if (!sharedFrame) return;
    const rawFrame: SingUniformFrame = {
      rms: sharedFrame[0] ?? 0,
      pitchHz: sharedFrame[1] ?? 0,
      centroid: sharedFrame[2] ?? 0,
      spectralFlux: sharedFrame[3] ?? 0,
      onset: sharedFrame[4] ?? 0,
      voiced: sharedFrame[5] ?? 0,
      confidence: sharedFrame[6] ?? 0,
      elapsedSeconds: audioContext?.currentTime ?? performance.now() / 1000,
    };
    stableFrame = stabilizeSingFrame(rawFrame, stableFrame);
    renderer?.render(stableFrame);
    if (latestFrame) {
      const pitch = Math.round(latestFrame.pitchHz);
      setStatus(`${latestFrame.voiced ? 'voiced' : 'listening'} · rms ${latestFrame.rms.toFixed(2)} · ${pitch || '--'} Hz`);
    }
    animationId = window.requestAnimationFrame(loop);
  };
  loop();
}

function startRecording(): void {
  if (!stream) return;
  sessionRecorder = new SessionRecorder();
  sessionRecorder.start(stream);
  recording = true;
  recordButton.textContent = 'Stop rec';
  setStatus('recording');
}

async function stopRecording(): Promise<void> {
  if (!sessionRecorder) return;
  const exported = await sessionRecorder.stop();
  recording = false;
  recordButton.textContent = 'Record';
  downloadBlob(exported.telemetryBlob, `sing-telemetry-${exported.startedAt}.jsonl`);
  if (exported.audioBlob) downloadBlob(exported.audioBlob, `sing-audio-${exported.startedAt}.webm`);
  sessionRecorder = null;
  setStatus('session exported');
}

function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename.replace(/[:.]/g, '-');
  link.click();
  URL.revokeObjectURL(url);
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Sing instrument DOM is missing ${selector}`);
  return element;
}
