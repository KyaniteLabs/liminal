/**
 * Derive generator params from a prompt string.
 * Used when calling ParticleSystem.generate() or CellularAutomata.generate()
 * so that prompt keywords (e.g. "blue", "calm", "fast") influence palette, speed, etc.
 *
 * Returns an object with at least one key accepted by the generators.
 * Merge with defaults at call site: ParticleSystem.generate({ ...defaults, ...promptToGeneratorParams(prompt) })
 */
export function promptToGeneratorParams(prompt: string): Record<string, unknown> {
  const p = (typeof prompt === 'string' ? prompt : String(prompt)).toLowerCase();
  const params: Record<string, unknown> = {};

  // Palette: ParticleSystem uses 'warm' | 'cool' | 'monochrome' | 'default'; CellularAutomata uses palette string
  if (/\b(blue|cyan|purple|ocean|cold)\b/.test(p)) {
    params.palette = 'cool';
  } else if (/\b(red|orange|yellow|warm|fire)\b/.test(p)) {
    params.palette = 'warm';
  } else if (/\b(black|white|gray|grey|monochrome)\b/.test(p)) {
    params.palette = 'monochrome';
  }

  // Speed / calm / fast: ParticleSystem has speed (number); CellularAutomata has timeStep
  if (/\b(calm|slow|peaceful|gentle)\b/.test(p)) {
    params.speed = 0.8;
    params.timeStep = 0.05;
  } else if (/\b(fast|rapid|energetic)\b/.test(p)) {
    params.speed = 4;
    params.timeStep = 0.2;
  }

  // Flow field specific params
  if (/\b(flow\s*field|particles?\s+flow)\b/.test(p)) {
    params.particleCount = 500;
    params.scale = 0.005;
    params.trailAlpha = 10;
  }

  // Ensure we always return at least one key so callers can rely on it
  if (Object.keys(params).length === 0) {
    params.palette = 'default';
  }

  return params;
}
