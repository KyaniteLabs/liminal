export const HUMAN_PERCEPTION_LAYER = 'human-perception' as const;
export const MAX_SAFE_FLICKER_HZ = 3;
export const HUMAN_AUDIBLE_RANGE_HZ = { min: 20, max: 20_000 } as const;
export const USEFUL_TEMPO_BPM_RANGE = { min: 30, max: 300 } as const;
export const USEFUL_FRAME_RATE_RANGE = { min: 12, max: 120 } as const;
export const MIN_LEGIBLE_CONTRAST_RATIO = 3;
export const MIN_CAPTION_SECONDS = 1.5;
export const MIN_LEGIBLE_FONT_SIZE_PX = 10;
export const MAX_COMFORTABLE_LINE_LENGTH = 100;

export type PerceptionSeverity = 'info' | 'warning' | 'error';
export type HumanPerceptionKind = 'visual' | 'audio' | 'text' | 'video';

export interface PerceptionIssue {
  id: string;
  message: string;
  severity: PerceptionSeverity;
  domain?: HumanPerceptionKind;
  metric?: string;
  value?: number | boolean | string;
}

export interface PerceptionCheckResult {
  layer: typeof HUMAN_PERCEPTION_LAYER;
  passed: boolean;
  issues: PerceptionIssue[];
}

export interface HumanPerceptionInputBase {
  kind: HumanPerceptionKind;
  userIntent?: string;
}

export interface VisualPerceptionInput extends HumanPerceptionInputBase {
  kind: 'visual';
  hasVisibleContent?: boolean;
  contrastRatio?: number;
  frameRate?: number;
  flickerHz?: number;
  motionHz?: number;
}

export interface AudioPerceptionInput extends HumanPerceptionInputBase {
  kind: 'audio';
  frequencyHz?: number;
  minFrequencyHz?: number;
  maxFrequencyHz?: number;
  tempoBpm?: number;
  peakAmplitude?: number;
  isSilent?: boolean;
  allowSilence?: boolean;
}

export interface TextPerceptionInput extends HumanPerceptionInputBase {
  kind: 'text';
  text?: string;
  contrastRatio?: number;
  fontSizePx?: number;
  lineLength?: number;
  captionSeconds?: number;
}

export interface VideoPerceptionInput extends HumanPerceptionInputBase {
  kind: 'video';
  hasVisibleFrames?: boolean;
  fps?: number;
  durationSeconds?: number;
  flickerHz?: number;
  captionSeconds?: number;
}

export type HumanPerceptionInput =
  | VisualPerceptionInput
  | AudioPerceptionInput
  | TextPerceptionInput
  | VideoPerceptionInput;
