import type { SingPresetArtifact, SingRawMapping, SemanticChannel, SingMappingCurve, SingVoiceFeature } from '@sinter/audio-core/PresetSchema.js';
import type { SemanticVisualState } from '@sinter/audio-core/SemanticMapper.js';
import { DEFAULT_SEMANTIC_MAPPINGS } from '@sinter/audio-core/defaultMapping.js';
import { OneEuroFilter } from '@sinter/audio-core/dsp/OneEuroFilter.js';

export interface SingUniformFrame {
  rms: number;
  pitchHz: number;
  centroid: number;
  spectralFlux: number;
  onset: number;
  voiced: number;
  confidence: number;
  elapsedSeconds: number;
  movementEnergy?: number;
  movementX?: number;
  movementY?: number;
  distanceToCamera?: number;
  /** Semantic visual state (palette/form/motion/...) for semantic-bound uniforms. */
  semantic?: SemanticVisualState;
}

const DEFAULT_SEMANTIC_SMOOTHING = 0.6;

export interface SingRenderer {
  render(frame: SingUniformFrame): void;
  resize(): void;
  dispose(): void;
}

const DEFAULT_UNIFORM_VALUES = {
  u_rms: (frame: SingUniformFrame) => frame.rms,
  u_pitch: (frame: SingUniformFrame) => frame.pitchHz,
  u_centroid: (frame: SingUniformFrame) => frame.centroid,
  u_flux: (frame: SingUniformFrame) => frame.spectralFlux,
  u_onset: (frame: SingUniformFrame) => frame.onset,
  u_voiced: (frame: SingUniformFrame) => frame.voiced,
  u_confidence: (frame: SingUniformFrame) => frame.confidence,
  u_movement: (frame: SingUniformFrame) => frame.movementEnergy ?? 0,
  u_movement_x: (frame: SingUniformFrame) => frame.movementX ?? 0.5,
  u_movement_y: (frame: SingUniformFrame) => frame.movementY ?? 0.5,
  u_distance: (frame: SingUniformFrame) => frame.distanceToCamera ?? 0,
} as const;

const DEFAULT_MAPPING_SMOOTHING: Record<SingVoiceFeature, number> = {
  rms: 0.72,
  pitchHz: 0.84,
  centroid: 0.8,
  spectralFlux: 0.88,
  onset: 0.45,
  voiced: 0.65,
};

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export interface SingStabilizer {
  /** Condition one raw frame into a stable, visual-ready frame. */
  stabilize(frame: SingUniformFrame): SingUniformFrame;
  /** Clear filter state (call when a new session starts). */
  reset(): void;
}

/**
 * Stateful frame conditioner using per-feature One-Euro filters (low lag on
 * fast change, smooth at rest) instead of the previous fixed-EMA smoothing.
 * Keeps the pitch-hold-on-unvoiced behavior and the onset decay envelope.
 */
export function createSingStabilizer(): SingStabilizer {
  let rmsFilter = new OneEuroFilter({ minCutoff: 1.2, beta: 0.02 });
  let centroidFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
  let fluxFilter = new OneEuroFilter({ minCutoff: 1.5, beta: 0.05 });
  let pitchFilter = new OneEuroFilter({ minCutoff: 0.8, beta: 0.01 });
  let prevPitch = 0;
  let prevOnset = 0;

  function stabilize(frame: SingUniformFrame): SingUniformFrame {
    const tMs = frame.elapsedSeconds * 1000;
    const rms = rmsFilter.filter(normalizeRange(frame.rms, 0.015, 0.16), tMs);
    const centroid = centroidFilter.filter(clamp01(frame.centroid), tMs);
    const spectralFlux = fluxFilter.filter(normalizeRange(frame.spectralFlux, 0.001, 0.025), tMs);
    const voiced = clamp01(frame.voiced);
    const confidence = clamp01(frame.confidence);
    const pitchTarget = frame.pitchHz > 0 && (voiced > 0.2 || confidence > 0.08)
      ? frame.pitchHz
      : prevPitch;
    const pitchHz = pitchTarget > 0 ? pitchFilter.filter(pitchTarget, tMs) : 0;
    prevPitch = pitchTarget;
    const onset = frame.onset > 0.5 ? 1 : Math.max(0, prevOnset * 0.82);
    prevOnset = onset;

    return { ...frame, rms, pitchHz, centroid, spectralFlux, onset, voiced, confidence };
  }

  function reset(): void {
    rmsFilter = new OneEuroFilter({ minCutoff: 1.2, beta: 0.02 });
    centroidFilter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
    fluxFilter = new OneEuroFilter({ minCutoff: 1.5, beta: 0.05 });
    pitchFilter = new OneEuroFilter({ minCutoff: 0.8, beta: 0.01 });
    prevPitch = 0;
    prevOnset = 0;
  }

  return { stabilize, reset };
}

