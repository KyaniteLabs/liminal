export interface StudioSingPreset {
  schemaVersion: 1;
  instrument: 'sing';
  id: string;
  name: string;
  createdAt: string;
  shader: {
    language: 'glsl-fragment';
    source: string;
  };
  mappings: Array<{
    feature: 'rms' | 'pitchHz' | 'centroid' | 'spectralFlux' | 'onset' | 'voiced';
    target: string;
    curve: 'linear' | 'easeIn' | 'easeOut' | 'exponential' | 'step';
    min: number;
    max: number;
    smoothing: number;
  }>;
  metadata: Record<string, unknown>;
}

export const STUDIO_SING_MAPPINGS: StudioSingPreset['mappings'] = [
  { feature: 'rms', target: 'u_rms', curve: 'easeOut', min: 0, max: 1, smoothing: 0.72 },
  { feature: 'pitchHz', target: 'u_pitch', curve: 'linear', min: 80, max: 900, smoothing: 0.84 },
  { feature: 'centroid', target: 'u_centroid', curve: 'linear', min: 0, max: 1, smoothing: 0.8 },
  { feature: 'spectralFlux', target: 'u_flux', curve: 'easeIn', min: 0, max: 1, smoothing: 0.88 },
  { feature: 'onset', target: 'u_onset', curve: 'step', min: 0, max: 1, smoothing: 0.45 },
  { feature: 'voiced', target: 'u_voiced', curve: 'step', min: 0, max: 1, smoothing: 0.65 },
];

export function selectCurrentSingShader(input: { currentCode?: string | null; archiveCode?: string | null }): string | null {
  const current = input.currentCode?.trim();
  if (!current || !isLikelyGlslFragment(current)) return null;
  return current;
}

export function buildStudioSingPreset(input: { source: string; prompt: string; now?: Date }): StudioSingPreset {
  const now = input.now ?? new Date();
  return {
    schemaVersion: 1,
    instrument: 'sing',
    id: `studio-${now.getTime()}`,
    name: input.prompt.trim() || 'Studio Sing Preset',
    createdAt: now.toISOString(),
    shader: {
      language: 'glsl-fragment',
      source: input.source,
    },
    mappings: STUDIO_SING_MAPPINGS.map((mapping) => ({ ...mapping })),
    metadata: {
      origin: 'liminal-studio',
      prompt: input.prompt,
    },
  };
}

export function buildSingPresetDataUrl(preset: StudioSingPreset): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(preset))}`;
}

export function buildSingInstrumentUrl(preset: StudioSingPreset, baseUrl = 'http://127.0.0.1:5176/'): string {
  const url = new URL(baseUrl);
  url.searchParams.set('preset', buildSingPresetDataUrl(preset));
  return url.toString();
}

function isLikelyGlslFragment(source: string): boolean {
  if (/<\/?[a-z][\s\S]*>/i.test(source)) return false;
  if (/\bfunction\s+setup\s*\(|\bnew\s+THREE\.|\bosc\s*\(|\bshape\s*\(/.test(source)) return false;
  return /\bvoid\s+main\s*\(/.test(source) && /\b(gl_FragColor|fragColor|out\s+vec4)\b/.test(source);
}
