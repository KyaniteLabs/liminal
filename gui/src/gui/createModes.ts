export type CreateModeId =
  | 'auto'
  | 'p5'
  | 'three'
  | 'svg'
  | 'glsl'
  | 'hydra'
  | 'strudel'
  | 'tone'
  | 'hyperframes'
  | 'kinetic'
  | 'ascii'
  | 'text'
  | 'revideo'
  | 'organism';

export type WorkbenchExecutionMode = 'draft' | 'prove';

export interface CreateModeOption {
  id: CreateModeId;
  label: string;
  stageLabel: string;
  promptHint?: string;
}

export const CREATE_MODE_OPTIONS: CreateModeOption[] = [
  { id: 'auto', label: 'Auto', stageLabel: 'Automatic domain routing' },
  { id: 'p5', label: 'p5.js sketch', stageLabel: 'p5.js sketch', promptHint: 'Create a p5.js generative sketch.' },
  { id: 'three', label: 'Three.js scene', stageLabel: 'Three.js scene', promptHint: 'Create a Three.js 3D scene.' },
  { id: 'svg', label: 'SVG vector', stageLabel: 'SVG vector asset', promptHint: 'Create a raw SVG vector asset.' },
  { id: 'glsl', label: 'GLSL shader', stageLabel: 'GLSL fragment shader', promptHint: 'Create a GLSL fragment shader.' },
  { id: 'hydra', label: 'Hydra visual', stageLabel: 'Hydra video synth', promptHint: 'Create a Hydra video synth sketch.' },
  { id: 'strudel', label: 'Strudel music', stageLabel: 'Strudel music pattern', promptHint: 'Create a Strudel live-coding music pattern.' },
  { id: 'tone', label: 'Tone.js audio', stageLabel: 'Tone.js audio', promptHint: 'Create a Tone.js Web Audio sketch.' },
  { id: 'hyperframes', label: 'HyperFrames', stageLabel: 'HyperFrames composition', promptHint: 'Create a HyperFrames composition with HTML, CSS, GSAP timeline clips, data-composition-id, and window.__timelines registration.' },
  { id: 'kinetic', label: 'Kinetic type', stageLabel: 'CSS kinetic typography', promptHint: 'Create CSS kinetic typography as a complete animated HTML artifact.' },
  { id: 'ascii', label: 'ASCII art', stageLabel: 'ASCII art', promptHint: 'Create ASCII art.' },
  { id: 'text', label: 'Text art', stageLabel: 'Text generative art', promptHint: 'Create concrete poetry or text generative art.' },
  { id: 'revideo', label: 'Revideo', stageLabel: 'Revideo composition', promptHint: 'Create a Revideo composition.' },
  { id: 'organism', label: 'Organism (Strudel + Hydra)', stageLabel: 'Strudel + Hydra organism' },
];

export function getCreateModeOption(mode: string): CreateModeOption {
  return CREATE_MODE_OPTIONS.find((option) => option.id === mode) ?? CREATE_MODE_OPTIONS[0];
}

export function detectPromptCreateMode(prompt: string): CreateModeId | null {
  const lower = prompt.toLowerCase();
  if (/\bhydra\b|\bvideo synth\b/.test(lower)) return 'hydra';
  if (/\brevideo\b|\bvideo\b|\btimeline\b|\bmp4\b|\bmotion graphics?\b|\brender video\b|\bshot sequence\b|\bstoryboard\b/.test(lower)) return 'revideo';
  if (/\btone(?:\.js)?\b|\bweb audio\b|\bsynth\b/.test(lower)) return 'tone';
  if (/\bstrudel\b|\blive coding\b/.test(lower)) return 'strudel';
  if (/\bthree(?:\.js)?\b|\b3d\b|\bwebgl scene\b/.test(lower)) return 'three';
  if (/\bglsl\b|\bfragment shader\b|\bshader\b/.test(lower)) return 'glsl';
  if (/\bkinetic\b|\bkinetic typography\b|\bmoving typography\b|\banimated text\b/.test(lower)) return 'kinetic';
  if (/\bhyperframes?\b|\b(promo|trailer|slideshow|title\s*card|subtitle|caption|social\s*media)\b|\bhtml\b|\bcss\b/.test(lower)) return 'hyperframes';
  if (/\bsvg\b|\bvector\b/.test(lower)) return 'svg';
  if (/\bp5(?:\.js)?\b|\bcreative coding sketch\b/.test(lower)) return 'p5';
  if (/\bascii\b/.test(lower)) return 'ascii';
  return null;
}

export function buildWorkbenchPrompt(mode: CreateModeId, prompt: string): string {
  const trimmed = prompt.trim();
  const promptMode = detectPromptCreateMode(trimmed);
  const option = getCreateModeOption(promptMode ?? mode);
  if (!trimmed || !option.promptHint) return trimmed;
  return `${option.promptHint}\n\nUser prompt: ${trimmed}`;
}

export function usesOrganismApi(mode: CreateModeId): boolean {
  return mode === 'organism';
}

export function requiresBridgeSession(mode: CreateModeId): boolean {
  return !usesOrganismApi(mode);
}

export function buildWorkbenchRunOptions(executionMode: WorkbenchExecutionMode, maxIterations: number) {
  return buildWorkbenchRunOptionsForMode(executionMode, maxIterations, 'auto');
}

export function buildWorkbenchRunOptionsForMode(executionMode: WorkbenchExecutionMode, maxIterations: number, mode: CreateModeId) {
  const slowerDraftModes: CreateModeId[] = ['hydra', 'strudel', 'tone', 'revideo', 'hyperframes'];
  if (executionMode === 'draft') {
    return {
      executionMode: 'draft' as const,
      maxIterations: 1,
      candidateCount: 1,
      timeoutMinutes: slowerDraftModes.includes(mode) ? 3 : 1,
    };
  }

  return {
    executionMode: 'prove' as const,
    maxIterations,
    candidateCount: 1,
    timeoutMinutes: 3,
  };
}
