/**
 * Meta-Harness exports
 * 
 * The meta-harness observes failures, detects patterns, and updates itself
 * 
 * Usage:
 *   import { failureLogger, patternDetector, harnessUpdater } from './harness/index.js';
 * 
 *   // Log a failure
 *   failureLogger.log({ model, domain, prompt, error, errorType, duration });
 * 
 *   // Detect patterns
 *   const patterns = patternDetector.analyze(failure);
 * 
 *   // Apply adaptations
 *   for (const pattern of patterns) {
 *     await harnessUpdater.applyAdaptation(pattern);
 *   }
 */

export { failureLogger, FailureLogger, type FailureRecord } from './FailureLogger.js';
export { patternDetector, PatternDetector, type Pattern, KNOWN_PATTERNS } from './PatternDetector.js';
export { harnessUpdater, HarnessUpdater, type HarnessAdaptation } from './HarnessUpdater.js';
export { metaHarness, MetaHarnessIntegration, type MetaHarnessStatus } from './MetaHarnessIntegration.js';
export {
  getProviderConfig,
  getActiveProvider,
  getActiveProviderConfig,
  listConfiguredProviders,
  isProviderConfigured,
  detectProviderFromUrl,
  PROVIDER_TEMPLATES,
  type ProviderType,
  type ProviderConfig,
} from './MultiProviderConfig.js';

// Harness Agent (Self-Improvement)
export {
  HarnessAgent,
  createHarnessAgent,
  type AgentTask,
  type AgentStep,
  type AgentSession,
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
