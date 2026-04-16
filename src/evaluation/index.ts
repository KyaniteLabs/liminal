/**
 * Evaluation Module — Phase 11 Increment 4
 *
 * Unified evaluation pipeline combining code scoring with aesthetic critique.
 */

// Types
export type {
  EvaluationCandidate,
  ConfidenceDimension,
  AgreementLevel,
  ConfidenceReport,
  HybridWeights,
  HybridJudgment,
  GoldenCase,
  GoldenSuite,
  GoldenCaseResult,
  GoldenSuiteResult,
  EvaluationFabricResult,
  EvaluationFabricConfig,
} from './types.js';

// Confidence synthesis
export { synthesize, isTrustworthy } from './ConfidenceSynthesizer.js';

// Hybrid judge
export { HybridJudge } from './HybridJudge.js';

// Orchestrator
export { EvaluationFabric } from './EvaluationFabric.js';
