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
export { IntentRouter } from './IntentRouter.js'

// Product modes
export { ModeAwareRouter, PRODUCT_MODES } from './ProductMode.js'
export type { ProductMode, AutonomyLevel, WorkspaceProfile, ModeConfig } from './ProductMode.js'

// Mode registry
export { ModeRegistry } from './ModeRegistry.js'
export type { ModeChangeCallback } from './ModeRegistry.js'

// Skill runner and catalog
export { SkillRunner } from './SkillRunner.js'
export type { SkillRunResult } from './SkillRunner.js'
export { SkillCatalog } from './SkillCatalog.js'
export type { CatalogEntry } from './SkillCatalog.js'

// Review and diff
export { ReviewManager } from './ReviewManager.js'
export type { ReviewCandidate, CandidateStatus } from './ReviewManager.js'
export { DiffRenderer } from './DiffRenderer.js'
export type { DiffLine, DiffResult } from './DiffRenderer.js'

// Onboarding, diagnostics, session resume
export { OnboardingWizard } from './OnboardingWizard.js'
export type { OnboardingStep, OnboardingResult } from './OnboardingWizard.js'
export { EnvironmentValidator } from './EnvironmentValidator.js'
export type { DiagnosticCheck, DiagnosticReport } from './EnvironmentValidator.js'
export { SessionResumer } from './SessionResumer.js'
export type { SessionEntry } from './SessionResumer.js'

// Reports, workspaces, autonomy
export { ReportGenerator } from './ReportGenerator.js'
export type { SessionReport } from './ReportGenerator.js'
export { WorkspaceManager } from './WorkspaceManager.js'
export type { WorkspaceConfig } from './WorkspaceManager.js'
export { AutonomyController } from './AutonomyController.js'
export type { AutonomyConfig } from './AutonomyController.js'
export { AUTONOMY_LEVELS } from './AutonomyController.js'

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
