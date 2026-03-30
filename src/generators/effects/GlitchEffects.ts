/**
 * GlitchEffects — Generates p5.js code strings that apply glitch visual effects.
 *
 * Uses pixel manipulation techniques: scanline offsets, chromatic aberration via
 * channel shifting, sine-based geometric distortion, and noise injection.
 */

/** Parameters that control glitch intensity and which effects are active. */
export interface GlitchParams {
  /** Overall intensity multiplier (0–1). */
  intensity: number;
  /** Seed for deterministic randomness. */
  seed: number;
  /** Enable horizontal scanline offset. */
  scanlines: boolean;
  /** Enable colour-channel shifting. */
  chromaticAberration: boolean;
  /** Enable sine-wave geometric distortion. */
  distortion: boolean;
  /** Enable random noise injection. */
  noise: boolean;
}

/**
 * Generate a self-contained p5.js sketch string that applies glitch effects
 * to the canvas content.
 *
 * The returned code defines a function `applyGlitch(p, intensity, seed)` that
 * mutates the current pixel buffer in place.
 *
 * @param params - Glitch configuration.
 * @returns A p5.js code string.
 */
export function generateGlitchCode(params: GlitchParams): string {
  const { intensity, seed, scanlines, chromaticAberration, distortion, noise } =
    params;

  const clampIntensity = Math.max(0, Math.min(1, intensity));

  // Build conditional blocks for each effect.
  const scanlineBlock = scanlines
    ? `
    // --- Scanline offset ---
    if (y % scanlineSpacing === 0) {
      const offset = Math.floor(seededRandom() * maxOffset * 2 - maxOffset);
      for (let x = 0; x < img.width; x++) {
        const srcX = Math.min(Math.max(x + offset, 0), img.width - 1);
        const dstIdx = (y * img.width + x) * 4;
        const srcIdx = (y * img.width + srcX) * 4;
        pixels[dstIdx]     = pixels[srcIdx];
        pixels[dstIdx + 1] = pixels[srcIdx + 1];
        pixels[dstIdx + 2] = pixels[srcIdx + 2];
        pixels[dstIdx + 3] = pixels[srcIdx + 3];
      }
    }`
    : '';

  const chromaticBlock = chromaticAberration
    ? `
    // --- Chromatic aberration ---
    if (x >= channelShift && x < img.width - channelShift) {
      const rIdx = (y * img.width + (x - channelShift)) * 4;
      const bIdx = (y * img.width + (x + channelShift)) * 4;
      const curIdx = (y * img.width + x) * 4;
      pixels[curIdx]     = pixels[rIdx];       // red from left
      pixels[curIdx + 2] = pixels[bIdx + 2];   // blue from right
    }`
    : '';

  const distortionBlock = distortion
    ? `
    // --- Sine-based distortion ---
    {
      const distortionAmount = Math.floor(${clampIntensity} * 20);
      const srcX = Math.min(Math.max(x + Math.floor(Math.sin(y * 0.05 + seed * 0.1) * distortionAmount), 0), img.width - 1);
      const srcIdx = (y * img.width + srcX) * 4;
      const dstIdx = (y * img.width + x) * 4;
      pixels[dstIdx]     = pixels[srcIdx];
      pixels[dstIdx + 1] = pixels[srcIdx + 1];
      pixels[dstIdx + 2] = pixels[srcIdx + 2];
      pixels[dstIdx + 3] = pixels[srcIdx + 3];
    }`
    : '';

  const noiseBlock = noise
    ? `
    // --- Noise injection ---
    if (seededRandom() < noiseProbability) {
      const idx = (y * img.width + x) * 4;
      pixels[idx]     = Math.floor(seededRandom() * 256);
      pixels[idx + 1] = Math.floor(seededRandom() * 256);
      pixels[idx + 2] = Math.floor(seededRandom() * 256);
    }`
    : '';

  // Assemble the full sketch code.
  return `
// Glitch effect sketch — auto-generated
// Intensity: ${clampIntensity}, Seed: ${seed}
// Effects: ${[scanlines && 'scanlines', chromaticAberration && 'chromaticAberration', distortion && 'distortion', noise && 'noise'].filter(Boolean).join(', ')}

function applyGlitch(p) {
  const intensity = ${clampIntensity};
  const seed = ${seed};

  const img = p.get();          // capture current canvas as image
  img.loadPixels();
  const pixels = img.pixels;

  // Deterministic PRNG (mulberry32)
  let hash = seed;
  function seededRandom() {
    hash |= 0;
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const maxOffset = Math.floor(intensity * 50);
  const scanlineSpacing = Math.max(2, Math.floor(6 - intensity * 4));
  const channelShift = Math.floor(intensity * 8);
  const noiseProbability = intensity * 0.08;

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      ${scanlineBlock}
      ${chromaticBlock}
      ${distortionBlock}
      ${noiseBlock}
    }
  }

  img.updatePixels();
  p.image(img, 0, 0);
}

// Usage inside draw():
// applyGlitch(this);
`.trimStart();
}
