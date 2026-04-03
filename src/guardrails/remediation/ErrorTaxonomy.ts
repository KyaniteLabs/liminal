/**
 * Remediation Layer - Error Taxonomy & Auto-Fixes
 * 
 * Classifies errors and provides automated remediation strategies.
 */

import { ExecutionContext, RemediationResult } from '../core/types.js';

export interface ErrorClassification {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoFixable: boolean;
  maxRetries: number;
  remediationStrategy: string;
  estimatedFixTimeMs: number;
}

export interface ErrorPattern {
  pattern: RegExp;
  type: string;
  extractContext?: (match: RegExpMatchArray) => Record<string, string>;
}

/**
 * Error taxonomy with known failure patterns
 */
export const ERROR_TAXONOMY: Record<string, ErrorClassification> = {
  // Syntax errors
  'SYNTAX_ERROR': {
    type: 'SYNTAX_ERROR',
    severity: 'high',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Use AST-based auto-fix with syntax correction',
    estimatedFixTimeMs: 5000,
  },
  'MISSING_SEMICOLON': {
    type: 'MISSING_SEMICOLON',
    severity: 'medium',
    autoFixable: true,
    maxRetries: 1,
    remediationStrategy: 'Add missing semicolons via lint --fix',
    estimatedFixTimeMs: 1000,
  },
  'UNMATCHED_BRACKET': {
    type: 'UNMATCHED_BRACKET',
    severity: 'high',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Count and balance brackets/parentheses',
    estimatedFixTimeMs: 3000,
  },
  
  // Type errors
  'TYPE_ERROR': {
    type: 'TYPE_ERROR',
    severity: 'high',
    autoFixable: true,
    maxRetries: 3,
    remediationStrategy: 'Generate TypeScript fixes with type annotations',
    estimatedFixTimeMs: 8000,
  },
  'MISSING_TYPE': {
    type: 'MISSING_TYPE',
    severity: 'medium',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Infer types from usage and add annotations',
    estimatedFixTimeMs: 5000,
  },
  
  // Test failures
  'TEST_FAILURE': {
    type: 'TEST_FAILURE',
    severity: 'medium',
    autoFixable: true,
    maxRetries: 3,
    remediationStrategy: 'Analyze test output, generate targeted fixes',
    estimatedFixTimeMs: 10000,
  },
  'ASSERTION_FAILURE': {
    type: 'ASSERTION_FAILURE',
    severity: 'medium',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Adjust implementation to match expected behavior',
    estimatedFixTimeMs: 8000,
  },
  
  // Resource errors
  'TIMEOUT': {
    type: 'TIMEOUT',
    severity: 'medium',
    autoFixable: false,
    maxRetries: 1,
    remediationStrategy: 'Increase timeout or break into smaller tasks',
    estimatedFixTimeMs: 0,
  },
  'RATE_LIMIT': {
    type: 'RATE_LIMIT',
    severity: 'medium',
    autoFixable: true,
    maxRetries: 5,
    remediationStrategy: 'Exponential backoff and retry',
    estimatedFixTimeMs: 30000,
  },
  
  // LLM errors
  'HALLUCINATION': {
    type: 'HALLUCINATION',
    severity: 'critical',
    autoFixable: false,
    maxRetries: 0,
    remediationStrategy: 'Add validation step, use constrained decoding',
    estimatedFixTimeMs: 0,
  },
  'JSON_PARSE_ERROR': {
    type: 'JSON_PARSE_ERROR',
    severity: 'high',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Request JSON output with explicit format',
    estimatedFixTimeMs: 5000,
  },
  'SCHEMA_VIOLATION': {
    type: 'SCHEMA_VIOLATION',
    severity: 'high',
    autoFixable: true,
    maxRetries: 2,
    remediationStrategy: 'Regenerate with schema constraints',
    estimatedFixTimeMs: 6000,
  },
  
  // Tool errors
  'TOOL_NOT_FOUND': {
    type: 'TOOL_NOT_FOUND',
    severity: 'high',
    autoFixable: true,
    maxRetries: 1,
    remediationStrategy: 'Suggest alternative tool from allowed list',
    estimatedFixTimeMs: 2000,
  },
  'PERMISSION_DENIED': {
    type: 'PERMISSION_DENIED',
    severity: 'critical',
    autoFixable: false,
    maxRetries: 0,
    remediationStrategy: 'Request elevated permissions or modify approach',
    estimatedFixTimeMs: 0,
  },
};

/**
 * Error patterns for classification
 */
export const ERROR_PATTERNS: ErrorPattern[] = [
  { pattern: /Unexpected token|SyntaxError|Parse error/i, type: 'SYNTAX_ERROR' },
  { pattern: /Missing semicolon|Expected ';'/i, type: 'MISSING_SEMICOLON' },
  { pattern: /Unmatched (bracket|parenthesis|brace)|Unexpected (\)|})/i, type: 'UNMATCHED_BRACKET' },
  { pattern: /Type '.*' is not assignable to type|TypeError|cannot assign/i, type: 'TYPE_ERROR' },
  { pattern: /test failed|AssertionError|expect.*to.*but/i, type: 'TEST_FAILURE' },
  { pattern: /timeout|timed out|ETIMEDOUT/i, type: 'TIMEOUT' },
  { pattern: /rate limit|too many requests|429/i, type: 'RATE_LIMIT' },
  { pattern: /JSON parse|Unexpected token.*JSON|invalid json/i, type: 'JSON_PARSE_ERROR' },
  { pattern: /does not match schema|invalid schema|required property/i, type: 'SCHEMA_VIOLATION' },
  { pattern: /tool not found|unknown tool|invalid tool/i, type: 'TOOL_NOT_FOUND' },
  { pattern: /permission denied|access denied|not authorized|EACCES/i, type: 'PERMISSION_DENIED' },
];