export function createSingRenderer(canvas: HTMLCanvasElement, preset: SingPresetArtifact): SingRenderer {
  const context = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!context) throw new Error('WebGL is required for Sing');
  const gl: WebGLRenderingContext = context;

  const program = createProgram(gl, VERTEX_SHADER, preset.shader.source);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const uniformLocations = new Map<string, WebGLUniformLocation | null>();
  const mappedTargets = new Set([
    ...Object.keys(DEFAULT_UNIFORM_VALUES),
    ...DEFAULT_SEMANTIC_MAPPINGS.map((mapping) => mapping.target),
    ...preset.mappings.map((mapping) => mapping.target),
  ]);
  for (const target of mappedTargets) {
    uniformLocations.set(target, gl.getUniformLocation(program, target));
  }
  const uniformSmoothers = new Map<string, OneEuroFilter>();

  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Unable to create Sing vertex buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  function resize(): void {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(frame: SingUniformFrame): void {
    resize();
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, frame.elapsedSeconds);
    const uniformValues = mapSingPresetUniforms(preset, frame, undefined, uniformSmoothers);
    for (const [target, value] of uniformValues) {
      const location = uniformLocations.get(target);
      if (location) gl.uniform1f(location, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function dispose(): void {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }

  resize();
  return { render, resize, dispose };
}

export function mapSingPresetUniforms(
  preset: Pick<SingPresetArtifact, 'mappings'>,
  frame: SingUniformFrame,
  previousValues: ReadonlyMap<string, number> = new Map(),
  smoothers?: Map<string, OneEuroFilter>,
): Map<string, number> {
  const values = new Map<string, number>();
  for (const [target, readValue] of Object.entries(DEFAULT_UNIFORM_VALUES)) {
    values.set(target, readValue(frame));
  }
  // Merge the default semantic vocabulary for any uniform the preset doesn't map.
  const explicitTargets = new Set(preset.mappings.map((m) => m.target));
  const mappings = [
    ...preset.mappings,
    ...DEFAULT_SEMANTIC_MAPPINGS.filter((m) => !explicitTargets.has(m.target)),
  ];
  for (const mapping of mappings) {
    let mapped: number;
    let smoothing: number;
    if (mapping.source === 'semantic') {
      const channelValue = frame.semantic ? readSemanticChannel(frame.semantic, mapping.channel) : 0;
      mapped = curveValue(clamp01(channelValue), mapping.curve ?? 'linear');
      smoothing = mapping.smoothing ?? DEFAULT_SEMANTIC_SMOOTHING;
    } else {
      mapped = applyMappingCurve(featureValue(frame, mapping.feature), mapping);
      smoothing = mapping.smoothing ?? DEFAULT_MAPPING_SMOOTHING[mapping.feature];
    }
    if (smoothers) {
      let filter = smoothers.get(mapping.target);
      if (!filter) {
        filter = new OneEuroFilter({ minCutoff: 1.0, beta: 0.02 });
        smoothers.set(mapping.target, filter);
      }
      values.set(mapping.target, filter.filter(mapped, frame.elapsedSeconds * 1000));
    } else {
      const previous = previousValues.get(mapping.target);
      values.set(mapping.target, smoothUniformValue(mapped, previous, smoothing));
    }
  }
  return values;
}

function readSemanticChannel(state: SemanticVisualState, channel: SemanticChannel): number {
  const [group, key] = channel.split('.') as [keyof SemanticVisualState, string];
  const section = state[group] as Record<string, number> | undefined;
  const value = section?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function featureValue(frame: SingUniformFrame, feature: SingVoiceFeature): number {
  switch (feature) {
    case 'rms':
      return frame.rms;
    case 'pitchHz':
      return frame.pitchHz;
    case 'centroid':
      return frame.centroid;
    case 'spectralFlux':
      return frame.spectralFlux;
    case 'onset':
      return frame.onset;
    case 'voiced':
      return frame.voiced;
  }
}

function applyMappingCurve(value: number, mapping: SingRawMapping): number {
  const span = mapping.max - mapping.min;
  if (span === 0) return mapping.min;
  const normalized = clamp01((value - mapping.min) / span);
  const curved = curveValue(normalized, mapping.curve);
  return mapping.min + curved * span;
}

function curveValue(value: number, curve: SingMappingCurve): number {
  switch (curve) {
    case 'easeIn':
      return value * value;
    case 'easeOut':
      return 1 - ((1 - value) * (1 - value));
    case 'exponential':
      return value * value * value;
    case 'step':
      return value >= 0.5 ? 1 : 0;
    case 'linear':
      return value;
  }
}

function smoothUniformValue(value: number, previous: number | undefined, smoothing = 0): number {
  if (previous === undefined) return value;
  const amount = clamp01(smoothing);
  return previous * amount + value * (1 - amount);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeRange(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  return clamp01((value - min) / span);
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create Sing shader program');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`Sing shader link failed: ${info}`);
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create Sing shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`Sing shader compile failed: ${info}`);
  }
  return shader;
}
