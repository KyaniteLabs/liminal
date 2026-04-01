/**
 * Deterministic Guardrails Framework (DGF) - Main Entry Point
 * 
 * Provides multi-layer guardrails for:
 * - Development-time: Pre-commit hooks, CI/CD gates
 * - Runtime: Resource limits, validation, auto-remediation
 * - Evolutionary: Self-updating based on failure patterns
 */

// Core types
export {
  GuardrailTier,
  type GuardrailRule,
  type ExecutionContext,
  type GuardrailResult,
  type RemediationResult,
  type GuardrailRegistryConfig,
  type ResourceUsage,
  type ExecutionTrace,
  type ErrorTaxonomyEntry,
  type LearnedRule,
} from './core/types.js';

// Core registry
export {
  GuardrailRegistry,
  initializeGuardrails,
  getGuardrailRegistry,
  type RegistryEvaluationResult,
} from './core/GuardrailRegistry.js';

// Resource limiting
export {
  ResourceLimiter,
  createResourceLimiter,
  getResourceLimiter,
  removeResourceLimiter,
  getAllResourceLimiters,
  type ResourceLimits,
  type ResourceCheckResult,
} from './core/ResourceLimiter.js';

// Telemetry
export {
  TelemetryCollector,
  initializeTelemetry,
  getTelemetry,
  type TelemetryEvent,
  type ExecutionMetrics,
} from './observation/TelemetryCollector.js';

// Catastrophic guardrails
export {
  MaxIterationGuardrail,
  ResourceExhaustionGuardrail,
  ToolPermissionGuardrail,
  OutputSchemaGuardrail,
  createCatastrophicGuardrails,
} from './rules/CatastrophicGuardrails.js';

// Validation layer
export {
  SchemaValidator,
  initializeValidator,
  getValidator,
  type ValidationResult,
  type ValidationError,
  type SchemaDefinition,
} from './validation/SchemaValidator.js';

// Remediation layer
export {
  RemediationEngine,
  initializeRemediationEngine,
  getRemediationEngine,
  classifyError,
  ERROR_TAXONOMY,
  ERROR_PATTERNS,
  type ErrorClassification,
  type ErrorPattern,
} from './remediation/ErrorTaxonomy.js';

// Correctness guardrails
export {
  TypeCheckGuardrail,
} from './correctness/TypeCheckGuardrail.js';

export {
  TestVerificationGuardrail,
  type TestRunResult,
  type TestFailure,
} from './correctness/TestVerificationGuardrail.js';

// Hygiene guardrails
export {
  CodeStyleGuardrail,
} from './hygiene/CodeStyleGuardrail.js';

// M9-M11: Legacy guardrails (backward compatibility)
export {
  SemanticValidator,
  type SemanticValidationResult,
  type SemanticValidatorOptions,
} from './SemanticValidator.js';

export {
  RuntimeHealthMonitor,
  type RuntimeHealthResult,
  type RuntimeHealthOptions,
} from './RuntimeHealthMonitor.js';

export {
  AccessibilityGuardrails,
  type AccessibilityResult,
  type AccessibilityOptions,
} from './AccessibilityGuardrails.js';

/**
 * Quick-start function to initialize full guardrail system
 */
import { initializeGuardrails } from './core/GuardrailRegistry.js';
import { initializeTelemetry } from './observation/TelemetryCollector.js';
import { createCatastrophicGuardrails } from './rules/CatastrophicGuardrails.js';

export interface GuardrailSystemConfig {
  /** Shadow mode: observe only, don't block */
  shadowMode?: boolean;
  
  /** Default tier for all guardrails */
  defaultTier?: 0 | 1 | 2 | 3;
  
  /** Enable telemetry collection */
  telemetry?: boolean;
  
  /** Resource limits */
  resourceLimits?: {
    maxTokens?: number;
    maxMemoryMB?: number;
    maxTimeMs?: number;
    maxApiCalls?: number;
  };
}

export function initializeGuardrailSystem(config: GuardrailSystemConfig = {}) {
  // Initialize telemetry
  if (config.telemetry !== false) {
    initializeTelemetry({
      enabled: true,
      sampleRate: 1.0,
      storage: 'memory',
    });
  }
  
  // Initialize guardrail registry
  const registry = initializeGuardrails({
    shadowMode: config.shadowMode ?? true, // Default to shadow mode
    defaultTier: config.defaultTier ?? 0,
    telemetry: {
      enabled: config.telemetry !== false,
      sampleRate: 1.0,
      storage: 'memory',
    },
  });
  
  // Register catastrophic guardrails
  const catastrophicGuardrails = createCatastrophicGuardrails();
  catastrophicGuardrails.forEach(g => registry.register(g));
  
  return {
    registry,
    telemetry: () => import('./observation/TelemetryCollector.js').then(m => m.getTelemetry()),
    resourceLimiter: (taskId: string) => import('./core/ResourceLimiter.js').then(m => m.getResourceLimiter(taskId)),
  };
}
