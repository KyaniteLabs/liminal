/**
 * VoiceToShapeMapper — transforms audio frames into 3D shape parameters.
 *
 * Maps voice characteristics to sculptural geometry:
 * - energy → radius (louder = wider)
 * - pitch → height (higher = taller, semitone log scaling)
 * - beat impulse → radial bump (1.2x on onset)
 * - timbre warmth → roundness
 *
 * Ported from voice-to-sculpture-app physicsMapping.ts.
 */

export interface LatheProfile {
  /** Array of {height, radius} control points defining the silhouette */
  points: Array<{ height: number; radius: number }>;
  /** Radial symmetry fold count (3-12) */
  foldCount: number;
  /** Ripple amplitude (0-1) */
  rippleAmplitude: number;
}

export interface ShapeParams {
  /** Height of the shape in world units */
  height: number;
  /** Base radius */
  baseRadius: number;
  /** Profile control points */
  profile: LatheProfile;
  /** Surface roughness (0 = smooth, 1 = rough) */
  roughness: number;
}

/** Semitone ratio for pitch→height mapping */
const SEMITONE_RATIO = Math.pow(2, 1 / 12);

/** Minimum/maximum radius */
const MIN_RADIUS = 0.1;
const MAX_RADIUS = 2.0;

/** Minimum/maximum height */
const MIN_HEIGHT = 0.5;
const MAX_HEIGHT = 4.0;

/** Default number of profile points */
const DEFAULT_PROFILE_POINTS = 32;

/**
 * Map a single audio frame to shape parameters.
 *
 * @param rms - Root mean square amplitude (0-1)
 * @param frequency - Detected pitch frequency in Hz (0 if unpitched)
 * @param energy - Signal energy
 * @param warmth - Timbre warmth (0-1)
 * @param isOnset - Whether this frame contains an onset/beat
 */
export function mapVoiceToShape(
  rms: number,
  frequency: number,
  _energy: number,
  warmth: number = 0.5,
  isOnset: boolean = false,
): ShapeParams {
  // Base radius from energy/RMS (louder = wider)
  const energyNorm = Math.min(rms * 3, 1);
  const baseRadius = MIN_RADIUS + energyNorm * (MAX_RADIUS - MIN_RADIUS);

  // Height from pitch using semitone log scaling
  // Reference: A4 (440Hz) = 1.0 height multiplier
  let heightMultiplier = 1.0;
  if (frequency > 20) {
    const semitonesFromA4 = 12 * Math.log2(frequency / 440);
    heightMultiplier = Math.pow(SEMITONE_RATIO, semitonesFromA4);
    // Clamp to reasonable range (3 octaves down to 3 octaves up)
    heightMultiplier = Math.max(0.125, Math.min(8, heightMultiplier));
  }
  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, 1.5 * heightMultiplier));

  // Generate lathe profile
  const profile = generateLatheProfile(baseRadius, height, warmth, rms, isOnset);

  // Surface roughness from noisiness (inverse of warmth)
  const roughness = Math.max(0, 1 - warmth);

  return { height, baseRadius, profile, roughness };
}

/**
 * Generate a lathe profile (array of control points).
 * Uses sinusoidal modulation based on timbre and energy.
 */
function generateLatheProfile(
  baseRadius: number,
  height: number,
  warmth: number,
  rms: number,
  isOnset: boolean,
): LatheProfile {
  const points: Array<{ height: number; radius: number }> = [];
  const n = DEFAULT_PROFILE_POINTS;

  // Fold count from warmth (warm = rounder = fewer folds)
  const foldCount = Math.round(3 + warmth * 9); // 3-12

  // Ripple amplitude from energy
  const rippleAmplitude = Math.min(rms * 0.4, 0.3);

  // Onset impulse: temporary 1.2x radial bump
  const onsetBoost = isOnset ? 1.2 : 1.0;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 to 1 along height

    // Base profile: slight bulge in middle, tapered ends
    const envelope = Math.sin(t * Math.PI); // 0 at ends, 1 at middle

    // Warmth modulation: warmer = smoother, rounder profile
    const warmthMod = 1 - (1 - warmth) * 0.3 * Math.sin(t * Math.PI * 3);

    // Energy ripple: subtle waviness proportional to energy
    const ripple = rippleAmplitude * Math.sin(t * foldCount * Math.PI * 2);

    // Combine
    const radius = baseRadius * envelope * warmthMod * onsetBoost * (1 + ripple);

    points.push({
      height: t * height,
      radius: Math.max(MIN_RADIUS * 0.5, Math.min(MAX_RADIUS, radius)),
    });
  }

  return { points, foldCount, rippleAmplitude };
}

/**
 * Map a sequence of audio frames into a smoothed shape over time.
 * Useful for animating shape evolution during performance.
 */
export function mapVoiceToShapeSequence(
  frames: Array<{ rms: number; frequency: number; energy: number; warmth: number; isOnset: boolean }>,
  smoothing: number = 0.3,
): ShapeParams[] {
  const shapes: ShapeParams[] = [];
  let prevShape: ShapeParams | null = null;

  for (const frame of frames) {
    const raw = mapVoiceToShape(
      frame.rms,
      frame.frequency,
      frame.energy,
      frame.warmth,
      frame.isOnset,
    );

    // Exponential smoothing
    if (prevShape && smoothing > 0) {
      const s = smoothing;
      raw.height = prevShape.height * s + raw.height * (1 - s);
      raw.baseRadius = prevShape.baseRadius * s + raw.baseRadius * (1 - s);
      raw.roughness = prevShape.roughness * s + raw.roughness * (1 - s);
    }

    shapes.push(raw);
    prevShape = raw;
  }

  return shapes;
}
