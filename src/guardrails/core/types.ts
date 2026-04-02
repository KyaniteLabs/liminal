/**
 * Deterministic Guardrails Framework (DGF) - Core Types
 * 
 * Provides type definitions for the multi-layer guardrail system
 * that operates at development-time and runtime.
 */

/**
 * Guardrail enforcement tier
 * - SHADOW: Observe only, don't block
 * - ADVISORY: Warn but allow override
 * - ENFORCING: Block violations with remediation
 * - AUTONOMOUS: Full auto-remediation, escalate only on novel failures
 */
export type GuardrailTier = 0 | 1 | 2 | 3;
export const GuardrailTier = {
  SHADOW: 0 as const,
  ADVISORY: 1 as const,
  ENFORCING: 2 as const,
  AUTONOMOUS: 3 as const,
};

/**
 * Guardrail category by priority
 */
export type GuardrailCategory = 'catastrophic' | 'correctness' | 'hygiene' | 'compliance' | 'evolution';

/**
 * Action to take on guardrail violation
 */
export type ViolationAction = 'allow' | 'warn' | 'block' | 'selfHeal';

/**
 * Execution context passed to all guardrails
 */
export interface ExecutionContext {
  /** Unique task identifier */
  taskId: string;
  
  /** Current iteration/step */
  step: number;
  
  /** Maximum allowed iterations */
  maxSteps: number;
  
  /** LLM prompt (for token counting) */
  prompt?: string;
  
  /** Current LLM output */
  output?: unknown;
  
  /** Expected output schema */
  schema?: unknown;
  
  /** Files being modified */
  changedFiles?: string[];
  
  /** Proposed tool to use */
  proposedTool?: string;
  
  /** Allowed tools for this task */
  allowedTools?: string[];
  
  /** Timestamp of execution start */
  startTime: number;
  
  /** Resource usage tracking */
  resources: ResourceUsage;
  
  /** Execution trace for debugging */
  trace: ExecutionTrace;
  
  /** Previous remediation attempts */
  previousAttempts?: RemediationAttempt[];
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  tokensUsed: number;
  tokensLimit: number;
  
  memoryUsedMB: number;
  memoryLimitMB: number;
  
  timeElapsedMs: number;
  timeLimitMs: number;
  
  apiCalls: number;
  apiCallLimit: number;
}

/**
 * Single entry in execution trace
 */
export interface ExecutionTrace {
  steps: TraceStep[];
}

export interface TraceStep {
  timestamp: number;
  action: string;
  details: Record<string, unknown>;
  result?: unknown;
  error?: Error;
}

/**
 * Remediation attempt record
 */
export interface RemediationAttempt {
  timestamp: number;
  guardrailId: string;
  action: string;
  result: 'success' | 'failure';
  details?: unknown;
}

/**
 * Result of guardrail evaluation
 */
export interface GuardrailResult {
  /** Whether the guardrail passed */
  passed: boolean;
  
  /** Guardrail that produced this result */
  guardrailId: string;
  
  /** Severity of violation (if any) */
  severity?: 'info' | 'warning' | 'error' | 'critical';
  
  /** Human-readable message */
  message: string;
  
  /** Detailed violation info */
  details?: unknown;
  
  /** Suggested fix (if applicable) */
  suggestion?: string;
  
  /** Auto-remediation result (if attempted) */
  remediation?: RemediationResult;
}

/**
 * Result of remediation attempt
 */
export interface RemediationResult {
  /** Whether remediation succeeded */
  success: boolean;
  
  /** Action taken */
  action: string;
  
  /** New/modified context after remediation */
  newContext?: Partial<ExecutionContext>;
  
  /** Human-readable message */
  message: string;
  
  /** Additional details */
  details?: unknown;
}

/**
 * Core guardrail interface
 */
export interface GuardrailRule {
  /** Unique identifier */
  id: string;
  
  /** Human-readable description */
  description: string;
  
  /** Enforcement tier */
  tier: GuardrailTier;
  
  /** Category by priority */
  category: GuardrailCategory;
  
  /** Evaluate the guardrail condition */
  evaluate(context: ExecutionContext): Promise<GuardrailResult>;
  
  /** Attempt auto-remediation (optional) */
  remediate?(context: ExecutionContext, violation: GuardrailResult): Promise<RemediationResult>;
  
  /** Escalation configuration */
  escalation?: EscalationConfig;
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  /** Number of failures before escalation */
  afterFailures: number;
  
  /** Action to take on escalation */
  action: 'humanReview' | 'circuitBreaker' | 'rollback' | 'abort';
  
  /** Optional callback for escalation */
  onEscalate?: (context: ExecutionContext, failures: number) => Promise<void>;
}

/**
 * Guardrail registry configuration
 */
export interface GuardrailRegistryConfig {
  /** Default tier for all guardrails */
  defaultTier: GuardrailTier;
  
  /** Whether to run in shadow mode (log only) */
  shadowMode: boolean;
  
  /** Telemetry configuration */
  telemetry: TelemetryConfig;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable detailed tracing */
  enabled: boolean;
  
  /** Sample rate (0-1) */
  sampleRate: number;
  
  /** Storage backend */
  storage: 'memory' | 'file' | 'external';
  
  /** For file storage: path to log file */
  logPath?: string;
}

/**
 * Error taxonomy entry
 */
export interface ErrorTaxonomyEntry {
  /** Error type identifier */
  type: string;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether this error type is auto-fixable */
  autoFixable: boolean;
  
  /** Maximum retry attempts */
  maxRetries: number;
  
  /** Remediation strategy */
  remediation: string;
  
  /** Expected time to fix (ms) */
  estimatedFixTimeMs?: number;
}

/**
 * Learned rule from failure patterns
 */
export interface LearnedRule {
  id: string;
  
  /** Pattern that triggers this rule */
  pattern: ErrorPattern;
  
  /** Prevention strategy */
  prevention: string;
  
  /** Remediation strategy */
  remediation: string;
  
  /** Current confidence (0-1) */
  confidence: number;
  
  /** Whether rule is active */
  active: boolean;
  
  /** Success/failure tracking */
  successCount: number;
  failureCount: number;
  
  /** When rule was created */
  createdAt: number;
  
  /** Last updated */
  updatedAt: number;
}

/**
 * Error pattern for matching failures
 */
export interface ErrorPattern {
  /** Error message pattern (regex) */
  messagePattern?: RegExp;
  
  /** Error type */
  errorType?: string;
  
  /** Stack trace pattern */
  stackPattern?: RegExp;
  
  /** Context conditions */
  contextConditions?: Record<string, unknown>;
}