/**
 * Classify an error based on patterns
 */
export function classifyError(error: Error | string): ErrorClassification | null {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      const classification = ERROR_TAXONOMY[pattern.type];
      if (classification) {
        return classification;
      }
    }
  }
  
  return null;
}

/**
 * Remediation engine that applies fixes based on error type
 */
export class RemediationEngine {
  private attemptCounts: Map<string, number> = new Map();
  
  /**
   * Attempt to remediate an error
   */
  async remediate(
    error: Error | string,
    context: ExecutionContext
  ): Promise<RemediationResult> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const classification = classifyError(error);
    
    if (!classification) {
      return {
        success: false,
        action: 'unknown_error',
        message: `Unknown error type: ${errorMessage.substring(0, 100)}`,
      };
    }
    
    // Check retry budget
    const taskKey = `${context.taskId}:${classification.type}`;
    const attempts = this.attemptCounts.get(taskKey) || 0;
    
    if (attempts >= classification.maxRetries) {
      return {
        success: false,
        action: 'max_retries_exceeded',
        message: `Max retries (${classification.maxRetries}) exceeded for ${classification.type}`,
      };
    }
    
    this.attemptCounts.set(taskKey, attempts + 1);
    
    // Apply remediation strategy
    switch (classification.type) {
      case 'SYNTAX_ERROR':
      case 'MISSING_SEMICOLON':
      case 'UNMATCHED_BRACKET':
        return this.fixSyntaxError(errorMessage, context);
        
      case 'TYPE_ERROR':
      case 'MISSING_TYPE':
        return this.fixTypeError(errorMessage, context);
        
      case 'TEST_FAILURE':
      case 'ASSERTION_FAILURE':
        return this.fixTestFailure(errorMessage, context);
        
      case 'TIMEOUT':
        return this.handleTimeout(errorMessage, context);
        
      case 'RATE_LIMIT':
        return this.handleRateLimit(errorMessage, context);
        
      case 'JSON_PARSE_ERROR':
        return this.fixJSONError(errorMessage, context);
        
      case 'SCHEMA_VIOLATION':
        return this.fixSchemaViolation(errorMessage, context);
        
      case 'TOOL_NOT_FOUND':
        return this.suggestAlternativeTool(errorMessage, context);
        
      case 'PERMISSION_DENIED':
      case 'HALLUCINATION':
        return {
          success: false,
          action: 'requires_human_intervention',
          message: `${classification.type} cannot be auto-remediated: ${classification.remediationStrategy}`,
        };
        
      default:
        return {
          success: false,
          action: 'no_strategy',
          message: `No remediation strategy for ${classification.type}`,
        };
    }
  }
  
  private async fixSyntaxError(errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: true,
      action: 'syntax_fix',
      message: 'Attempting syntax auto-fix',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Previous code had syntax error: "${errorMessage.substring(0, 200)}". Please fix syntax errors and ensure code is valid.`,
      },
    };
  }
  
  private async fixTypeError(errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: true,
      action: 'type_fix',
      message: 'Attempting type error fix',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Type error detected: "${errorMessage.substring(0, 200)}". Please add proper type annotations and fix type mismatches.`,
      },
    };
  }
  
  private async fixTestFailure(errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: true,
      action: 'test_fix',
      message: 'Attempting test failure fix',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Test failed with: "${errorMessage.substring(0, 200)}". Please analyze test expectations and fix implementation to match.`,
      },
    };
  }
  
  private async handleTimeout(_errorMessage: string, _context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: false,
      action: 'timeout',
      message: 'Operation timed out - consider breaking into smaller tasks',
    };
  }
  
  private async handleRateLimit(_errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    const delayMs = Math.pow(2, (this.attemptCounts.get(`${context.taskId}:RATE_LIMIT`) || 0)) * 1000;
    await this.sleep(delayMs);
    
    return {
      success: true,
      action: 'rate_limit_backoff',
      message: `Backed off for ${delayMs}ms due to rate limiting`,
    };
  }
  
  private async fixJSONError(_errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: true,
      action: 'json_fix',
      message: 'Requesting valid JSON output',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Previous output was not valid JSON. Please respond with valid JSON only, no markdown or explanations.`,
      },
    };
  }
  
  private async fixSchemaViolation(_errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    return {
      success: true,
      action: 'schema_fix',
      message: 'Regenerating with schema constraints',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Output did not match required schema. Please ensure all required fields are present with correct types.`,
      },
    };
  }
  
  private async suggestAlternativeTool(_errorMessage: string, context: ExecutionContext): Promise<RemediationResult> {
    const { allowedTools } = context;
    
    if (!allowedTools || allowedTools.length === 0) {
      return {
        success: false,
        action: 'no_alternatives',
        message: 'No alternative tools available',
      };
    }
    
    return {
      success: true,
      action: 'suggest_alternative_tool',
      message: `Suggested using ${allowedTools[0]} instead`,
      newContext: {
        proposedTool: allowedTools[0],
      },
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Reset attempt counts for a task
   */
  resetAttempts(taskId: string): void {
    for (const key of this.attemptCounts.keys()) {
      if (key.startsWith(`${taskId}:`)) {
        this.attemptCounts.delete(key);
      }
    }
  }
}

// Global engine
let globalEngine: RemediationEngine | null = null;

export function initializeRemediationEngine(): RemediationEngine {
  globalEngine = new RemediationEngine();
  return globalEngine;
}

export function getRemediationEngine(): RemediationEngine | null {
  return globalEngine;
}
