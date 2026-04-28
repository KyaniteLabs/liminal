// Core session types
export interface CreativeSession {
  id: string;
  startedAt: Date;
  userId?: string;
  brief?: CreativeBrief;
  iterations: Iteration[];
  status: 'active' | 'paused' | 'completed';
}

export interface Session {
  sessionId: string;
  createdAt: Date;
  messages: ConversationMessage[];
  metadata?: Record<string, unknown>;
}

// Conversation & Episodes
export interface Episode {
  id: string;
  timestamp: Date;
  type: 'conversation' | 'generation' | 'feedback';
  content: unknown;
}

export interface Conversation {
  id: string;
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Interview
export interface InterviewQuestion {
  id: string;
  phase: 'greeting' | 'discovery' | 'confirm' | 'generating';
  question: string;
  type: 'text' | 'choice' | 'multiple';
  options?: string[];
  required: boolean;
}

export interface Reference {
  type: 'past-work' | 'external' | 'artist' | 'technique';
  id: string;
  description: string;
}

// Parameters & Iterations
export interface Parameter {
  name: string;
  value: number | string | boolean;
  type: 'slider' | 'toggle' | 'select' | 'text';
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface Iteration {
  version: number;
  code: string;
  domain: Domain;
  score?: number;
  timestamp: Date;
  parameters?: Record<string, unknown>;
  diffFromPrevious?: string;
}

// Generation Context
export interface GenerationContext {
  prompt: string;
  domain: Domain;
  techniques: Technique[];
  constraints: string[];
  references: Reference[];
  /** Current iteration number */
  iteration: number;
  /** Current quality score (0-1) */
  currentScore: number;
}

export interface Suggestion {
  type: 'technique' | 'parameter' | 'swarm' | 'compost' | 'archive' | 'evolution';
  title: string;
  description: string;
  action?: () => Promise<unknown>;
  priority: 'low' | 'medium' | 'high';
}

// Domain & Technique (types)
export type Domain = 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel' | 'revideo';

export interface Technique {
  name: string;
  domain: Domain;
  description: string;
  keywords: string[];
}

// Creative Brief (from interview)
export interface CreativeBrief {
  // From interview
  intent: string;
  context: string;
  mood: string;
  constraints: string[];
  references: Reference[];

  // Inferred by Liminal
  domain: Domain;
  techniques: Technique[];
  complexity: 'simple' | 'medium' | 'complex';

  // Generation strategy
  /** @deprecated Use swarm.enabled instead */
  useSwarm?: boolean;
  /** New nested swarm options (preferred over useSwarm) */
  swarm?: import('../types/options/SwarmOptions.js').SwarmOptions;
  useArchiveLearning?: boolean;
  useCompostSeeds?: boolean;
}
