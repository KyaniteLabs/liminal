import { validateSingPreset, type SingPresetArtifact } from '@liminal/audio-core/PresetSchema.js';
import type { VoiceFeatureFrame } from '@liminal/audio-core/VoiceFeatureStream.js';
import {
  applyMovementCalibration,
  applyMovementSensitivity,
  decayStaleMovementFeatures,
  EMPTY_MOVEMENT_FEATURES,
  type MovementFeatures,
} from './movement/features';
import { createSingRenderer, stabilizeSingFrame, type SingRenderer, type SingUniformFrame } from './render/pipeline';
import { SessionRecorder } from './recording/SessionRecorder';
import {
  createMockPhraseSuggestions,
  PhraseRingBuffer,
  requestPhraseBatch,
  type LyricSidecarInput,
  type PhraseFeedbackEvent,
  type PhraseGenerator,
} from './teleprompter/phrases';
import { createLfmOpenAiPhraseGenerator, type LfmOpenAiSidecarConfig } from './teleprompter/lfm';
import './style.css';

const canvas = requireElement<HTMLCanvasElement>('#sing-canvas');
const statusEl = requireElement<HTMLElement>('#sing-status');
const startButton = requireElement<HTMLButtonElement>('#sing-start');
const recordButton = requireElement<HTMLButtonElement>('#sing-record');
const teleprompterEl = requireElement<HTMLElement>('#sing-teleprompter');
const teleprompterPhrasesEl = requireElement<HTMLElement>('#sing-teleprompter-phrases');
const teleprompterToggleButton = requireElement<HTMLButtonElement>('#sing-teleprompter-toggle');
const teleprompterRefreshButton = requireElement<HTMLButtonElement>('#sing-teleprompter-refresh');
const sidecarToggleButton = requireElement<HTMLButtonElement>('#sing-sidecar-toggle');
const skeletonCanvas = requireElement<HTMLCanvasElement>('#sing-skeleton');
const cameraButton = requireElement<HTMLButtonElement>('#sing-camera');
const skeletonButton = requireElement<HTMLButtonElement>('#sing-skeleton-toggle');
const calibrateButton = requireElement<HTMLButtonElement>('#sing-calibrate');
const sensitivityInput = requireElement<HTMLInputElement>('#sing-movement-sensitivity');
const privacyEl = requireElement<HTMLElement>('#sing-privacy');

let renderer: SingRenderer | null = null;
let stream: MediaStream | null = null;
let cameraStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let movementWorker: Worker | null = null;
let movementVideo: HTMLVideoElement | null = null;
let sharedFrame: Float32Array | null = null;
let animationId: number | null = null;
let movementAnimationId: number | null = null;
let latestFrame: VoiceFeatureFrame | null = null;
let stableFrame: SingUniformFrame | null = null;
let latestMovement: MovementFeatures = EMPTY_MOVEMENT_FEATURES;
let neutralMovement: MovementFeatures = EMPTY_MOVEMENT_FEATURES;
let latestMovementAt = 0;
let movementFramePending = false;
let movementFrameRequestedAt = 0;
let lastMovementCaptureAt = 0;
let skeletonVisible = false;
let sessionRecorder: SessionRecorder | null = null;
let recording = false;
let teleprompterHidden = false;
let lastPhraseRefreshAt = 0;
let phraseRefreshInFlight = false;
const phraseQueue = new PhraseRingBuffer({ maxVisibleSuggestions: 5 });
const urlParams = new URLSearchParams(window.location.search);
const lfmSidecarConfig = parseLfmSidecarConfig(urlParams);
let lfmSidecarEnabled = lfmSidecarConfig?.enabledByDefault ?? false;
const lfmPhraseGenerator = lfmSidecarConfig ? createLfmOpenAiPhraseGenerator(lfmSidecarConfig) : null;

const preset = await loadPreset();
if (preset) {
  renderer = createSingRenderer(canvas, preset);
  void refreshPhraseSuggestions();
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
  void refreshPhraseSuggestions(latestFrame);
});

sidecarToggleButton.addEventListener('click', () => {
  lfmSidecarEnabled = !lfmSidecarEnabled;
  updateSidecarToggle();
  void refreshPhraseSuggestions(latestFrame);
});

cameraButton.addEventListener('click', () => {
  if (cameraStream) {
    stopCameraMovement();
  } else {
    void startCameraMovement();
  }
});

skeletonButton.addEventListener('click', () => {
  skeletonVisible = !skeletonVisible;
  skeletonCanvas.hidden = !skeletonVisible;
  skeletonButton.textContent = skeletonVisible ? 'Hide skeleton' : 'Show skeleton';
});

calibrateButton.addEventListener('click', () => {
  neutralMovement = latestMovement;
  setPrivacy('camera local · neutral pose set');
});

