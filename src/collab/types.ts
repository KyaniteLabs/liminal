/**
 * Shared types for collaboration layer
 */

/**
 * Specialized roles for models in deep collaboration
 */
export enum CollaborationRole {
  CREATOR = 'creator',
  VISIONARY = 'visionary',
  TECHNICAL_CRITIC = 'technical',
  ARTISTIC_CRITIC = 'artistic',
  DOMAIN_EXPERT = 'domain',
  INTEGRATOR = 'integrator',
  REFINER = 'refiner',
}

/**
 * Phases of the deep collaboration process
 */
export enum CollaborationPhase {
  DIVERGENCE = 'divergence',
  ANALYSIS = 'analysis',
  SYNTHESIS = 'synthesis',
  ITERATION = 'iteration',
}

/**
 * Analysis result from a critic
 */
export interface Analysis {
  role: CollaborationRole;
  content: string;
  strengths?: string[];
  weaknesses?: string[];
  suggestions?: string[];
  score?: number;
}

/**
 * Synthesis of multiple outputs
 */
export interface Synthesis {
  content: string;
  sourceExplanation: string;
  improvements?: string[];
}

/**
 * Results from one collaboration phase
 */
export interface PhaseResult {
  phaseName: string;
  outputs: Record<string, string>;
  analyses?: Analysis[];
  synthesis?: Synthesis;
  durationSeconds: number;
}

/**
 * Configuration for deep collaboration
 */
export interface DeepCollaborationConfig {
  /** Local model URL (e.g., LM Studio) */
  localBaseUrl?: string;
  /** Local model name */
  localModel?: string;
  /** Cloud API key */
  cloudApiKey?: string;
  /** Cloud model name */
  cloudModel?: string;
  /** Cloud API base URL */
  cloudBaseUrl?: string;
  /** Maximum collaboration phases (rounds) */
  maxPhases?: number;
  /** Number of critic analyses per phase */
  criticsPerPhase?: number;
  /** Stop when quality reaches this threshold */
  convergenceThreshold?: number;
  /** LLM caller function */
  callLLM: (prompt: string, systemPrompt?: string) => Promise<string>;
}

/**
 * Result from deep collaboration session
 */
export interface DeepCollaborationResult {
  finalOutput: string;
  phases: PhaseResult[];
  totalDurationSeconds: number;
  qualityScore: number;
  improvementTrajectory: number[];
  metadata: {
    converged: boolean;
    totalPhases: number;
    improvement: number;
  };
}

/**
 * Configuration for simpler 2-model collaboration
 */
export interface CollaborativeConfig {
  /** Cloud API key */
  cloudApiKey?: string;
  /** Cloud model name */
  cloudModel?: string;
  /** Maximum collaboration rounds */
  maxRounds?: number;
  /** Stop when quality reaches this threshold */
  convergenceThreshold?: number;
  /** LLM caller function */
  callLLM: (prompt: string, systemPrompt?: string) => Promise<string>;
}

/**
 * Results from one round of 2-model collaboration
 */
export interface CollaborationRound {
  roundNum: number;
  localOutput: string;
  cloudOutput: string;
  localAnalysisOfCloud?: string;
  cloudAnalysisOfLocal?: string;
  localRefined?: string;
  cloudRefined?: string;
  bestOutput?: string;
  scores?: Record<number, number>;
}

/**
 * Final result from 2-model collaborative session
 */
export interface CollaborativeResult {
  finalOutput: string;
  source: 'local' | 'cloud' | 'collaborative';
  rounds: CollaborationRound[];
  totalDurationSeconds: number;
  qualityScore: number;
  metadata: {
    bestRound: number;
    totalOutputsGenerated: number;
    converged: boolean;
  };
}

/**
 * Progress callback data for phase updates
 */
export interface PhaseUpdate {
  phaseName: string;
  model: string;
  action: string;
  output?: string;
  quality?: number;
  duration?: number;
}

/**
 * Domain-specific configuration
 */
export type DomainType =
  | 'ascii'
  | 'music'
  | 'code'
  | 'p5'
  | 'glsl'
  | 'three'
  | 'remotion'
  | 'shader'
  | 'hydra'
  | 'tone'
  | 'strudel'
  | 'html'
  | 'video'
  | 'textgen'
  | '';
