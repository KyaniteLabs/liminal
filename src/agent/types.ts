/**
 * StudioAgent Types — Phase 11
 *
 * Pure type definitions for the foreground conversational agent.
 * These types are the integration contract between StudioAgent,
 * IntentRouter, ResponseComposer, and the TUI bridge.
 *
 * No imports from other agent modules. This file owns the boundaries.
 */

// ── Intent Classification ──

/** The four paths a user request can take */
export type IntentType = 'direct' | 'creative' | 'engineering' | 'hybrid';

/** Confidence level for intent classification */
export type IntentConfidence = 'high' | 'medium' | 'low';

/** Result of classifying a user's input */
export interface IntentClassification {
  /** Which execution path to take */
  intent: IntentType;
  /** How confident the router is */
  confidence: IntentConfidence;
  /** Extracted topic if detectable (e.g. "p5 seed", "test coverage") */
  topic?: string;
  /** Original input that was classified */
  input: string;
}

// ── Delegation ──

/** Where the agent delegates work to */
export type DelegationTarget =
  | 'llm-chat'        // Direct conversational response
  | 'ralph-loop'      // Creative generation via RalphLoop
  | 'engineering-delegate' // Engineering work via the injected delegate boundary
  | 'engineering-agent' // Engineering work via the TUI bridge engineering lane
  | 'conveyor'        // Legacy label for ConveyorRunner-backed integrations
  | 'conveyor-verify' // Verify a specific task
  | 'none';           // No delegation — direct response

/** Concrete executor that actually ran work behind a delegation boundary */
export type ExecutionProvenance =
  | 'llm-chat'
  | 'ralph-loop'
  | 'draft-generator'
  | 'llm-mode-agent'
  | 'conveyor-runner'
  | 'external-engineering-delegate'
  | 'echo'
  | 'none';

/** A delegation decision made by StudioAgent */
export interface DelegationDecision {
  target: DelegationTarget;
  /** Parameters for the delegated execution */
  params: Record<string, unknown>;
  /** Why this delegation was chosen */
  reason: string;
}

// ── Session ──

/** A single turn in the conversation */
export interface SessionTurn {
  /** Unique turn ID */
  id: string;
  /** Session this turn belongs to */
  sessionId: string;
  /** What the user said */
  input: string;
  /** Classified intent */
  intent: IntentClassification;
  /** Where work was delegated */
  delegation: DelegationDecision;
  /** The agent's response text */
  response: string;
  /** Any artifacts produced during this turn */
  artifactRefs: string[];
  /** Any task IDs created or touched */
  taskRefs: string[];
  /** Wall-clock duration in ms */
  durationMs: number;
  /** ISO timestamp */
  timestamp: string;
}

// ── Agent Response ──

/** Metadata attached to every StudioAgent response */
export interface ResponseMetadata {
  /** The turn this response belongs to */
  turnId: string;
  /** How the intent was classified */
  intent: IntentType;
  /** Where work was delegated */
  delegatedTo: DelegationTarget;
  /** Artifacts produced (if any) */
  artifactRefs: string[];
  /** Tasks touched (if any) */
  taskRefs: string[];
  /** Duration of the full turn */
  durationMs: number;
  /** LLM model used */
  model?: string;
  /** Concrete executor path used behind the delegation boundary */
  executor?: ExecutionProvenance;
}

/** The structured response from StudioAgent */
export interface StudioResponse {
  /** The text content to display to the user */
  content: string;
  /** Structured metadata for the TUI */
  metadata: ResponseMetadata;
}

// ── Agent Configuration ──

/** Configuration for StudioAgent behavior */
export interface StudioAgentConfig {
  /** System prompt personality */
  systemPrompt?: string;
  /** Maximum tokens for studio responses */
  maxTokens?: number;
  /** Whether to stream responses */
  streaming?: boolean;
  /** Default product mode for new sessions */
  defaultMode?: import('./ProductMode.js').ProductMode;
}

// ── Intent Router Configuration ──

/** Keywords that signal each intent type */
export interface IntentKeywords {
  creative: string[];
  engineering: string[];
  hybrid: string[];
}

/** Configuration for the IntentRouter */
export interface IntentRouterConfig {
  /** Custom keyword overrides */
  keywords?: Partial<IntentKeywords>;
  /** Minimum confidence threshold before asking for clarification */
  minConfidence?: IntentConfidence;
}
