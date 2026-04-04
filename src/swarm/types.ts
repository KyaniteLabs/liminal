export interface SwarmPersona {
  id: string;
  name: string;
  displayName: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  voice: string;
  thinkingStyle: string;
  votingBias: string;
  constraints: string[];
  votingPower: number;
}

export enum SwarmMode {
  COMPETITIVE = 'competitive',
  HYBRID = 'hybrid',
  RING = 'ring',
  MESH = 'mesh',
}

export interface SwarmConfig {
  ollamaHost: string;
  ollamaTimeout: number;
  maxRounds: number;
  convergenceThreshold: number;
  musicalChairs: boolean;
  mode: SwarmMode;
  personas: SwarmPersona[];
  refinementConstraints: string[];
  streamDir: string;
  /** Skip expert routing and use configured personas directly (useful for testing) */
  skipRouting?: boolean;
}

export interface SwarmOutput {
  personaId: string;
  personaName: string;
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  roundNum: number;
}

export interface Vote {
  voterId: string;
  firstChoice: string;
  secondChoice: string;
  reasoning: string;
}

export interface RoundResult {
  roundNum: number;
  seed: string;
  outputs: Map<string, SwarmOutput>;
  votes: Map<string, Vote>;
  scores: Map<string, number>;
  winnerId: string | null;
  winnerContent: string;
  constraint: string;
}

export interface SwarmResult {
  rounds: RoundResult[];
  converged: boolean;
  convergenceRound: number | null;
  finalOutput: string;
  totalDurationMs: number;
  mode: SwarmMode;
  allOutputs: SwarmOutput[];
}

export interface MinedFragment {
  id: string;
  text: string;
  source: string;
  round: number;
  persona: string;
  score: number;
  mode: string;
  tags: string[];
  sessionPrompt: string;
  extractedAt: string;
}

/** Default refinement constraints used across swarm rounds. */
export const DEFAULT_REFINEMENT_CONSTRAINTS: string[] = [
  'Add more spectral imagery',
  'Deconstruct the physical form',
  'Focus on the sound of the machine',
  'Introduce a paradox of memory',
];