window.addEventListener('resize', () => renderer?.resize());
window.addEventListener('pagehide', () => {
  void stopInstrument();
  stopCameraMovement();
});
updateSidecarToggle();

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

async function startCameraMovement(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera access is unavailable. Instrument can still run with voice/controllers.');
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    movementVideo = document.createElement('video');
    movementVideo.muted = true;
    movementVideo.playsInline = true;
    movementVideo.srcObject = cameraStream;
    await movementVideo.play();
    movementWorker = new Worker(new URL('./movement/pose-worker.ts', import.meta.url), { type: 'module' });
    movementWorker.onmessage = (event: MessageEvent<{ type: string; tMs: number; features: MovementFeatures }>) => {
      if (event.data.type !== 'pose_features') return;
      movementFramePending = false;
      latestMovement = event.data.features;
      latestMovementAt = performance.now();
      if (recording) sessionRecorder?.appendMovementTelemetry(event.data.tMs, event.data.features);
    };
    cameraButton.textContent = 'Stop camera';
    calibrateButton.disabled = false;
    skeletonButton.disabled = false;
    setPrivacy('camera local · frames stay on this device');
    scheduleMovementCapture();
  } catch {
    stopCameraMovement();
    setStatus('Camera access is blocked. Instrument can still run with voice/controllers.');
  }
}

function stopCameraMovement(): void {
  if (movementAnimationId != null) window.cancelAnimationFrame(movementAnimationId);
  movementAnimationId = null;
  movementWorker?.terminate();
  movementWorker = null;
  movementVideo?.pause();
  movementVideo = null;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  movementFramePending = false;
  latestMovement = EMPTY_MOVEMENT_FEATURES;
  latestMovementAt = 0;
  cameraButton.textContent = 'Start camera';
  calibrateButton.disabled = true;
  skeletonButton.disabled = true;
  setPrivacy('camera off');
  clearSkeletonOverlay();
}

function renderIdle(): void {
  const startedAt = performance.now();
  const loop = () => {
    const now = performance.now();
    const movement = movementFrameForRender(now);
    renderer?.render({
      rms: 0.08 + Math.sin(performance.now() / 900) * 0.025,
      pitchHz: 220 + Math.sin(performance.now() / 1400) * 90,
      centroid: 0.3,
      spectralFlux: 0,
      onset: 0,
      voiced: 0,
      confidence: 0,
      elapsedSeconds: (performance.now() - startedAt) / 1000,
      movement,
    });
    drawSkeletonOverlay(movement);
    maybeRefreshMockPhrases(latestFrame);
    if (!stream) animationId = window.requestAnimationFrame(loop);
  };
  loop();
}

function renderLive(): void {
  const loop = () => {
    if (!sharedFrame) return;
    const movement = movementFrameForRender(performance.now());
    const rawFrame: SingUniformFrame = {
      rms: sharedFrame[0] ?? 0,
      pitchHz: sharedFrame[1] ?? 0,
      centroid: sharedFrame[2] ?? 0,
      spectralFlux: sharedFrame[3] ?? 0,
      onset: sharedFrame[4] ?? 0,
      voiced: sharedFrame[5] ?? 0,
      confidence: sharedFrame[6] ?? 0,
      elapsedSeconds: audioContext?.currentTime ?? performance.now() / 1000,
      movement,
    };
    stableFrame = stabilizeSingFrame(rawFrame, stableFrame);
    renderer?.render(stableFrame);
    drawSkeletonOverlay(movement);
    if (latestFrame) {
      const pitch = Math.round(latestFrame.pitchHz);
      setStatus(`${latestFrame.voiced ? 'voiced' : 'listening'} · rms ${latestFrame.rms.toFixed(2)} · ${pitch || '--'} Hz`);
      maybeRefreshMockPhrases(latestFrame);
    }
    animationId = window.requestAnimationFrame(loop);
  };
  loop();
}

function scheduleMovementCapture(): void {
  if (!cameraStream || !movementVideo || !movementWorker) return;
  const now = performance.now();
  if (movementFramePending && now - movementFrameRequestedAt > 250) {
    movementFramePending = false;
  }
  if (!movementFramePending && now - lastMovementCaptureAt >= 66 && movementVideo.videoWidth > 0 && typeof createImageBitmap !== 'undefined') {
    movementFramePending = true;
    movementFrameRequestedAt = now;
    lastMovementCaptureAt = now;
    void createImageBitmap(movementVideo)
      .then((bitmap) => {
        movementWorker?.postMessage({
          type: 'frame',
          tMs: now,
          bitmap,
          width: bitmap.width,
          height: bitmap.height,
        }, [bitmap]);
      })
      .catch(() => {
        movementFramePending = false;
      });
  }
  movementAnimationId = window.requestAnimationFrame(scheduleMovementCapture);
}

