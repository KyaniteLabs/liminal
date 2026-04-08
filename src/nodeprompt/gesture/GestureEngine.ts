/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * GestureEngine — MediaPipe hand-tracking engine with 1-Euro filtering,
 * pinch hysteresis, and palm-size zoom calibration.
 *
 * Browser-only at runtime; compiles in Node.js because all browser/MediaPipe
 * APIs are accessed inside try/catch guards.
 */

import { createDefaultGestureState, type GestureState } from './gestureTypes.js';

// ── Constants ──

const INFERENCE_INTERVAL_MS = 67;      // ~15 fps
const PINCH_START_THRESHOLD = 0.07;
const PINCH_END_THRESHOLD = 0.13;
const PINCH_DEBOUNCE_FRAMES = 2;
const CALIBRATION_FRAMES = 30;
const ONE_EURO_BETA = 0.007;           // Lower = smoother
const ONE_EURO_MIN_CUTOFF = 1.0;

// ── Lazy module references (resolved only in browser) ──

type OneEuroFilterType = {
  filter(timestampSec: number, value: number): number;
};

type GestureRecognizerType = {
  recognize(image: HTMLVideoElement, timestampMs: number): Promise<{
    gestures: Array<{ categoryName: string; score: number }[] | null>;
    landmarks: Array<{ x: number; y: number; z: number }[]>;
    worldLandmarks: Array<{ x: number; y: number; z: number }[]>;
  }>;
  close(): void;
};

type FilesetResolverType = {
  forVisionTasks(path: string): Promise<unknown>;
};

type GestureRecognizerOpts = {
  baseOptions: { modelAssetPath: string; delegate?: string };
  runningMode: string;
  numHands: number;
};

export interface GestureEngineOptions {
  /** Called when an inference error occurs during the recognition loop */
  onError?: (error: string) => void;
}

// ── GestureEngine class ──

export class GestureEngine {
  readonly state: GestureState = createDefaultGestureState();

  private _videoElement: HTMLVideoElement | null = null;
  private _recognizer: GestureRecognizerType | null = null;
  private _intervalId: ReturnType<typeof setInterval> | null = null;
  private _stream: MediaStream | null = null;
  private _destroyed = false;
  private _onError?: (error: string) => void;

  // 1-Euro filters
  private _filterX: OneEuroFilterType | null = null;
  private _filterY: OneEuroFilterType | null = null;
  private _filterPalm: OneEuroFilterType | null = null;

  // Pinch hysteresis state
  private _pinchDebounce = 0;
  private _wasPinching = false;

  // Palm baseline calibration
  private _calibrationSamples: number[] = [];
  private _baselineCalibrated = false;

  // ── Public API ──

  /**
   * Start webcam feed and the inference loop.
   * Resolves when the first frame has been processed (or errors immediately
   * if the browser environment is missing required APIs).
   */
  async start(videoElement?: HTMLVideoElement, options?: GestureEngineOptions): Promise<void> {
    if (this.state.active) return;

    this._onError = options?.onError;

    try {
      // Dynamically import browser-only modules (not installed in Node CLI)
      // @ts-expect-error -- 1eurofilter is a browser-only dependency
      const { OneEuroFilter } = await import('1eurofilter');
      // @ts-expect-error -- @mediapipe/tasks-vision is a browser-only dependency
      const vision = await import('@mediapipe/tasks-vision') as {
        GestureRecognizer: {
          initializeAppsWithOptions(fileset: Promise<unknown>, opts: GestureRecognizerOpts): Promise<GestureRecognizerType>;
        };
        FilesetResolver: FilesetResolverType;
      };

      // Create 1-Euro filters
      this._filterX = new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA);
      this._filterY = new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA);
      this._filterPalm = new OneEuroFilter(ONE_EURO_MIN_CUTOFF, ONE_EURO_BETA);

