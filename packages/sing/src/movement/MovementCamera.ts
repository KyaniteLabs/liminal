import type { MovementFeatureFrame } from './MovementFeatures';

export interface MovementCameraController {
  isRunning(): boolean;
  start(): Promise<void>;
  stop(): void;
}

export interface MovementCameraOptions {
  onFrame(frame: MovementFeatureFrame): void;
  onStall(now: number): void;
  onError(error: Error): void;
  sampleWidth?: number;
  sampleHeight?: number;
  stallMs?: number;
}

type MovementWorkerMessage = { type: 'movement-frame'; frame: MovementFeatureFrame };

export function createMovementCameraController(options: MovementCameraOptions): MovementCameraController {
  const sampleWidth = options.sampleWidth ?? 48;
  const sampleHeight = options.sampleHeight ?? 36;
  const stallMs = options.stallMs ?? 750;
  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const worker = new Worker(new URL('./pose-worker.ts', import.meta.url), { type: 'module' });
  let stream: MediaStream | null = null;
  let frameId: number | null = null;
  let running = false;
  let awaitingWorker = false;
  let awaitingSince = 0;

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  video.muted = true;
  video.playsInline = true;

  worker.onmessage = (event: MessageEvent<MovementWorkerMessage>) => {
    if (event.data.type !== 'movement-frame') return;
    awaitingWorker = false;
    options.onFrame(event.data.frame);
  };
  worker.onerror = () => {
    awaitingWorker = false;
    options.onError(new Error('Movement worker failed'));
  };

  async function start(): Promise<void> {
    if (running) return;
    if (!context) throw new Error('Camera movement canvas is unavailable');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera input is unavailable in this browser');

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    worker.postMessage({ type: 'reset' });
    running = true;
    frameId = window.requestAnimationFrame(capture);
  }

  function stop(): void {
    running = false;
    if (frameId != null) window.cancelAnimationFrame(frameId);
    frameId = null;
    awaitingWorker = false;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    worker.terminate();
  }

  function capture(now: number): void {
    if (!running) return;
    if (awaitingWorker && now - awaitingSince > stallMs) {
      awaitingWorker = false;
      options.onStall(now);
    }
    if (!awaitingWorker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      context?.drawImage(video, 0, 0, sampleWidth, sampleHeight);
      const imageData = context?.getImageData(0, 0, sampleWidth, sampleHeight);
      if (imageData) {
        awaitingWorker = true;
        awaitingSince = now;
        worker.postMessage({ type: 'frame', imageData, capturedAt: now });
      }
    }
    frameId = window.requestAnimationFrame(capture);
  }

  return {
    isRunning: () => running,
    start,
    stop,
  };
}
