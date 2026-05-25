export interface MovementFeatureFrame {
  movementEnergy: number;
  movementX: number;
  movementY: number;
  distanceToCamera: number;
  confidence: number;
  capturedAt: number;
}

export interface MovementImageSample {
  width: number;
  height: number;
  data: ArrayLike<number>;
  previousData?: ArrayLike<number> | null;
  capturedAt: number;
}

export interface MovementState {
  frame: MovementFeatureFrame;
  stale: boolean;
}

export const MOVEMENT_STALL_MS = 750;

export function emptyMovementFrame(capturedAt = 0): MovementFeatureFrame {
  return {
    movementEnergy: 0,
    movementX: 0.5,
    movementY: 0.5,
    distanceToCamera: 0,
    confidence: 0,
    capturedAt,
  };
}

export function extractMovementFeatures(sample: MovementImageSample): MovementFeatureFrame {
  if (!sample.previousData) return emptyMovementFrame(sample.capturedAt);

  let totalDiff = 0;
  let weightedX = 0;
  let weightedY = 0;
  let changedPixels = 0;
  let minX = sample.width;
  let minY = sample.height;
  let maxX = 0;
  let maxY = 0;
  const pixelCount = Math.max(1, sample.width * sample.height);

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const diff = Math.abs(luma(sample.data, offset) - luma(sample.previousData, offset));
    if (diff < 18) continue;
    const x = index % sample.width;
    const y = Math.floor(index / sample.width);
    totalDiff += diff;
    weightedX += x * diff;
    weightedY += y * diff;
    changedPixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (totalDiff <= 0 || changedPixels === 0) return emptyMovementFrame(sample.capturedAt);

  const changedRatio = changedPixels / pixelCount;
  const boxArea = ((maxX - minX + 1) * (maxY - minY + 1)) / pixelCount;

  return {
    movementEnergy: clamp01((totalDiff / (pixelCount * 255)) * 4),
    movementX: clamp01(weightedX / totalDiff / Math.max(1, sample.width - 1)),
    movementY: clamp01(weightedY / totalDiff / Math.max(1, sample.height - 1)),
    distanceToCamera: clamp01(Math.sqrt(boxArea)),
    confidence: clamp01(changedRatio * 5),
    capturedAt: sample.capturedAt,
  };
}

export function reduceMovementFrame(previous: MovementState | null, next: MovementFeatureFrame): MovementState {
  if (!previous || previous.stale) return { frame: next, stale: false };
  return {
    frame: {
      movementEnergy: smooth(previous.frame.movementEnergy, next.movementEnergy, 0.62),
      movementX: smooth(previous.frame.movementX, next.movementX, 0.74),
      movementY: smooth(previous.frame.movementY, next.movementY, 0.74),
      distanceToCamera: smooth(previous.frame.distanceToCamera, next.distanceToCamera, 0.7),
      confidence: smooth(previous.frame.confidence, next.confidence, 0.6),
      capturedAt: next.capturedAt,
    },
    stale: false,
  };
}

export function markMovementStale(state: MovementState | null, now: number, stallMs = MOVEMENT_STALL_MS): MovementState | null {
  if (!state || !isMovementWorkerStalled(state.frame, now, stallMs)) return state;
  return {
    frame: emptyMovementFrame(now),
    stale: true,
  };
}

export function isMovementWorkerStalled(frame: MovementFeatureFrame, now: number, stallMs = MOVEMENT_STALL_MS): boolean {
  return now - frame.capturedAt > stallMs;
}

function luma(data: ArrayLike<number>, offset: number): number {
  return (data[offset] ?? 0) * 0.2126 + (data[offset + 1] ?? 0) * 0.7152 + (data[offset + 2] ?? 0) * 0.0722;
}

function smooth(previous: number, next: number, smoothing: number): number {
  return previous * smoothing + next * (1 - smoothing);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
