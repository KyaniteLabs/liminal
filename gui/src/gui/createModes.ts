export type CreateModeId =
  | 'auto'
  | 'p5'
  | 'three'
  | 'svg'
  | 'glsl'
  | 'hydra'
  | 'strudel'
  | 'tone'
  | 'html'
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
  { id: 'html', label: 'HTML/CSS', stageLabel: 'HTML/CSS artifact', promptHint: 'Create an HTML/CSS web artifact.' },
  { id: 'ascii', label: 'ASCII art', stageLabel: 'ASCII art', promptHint: 'Create ASCII art.' },
  { id: 'text', label: 'Text art', stageLabel: 'Text generative art', promptHint: 'Create concrete poetry or text generative art.' },
  { id: 'revideo', label: 'Revideo', stageLabel: 'Revideo composition', promptHint: 'Create a Revideo composition.' },
  { id: 'organism', label: 'Organism (Strudel + Hydra)', stageLabel: 'Strudel + Hydra organism' },
];

export function getCreateModeOption(mode: string): CreateModeOption {
  return CREATE_MODE_OPTIONS.find((option) => option.id === mode) ?? CREATE_MODE_OPTIONS[0];
}

export function buildWorkbenchPrompt(mode: CreateModeId, prompt: string): string {
  const trimmed = prompt.trim();
  const option = getCreateModeOption(mode);
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
  if (executionMode === 'draft') {
    return {
      executionMode: 'draft' as const,
      maxIterations: 1,
      candidateCount: 1,
      timeoutMinutes: 1,
    };
  }

  return {
    executionMode: 'prove' as const,
    maxIterations,
    candidateCount: 1,
    timeoutMinutes: 3,
  };
}
