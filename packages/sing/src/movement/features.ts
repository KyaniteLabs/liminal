export interface MovementFeatures {
  bodyCenterX: number;
  bodyCenterY: number;
  distanceToCamera: number;
  leftHandHeight: number;
  rightHandHeight: number;
  handsApart: number;
  torsoAngle: number;
  headTilt: number;
  movementEnergy: number;
  stillness: number;
  gestureOnset: boolean;
}

export interface MovementPixelAnalysis {
  features: MovementFeatures;
  luma: Uint8Array;
  confidence: number;
}

export const EMPTY_MOVEMENT_FEATURES: MovementFeatures = {
  bodyCenterX: 0.5,
  bodyCenterY: 0.5,
  distanceToCamera: 0,
  leftHandHeight: 0.5,
  rightHandHeight: 0.5,
  handsApart: 0,
  torsoAngle: 0,
  headTilt: 0,
  movementEnergy: 0,
  stillness: 1,
  gestureOnset: false,
};

export function analyzeMovementPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  previousLuma?: Uint8Array,
): MovementPixelAnalysis {
  const luma = new Uint8Array(width * height);
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  let leftTotal = 0;
  let leftX = 0;
  let leftY = 0;
  let rightTotal = 0;
  let rightX = 0;
  let rightY = 0;
  let diffTotal = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const offset = pixelIndex * 4;
      const value = Math.round((pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3);
      luma[pixelIndex] = value;
      const weight = value / 255;
      total += weight;
      weightedX += x * weight;
      weightedY += y * weight;
      if (previousLuma && previousLuma.length === luma.length) {
        diffTotal += Math.abs(value - previousLuma[pixelIndex]) / 255;
      }
      if (x < width / 2) {
        leftTotal += weight;
        leftX += x * weight;
        leftY += y * weight;
      } else {
        rightTotal += weight;
        rightX += x * weight;
        rightY += y * weight;
      }
    }
  }

  const pixelCount = Math.max(1, width * height);
  const bodyCenterX = total > 0 ? weightedX / total / Math.max(1, width - 1) : 0.5;
  const bodyCenterY = total > 0 ? weightedY / total / Math.max(1, height - 1) : 0.5;
  const leftNormX = leftTotal > 0 ? leftX / leftTotal / Math.max(1, width - 1) : 0.25;
  const rightNormX = rightTotal > 0 ? rightX / rightTotal / Math.max(1, width - 1) : 0.75;
  const leftHandHeight = leftTotal > 0 ? 1 - (leftY / leftTotal / Math.max(1, height - 1)) : 0.5;
  const rightHandHeight = rightTotal > 0 ? 1 - (rightY / rightTotal / Math.max(1, height - 1)) : 0.5;
  const movementEnergy = previousLuma ? clamp01(diffTotal / pixelCount / 0.18) : 0;
  const brightness = total / pixelCount;

  return {
    luma,
    confidence: clamp01(brightness * 2.2),
    features: {
      bodyCenterX: clamp01(bodyCenterX),
      bodyCenterY: clamp01(bodyCenterY),
      distanceToCamera: clamp01(brightness * 1.8),
      leftHandHeight: clamp01(leftHandHeight),
      rightHandHeight: clamp01(rightHandHeight),
      handsApart: clamp01(Math.abs(rightNormX - leftNormX)),
      torsoAngle: clampSigned((bodyCenterX - 0.5) * 2),
      headTilt: clampSigned((rightHandHeight - leftHandHeight) * 1.5),
      movementEnergy,
      stillness: clamp01(1 - movementEnergy),
      gestureOnset: movementEnergy > 0.38,
    },
  };
}

export function decayStaleMovementFeatures(features: MovementFeatures, ageMs: number, staleAfterMs = 250): MovementFeatures {
  if (ageMs <= staleAfterMs) return features;
  const decay = clamp01((ageMs - staleAfterMs) / 1000);
  return {
    ...features,
    movementEnergy: features.movementEnergy * (1 - decay),
    stillness: Math.max(features.stillness, decay),
    gestureOnset: false,
  };
}

export function applyMovementCalibration(features: MovementFeatures, neutral: MovementFeatures): MovementFeatures {
  return {
    ...features,
    bodyCenterX: clamp01(0.5 + (features.bodyCenterX - neutral.bodyCenterX)),
    bodyCenterY: clamp01(0.5 + (features.bodyCenterY - neutral.bodyCenterY)),
    torsoAngle: clampSigned(features.torsoAngle - neutral.torsoAngle),
    headTilt: clampSigned(features.headTilt - neutral.headTilt),
  };
}

export function applyMovementSensitivity(features: MovementFeatures, sensitivity: number): MovementFeatures {
  const amount = Math.max(0, sensitivity);
  return {
    ...features,
    bodyCenterX: clamp01(0.5 + ((features.bodyCenterX - 0.5) * amount)),
    bodyCenterY: clamp01(0.5 + ((features.bodyCenterY - 0.5) * amount)),
    movementEnergy: clamp01(features.movementEnergy * amount),
    stillness: clamp01(1 - (features.movementEnergy * amount)),
    torsoAngle: clampSigned(features.torsoAngle * amount),
    headTilt: clampSigned(features.headTilt * amount),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampSigned(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
