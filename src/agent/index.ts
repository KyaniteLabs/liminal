/**
 * StudioAgent Module — Phase 11
 *
 * The foreground conversational agent for Liminal Studio.
 */

// Types — the integration contract
export type {
  IntentType,
  IntentConfidence,
  IntentClassification,
  DelegationTarget,
  DelegationDecision,
  SessionTurn,
  ResponseMetadata,
  StudioResponse,
  StudioAgentConfig,
  IntentKeywords,
  IntentRouterConfig,
} from './types.js';

// Intent classification
export { IntentRouter } from './IntentRouter.js';

// Response formatting
export { ResponseComposer } from './ResponseComposer.js';

// Core agent (re-exports delegate types too)
export { StudioAgent, STUDIO_SYSTEM_PROMPT } from './StudioAgent.js';
export type {
  CreativeDelegate,
  EngineeringDelegate,
  ChatDelegate,
  CreativeResult,
  EngineeringResult,
} from './StudioAgent.js';

// Engineering delegation
export { TaskDelegator } from './TaskDelegator.js';
export type { TaskExecutor, TaskExecutorResult, TaskDelegatorOptions } from './TaskDelegator.js';

// Session persistence
export { SessionGraph } from './SessionGraph.js';
export type { SessionTurnRecord, SessionManifest } from './SessionGraph.js';

// Evaluation fabric (re-exports from evaluation module)
export { EvaluationFabric, HybridJudge, synthesize, isTrustworthy } from '../evaluation/index.js';
export type {
  EvaluationCandidate,
  EvaluationFabricResult,
  EvaluationFabricConfig,
  ConfidenceReport,
  ConfidenceDimension,
  AgreementLevel,
  HybridJudgment,
  HybridWeights,
  GoldenSuite,
  GoldenCase,
  GoldenCaseResult,
  GoldenSuiteResult,
} from '../evaluation/index.js';