function movementFrameForRender(now: number): MovementFeatures {
  const age = latestMovementAt > 0 ? now - latestMovementAt : Number.POSITIVE_INFINITY;
  const staleAware = decayStaleMovementFeatures(latestMovement, age);
  const calibrated = applyMovementCalibration(staleAware, neutralMovement);
  return applyMovementSensitivity(calibrated, Number(sensitivityInput.value || 1));
}

function drawSkeletonOverlay(movement: MovementFeatures): void {
  if (!skeletonVisible) return;
  const context = skeletonCanvas.getContext('2d');
  if (!context) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (skeletonCanvas.width !== width || skeletonCanvas.height !== height) {
    skeletonCanvas.width = width;
    skeletonCanvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  context.strokeStyle = 'rgba(132, 234, 198, 0.74)';
  context.fillStyle = 'rgba(238, 246, 240, 0.92)';
  context.lineWidth = 2 * dpr;
  const centerX = movement.bodyCenterX * width;
  const centerY = movement.bodyCenterY * height;
  const leftX = Math.max(0.08 * width, centerX - (movement.handsApart * width * 0.5));
  const rightX = Math.min(0.92 * width, centerX + (movement.handsApart * width * 0.5));
  const leftY = (1 - movement.leftHandHeight) * height;
  const rightY = (1 - movement.rightHandHeight) * height;
  context.beginPath();
  context.moveTo(leftX, leftY);
  context.lineTo(centerX, centerY);
  context.lineTo(rightX, rightY);
  context.stroke();
  for (const [x, y, radius] of [[centerX, centerY, 7], [leftX, leftY, 5], [rightX, rightY, 5]] as const) {
    context.beginPath();
    context.arc(x, y, radius * dpr, 0, Math.PI * 2);
    context.fill();
  }
}

function clearSkeletonOverlay(): void {
  skeletonCanvas.getContext('2d')?.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
}

function maybeRefreshMockPhrases(frame?: VoiceFeatureFrame | null): void {
  const now = performance.now();
  if (now - lastPhraseRefreshAt < 4000) return;
  lastPhraseRefreshAt = now;
  void refreshPhraseSuggestions(frame);
}

async function refreshPhraseSuggestions(frame?: VoiceFeatureFrame | null): Promise<void> {
  if (!preset || phraseRefreshInFlight) return;
  phraseRefreshInFlight = true;
  const now = Date.now();
  const generator = currentPhraseGenerator();
  const suggestions = await requestPhraseBatch(lyricInput(frame), {
    enabled: true,
    count: 5,
    now,
    ttlMs: 15_000,
    requestTimeoutMs: lfmSidecarEnabled ? lfmSidecarConfig?.requestTimeoutMs ?? 1200 : 250,
    generator,
  });
  phraseRefreshInFlight = false;
  if (suggestions.length > 0) phraseQueue.add(suggestions, now);
  renderTeleprompter();
}

function currentPhraseGenerator(): PhraseGenerator {
  if (lfmSidecarEnabled && lfmPhraseGenerator) return lfmPhraseGenerator;
  return createMockPhraseSuggestions;
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
    movementMood: {
      stillness: latestMovement.movementEnergy > 0.2 ? 'active' : latestMovement.stillness > 0.8 ? 'still' : 'flowing',
      gesture: latestMovement.gestureOnset ? 'onset' : undefined,
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

function setPrivacy(message: string): void {
  privacyEl.textContent = message;
}

function updateSidecarToggle(): void {
  sidecarToggleButton.disabled = !lfmSidecarConfig;
  sidecarToggleButton.textContent = lfmSidecarEnabled ? 'Use mock' : 'Use LFM';
  sidecarToggleButton.title = lfmSidecarConfig
    ? `LFM sidecar ${lfmSidecarEnabled ? 'enabled' : 'available'} at ${lfmSidecarConfig.endpoint}`
    : 'Add lyricEndpoint and lyricModel query params to enable local LFM sidecar';
}

function parseLfmSidecarConfig(params: URLSearchParams): (LfmOpenAiSidecarConfig & { enabledByDefault: boolean }) | null {
  const endpoint = params.get('lyricEndpoint');
  const model = params.get('lyricModel');
  if (!endpoint || !model) return null;
  return {
    endpoint,
    model,
    enabledByDefault: params.get('lyricSidecar') === 'lfm',
    source: model.includes('350M') ? 'lfm2_5_350m' : 'lfm2_5_1_2b',
    requestTimeoutMs: Number(params.get('lyricTimeoutMs') || 1200),
    maxNewTokens: Number(params.get('lyricMaxTokens') || 48),
  };
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Sing instrument DOM is missing ${selector}`);
  return element;
}
