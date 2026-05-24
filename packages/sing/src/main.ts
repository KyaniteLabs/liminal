import { validateSingPreset, type SingPresetArtifact } from '@liminal/audio-core/PresetSchema.js';
import type { VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';
import { createSingRenderer, stabilizeSingFrame, type SingRenderer, type SingUniformFrame } from './render/pipeline';
import { SessionRecorder } from './recording/SessionRecorder';
import {
  createMockPhraseSuggestions,
  PhraseRingBuffer,
  type LyricSidecarInput,
  type PhraseFeedbackEvent,
} from './teleprompter/phrases';
import './style.css';

const canvas = requireElement<HTMLCanvasElement>('#sing-canvas');
const statusEl = requireElement<HTMLElement>('#sing-status');
const startButton = requireElement<HTMLButtonElement>('#sing-start');
const recordButton = requireElement<HTMLButtonElement>('#sing-record');
const teleprompterEl = requireElement<HTMLElement>('#sing-teleprompter');
const teleprompterPhrasesEl = requireElement<HTMLElement>('#sing-teleprompter-phrases');
const teleprompterToggleButton = requireElement<HTMLButtonElement>('#sing-teleprompter-toggle');
const teleprompterRefreshButton = requireElement<HTMLButtonElement>('#sing-teleprompter-refresh');

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
let teleprompterHidden = false;
let lastPhraseRefreshAt = 0;
const phraseQueue = new PhraseRingBuffer({ maxVisibleSuggestions: 5 });

const preset = await loadPreset();
if (preset) {
  renderer = createSingRenderer(canvas, preset);
  refreshMockPhrases();
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

teleprompterToggleButton.addEventListener('click', () => {
  teleprompterHidden = !teleprompterHidden;
  renderTeleprompter();
});

teleprompterRefreshButton.addEventListener('click', () => {
  refreshMockPhrases(latestFrame);
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
    maybeRefreshMockPhrases(latestFrame);
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
      maybeRefreshMockPhrases(latestFrame);
    }
    animationId = window.requestAnimationFrame(loop);
  };
  loop();
}

function maybeRefreshMockPhrases(frame?: VoiceFeatureFrame | null): void {
  const now = performance.now();
  if (now - lastPhraseRefreshAt < 4000) return;
  lastPhraseRefreshAt = now;
  refreshMockPhrases(frame);
}

function refreshMockPhrases(frame?: VoiceFeatureFrame | null): void {
  if (!preset) return;
  const now = Date.now();
  phraseQueue.add(createMockPhraseSuggestions(lyricInput(frame), { count: 5, now, ttlMs: 15_000 }), now);
  renderTeleprompter();
}

function lyricInput(frame?: VoiceFeatureFrame | null): LyricSidecarInput {
  return {
    presetId: preset?.id || 'sing-preset',
    sceneName: preset?.name,
    visualTags: preset ? [preset.instrument, preset.shader.language] : ['sing'],
    recentAcceptedPhrases: [],
    recentDismissedPhrases: phraseQueue.events()
      .filter((event) => event.type === 'phrase.dismissed')
      .map((event) => event.text),
    audioMood: {
      intensity: frameIntensity(frame),
      pitchMotion: 'wandering',
      brightness: (frame?.centroid ?? 0) > 0.58 ? 'bright' : (frame?.centroid ?? 0) < 0.28 ? 'dark' : 'balanced',
      onsetDensity: (frame?.spectralFlux ?? 0) > 0.03 ? 'dense' : 'sparse',
      vibrato: 'subtle',
    },
  };
}

function frameIntensity(frame?: VoiceFeatureFrame | null): LyricSidecarInput['audioMood']['intensity'] {
  if (!frame || frame.rms < 0.015) return 'silent';
  if (frame.rms < 0.07) return 'soft';
  if (frame.rms < 0.18) return 'medium';
  return 'high';
}

function renderTeleprompter(): void {
  teleprompterEl.dataset.mode = teleprompterHidden ? 'hidden' : 'strip';
  teleprompterToggleButton.textContent = teleprompterHidden ? 'Show phrases' : 'Hide phrases';
  teleprompterPhrasesEl.replaceChildren(...phraseQueue.visible(Date.now()).map(renderPhrase));
}

function renderPhrase(phrase: { id: string; text: string }): HTMLElement {
  const item = document.createElement('div');
  item.className = 'sing-phrase';
  item.dataset.phraseId = phrase.id;

  const text = document.createElement('span');
  text.className = 'sing-phrase__text';
  text.textContent = phrase.text;
  item.append(text);
  item.append(phraseButton('Pin', () => recordPhraseEvent(phraseQueue.pin(phrase.id, Date.now()))));
  item.append(phraseButton('More', () => recordPhraseEvent(phraseQueue.moreLikeThis(phrase.id, Date.now()))));
  item.append(phraseButton('Dismiss', () => recordPhraseEvent(phraseQueue.dismiss(phrase.id, 'not_now', Date.now()))));
  return item;
}

function phraseButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    onClick();
    renderTeleprompter();
  });
  return button;
}

function recordPhraseEvent(event: PhraseFeedbackEvent | null): void {
  if (event && recording) sessionRecorder?.appendPhraseEvent(event);
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
