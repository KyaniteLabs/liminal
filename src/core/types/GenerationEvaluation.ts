import type { LuminanceMeasure, LuminanceVerdict } from '../../render/LuminanceVerdict.js';

export type RenderMeasure = LuminanceMeasure & {
  verdict: LuminanceVerdict;
  /** True when the late frame measured non-ok while the first frame was ok —
   *  the animation decayed after capture (H13). */
  temporalDecay?: boolean;
};

export interface RenderEvidence {
  screenshotRef?: string;
  screenshot?: {
    mimeType: string;
    dataBase64: string;
    width?: number;
    height?: number;
  };
  /** Second capture late in the render window (H13): one frame is a single
   *  sample of a time-varying signal — the late frame is the steady state a
   *  viewer actually sees. */
  lateScreenshot?: {
    mimeType: string;
    dataBase64: string;
    width?: number;
    height?: number;
  };
  logRef?: string;
  audio?: {
    success: boolean;
    sampleRate?: number;
    durationSeconds?: number;
    peakAmplitude?: number;
    rmsAmplitude?: number;
    error?: string;
    warningCount?: number;
  };
  video?: {
    fps?: number;
    durationSeconds?: number;
  };
  timingMs: number;
  infraUnavailable: boolean;
  candidateFailure: boolean;
  renderMeasure?: RenderMeasure;
}

export interface ConcreteRepairAdvice {
  issue: string;
  fix: string;
  constraint: string;
}

export interface GenerationEvaluation {
  score: number;
  confidence: number;
  failureClass: 'none' | 'render' | 'validator' | 'scorer' | 'infra';
  repairAdvice?: ConcreteRepairAdvice;
  reasoning?: string;
  renderMeasure?: RenderMeasure;
}