      // Load MediaPipe GestureRecognizer
      const filesetResolver = vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );
      this._recognizer = await vision.GestureRecognizer.initializeAppsWithOptions(filesetResolver,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        },
      );

      // Set up video element
      if (videoElement) {
        this._videoElement = videoElement;
      } else {
        this._videoElement = document.createElement('video');
        this._videoElement.setAttribute('autoplay', '');
        this._videoElement.setAttribute('playsinline', '');
      }

      // Request camera
      const getUserMedia = navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices);
      if (!getUserMedia) {
        throw new Error('getUserMedia not available');
      }
      this._stream = await getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      this._videoElement.srcObject = this._stream;
      await this._videoElement.play();

      this.state.active = true;
      this.state.error = null;

      // Start inference loop
      this._startLoop();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.state.error = `GestureEngine start failed: ${message}`;
      this.state.active = false;
    }
  }

  /** Stop webcam feed and inference loop. */
  stop(): void {
    this._destroyed = true;

    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (this._stream) {
      for (const track of this._stream.getTracks()) {
        track.stop();
      }
      this._stream = null;
    }

    if (this._recognizer) {
      try { this._recognizer.close(); } catch { /* swallow */ }
      this._recognizer = null;
    }

    this._filterX = null;
    this._filterY = null;
    this._filterPalm = null;

    this._videoElement = null;
    this.state.active = false;
    this.state.handDetected = false;
  }

  /** Return the current video element (may be null before start or after stop). */
  getVideoElement(): HTMLVideoElement | null {
    return this._videoElement;
  }

  /**
   * Check whether the current environment supports gesture tracking.
   * Does NOT require a running engine — safe to call in Node.js.
   */
  static isAvailable(): boolean {
    try {
      const hasGetUserMedia = typeof navigator !== 'undefined'
        && navigator.mediaDevices !== undefined
        && typeof navigator.mediaDevices.getUserMedia === 'function';
      return hasGetUserMedia;
    } catch {
      return false;
    }
  }

  // ── Private internals ──

  private _startLoop(): void {
    let lastTimestamp = -1;

    this._intervalId = setInterval(() => {
      if (this._destroyed || !this._recognizer || !this._videoElement) return;

      const video = this._videoElement;
      if (video.readyState < 2) return; // HAVE_CURRENT_DATA

      const now = performance.now();
      if (now === lastTimestamp) return;
      lastTimestamp = now;

      this._recognizer
        .recognize(video, now)
        .then((result) => {
          this._processResult(result, now);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.state.error = msg;
          this._onError?.(msg);
        });
    }, INFERENCE_INTERVAL_MS);
  }

  private _processResult(
    result: {
      gestures: Array<{ categoryName: string; score: number }[] | null>;
      landmarks: Array<{ x: number; y: number; z: number }[]>;
    },
    timestampMs: number,
  ): void {
    // Store previous frame for interpolation
    this.state.prevIndexTipNdcX = this.state.indexTipNdcX;
    this.state.prevIndexTipNdcY = this.state.indexTipNdcY;
    this.state.prevPalmSizeSmoothed = this.state.palmSizeSmoothed;

    const gesture = result.gestures?.[0]?.[0] ?? null;
    const landmarks = result.landmarks?.[0] ?? null;

    if (!landmarks || landmarks.length === 0) {
      this.state.handDetected = false;
      this.state.gestureName = null;
      this.state.gestureConfidence = 0;
      this.state.lastUpdateMs = timestampMs;
      return;
    }

    this.state.handDetected = true;

    // Gesture label
    if (gesture) {
      this.state.gestureName = gesture.categoryName;
      this.state.gestureConfidence = gesture.score;
    } else {
      this.state.gestureName = null;
      this.state.gestureConfidence = 0;
    }

    // Key landmarks (MediaPipe normalized 0-1)
    const indexTip = landmarks[8]!;
    const thumbTip = landmarks[4]!;
    const wrist = landmarks[0]!;
    const middleMcp = landmarks[9]!;

    // ── Pinch detection with hysteresis ──
    const dx = indexTip.x - thumbTip.x;
    const dy = indexTip.y - thumbTip.y;
    const pinchDist = Math.sqrt(dx * dx + dy * dy);
    this.state.pinchStrength = 1.0 - Math.min(pinchDist / 0.2, 1.0);

    if (!this._wasPinching) {
      if (pinchDist < PINCH_START_THRESHOLD) {
        this._pinchDebounce++;
        if (this._pinchDebounce >= PINCH_DEBOUNCE_FRAMES) {
          this._wasPinching = true;
          this.state.isPinching = true;
          this._pinchDebounce = 0;
        }
      } else {
        this._pinchDebounce = 0;
      }
    } else {
      if (pinchDist > PINCH_END_THRESHOLD) {
        this._pinchDebounce++;
        if (this._pinchDebounce >= PINCH_DEBOUNCE_FRAMES) {
          this._wasPinching = false;
          this.state.isPinching = false;
          this._pinchDebounce = 0;
        }
      } else {
        this._pinchDebounce = 0;
      }
    }

    // ── NDC coordinate transform (webcam mirrored) ──
    // MediaPipe gives 0-1 normalized coords; mirror X for selfie view.
    const rawX = -(indexTip.x * 2 - 1); // flip for mirror
    const rawY = -(indexTip.y * 2 - 1); // Y-up

    // 1-Euro smoothing
    const tSec = timestampMs / 1000;
    this.state.indexTipNdcX = this._filterX ? this._filterX.filter(tSec, rawX) : rawX;
    this.state.indexTipNdcY = this._filterY ? this._filterY.filter(tSec, rawY) : rawY;

    // ── Palm size (for zoom) ──
    const palmDx = middleMcp.x - wrist.x;
    const palmDy = middleMcp.y - wrist.y;
    const palmSize = Math.sqrt(palmDx * palmDx + palmDy * palmDy);
    this.state.palmSize = palmSize;

    this.state.palmSizeSmoothed = this._filterPalm
      ? this._filterPalm.filter(tSec, palmSize)
      : palmSize;

    // ── Baseline calibration ──
    if (!this._baselineCalibrated) {
      this._calibrationSamples.push(palmSize);
      if (this._calibrationSamples.length >= CALIBRATION_FRAMES) {
        const sorted = [...this._calibrationSamples].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        this.state.palmSizeBaseline = sorted.length % 2 !== 0
          ? sorted[mid]!
          : (sorted[mid - 1]! + sorted[mid]!) / 2;
        this._baselineCalibrated = true;
        this._calibrationSamples = [];
      }
    }

    this.state.lastUpdateMs = timestampMs;
  }
}
