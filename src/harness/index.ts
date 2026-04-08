/**
 * Meta-Harness exports
 * 
 * The meta-harness observes failures and detects patterns for manual fixing
 * 
 * Usage:
 *   import { failureLogger, patternDetector } from './harness/index.js';
 * 
 *   // Log a failure
 *   failureLogger.log({ model, domain, prompt, error, errorType, duration });
 * 
 *   // Detect patterns
 *   const patterns = patternDetector.analyze(failure);
 */

export { failureLogger, FailureLogger, type FailureRecord } from './FailureLogger.js';
export { patternDetector, PatternDetector, type Pattern, KNOWN_PATTERNS } from './PatternDetector.js';
export { metaHarness, MetaHarnessIntegration, type MetaHarnessStatus } from './MetaHarnessIntegration.js';
export {
  harnessMemory,
  HarnessMemory,
  type HarnessMemoryState,
  type HarnessTask,
  type AdaptationRecord,
  type MemoryEpisode,
  type PatternHistory,
} from './HarnessMemory.js';
export {
  selfEvaluation,
  SelfEvaluation,
  type TaskOutcome,
  type StrategyMetrics,
  type SelfEvaluationReport,
} from './SelfEvaluation.js';
export {
  getProviderConfig,
  getActiveProvider,
  getActiveProviderConfig,
  listConfiguredProviders,
  isProviderConfigured,
  detectProviderFromUrl,
  getHarnessLLMConfig,
  getHarnessProviderConfig,
  PROVIDER_TEMPLATES,
  type ProviderType,
  type ProviderConfig,
  type HarnessLLMConfig,
} from './MultiProviderConfig.js';

// Harness Agent (Self-Improvement)
export {
  HarnessAgent,
  createHarnessAgent,
  LLMModeAgent,
  createLLMModeAgent,
  type AgentTask,
  type AgentStep,
  type AgentSession,
  type LLMTask,
  type LLMSession,
} from './agent/index.js';

// Tools (for advanced usage)
export {
  readFileTool,
  writeFileTool,
  applyEditTool,
  runBuildTool,
  runTestsTool,
  rateLimiter,
  validationGuard,
} from './tools/index.js';

// Tool Telemetry
export {
  toolTelemetry,
  ToolTelemetry,
  telemetryWrapper,
  TelemetryWrapper,
  type ToolCallRecord,
  type ToolTelemetryAnalysis,
  type ToolContext,
} from './tools/index.js';
