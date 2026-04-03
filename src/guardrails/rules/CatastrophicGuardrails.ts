/**
 * Catastrophic Prevention Guardrails
 * 
 * Priority A guardrails that prevent:
 * - Resource exhaustion (infinite loops, token overflow)
 * - Unauthorized actions (tool misuse, privilege escalation)
 * - Data corruption (invalid writes, schema violations)
 */

import {
  GuardrailRule,
  ExecutionContext,
  GuardrailResult,
  RemediationResult,
  GuardrailTier,
} from '../core/types.js';
import { getResourceLimiter } from '../core/ResourceLimiter.js';

/**
 * Guardrail: Maximum Iteration Limit
 * Prevents infinite loops by enforcing max step count
 */
export class MaxIterationGuardrail implements GuardrailRule {
  id = 'guardrail-max-iterations';
  description = 'Prevents infinite loops by enforcing maximum iteration count';
  tier = GuardrailTier.AUTONOMOUS; // Always enforced
  category = 'catastrophic' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { step, maxSteps } = context;
    
    if (step >= maxSteps) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'critical',
        message: `Maximum iteration count exceeded: ${step}/${maxSteps}`,
        details: { step, maxSteps },
        suggestion: 'Break task into smaller subtasks or increase maxSteps if appropriate',
      };
    }
    
    return {
      passed: true,
      guardrailId: this.id,
      message: `Iteration count OK: ${step}/${maxSteps}`,
    };
  }
  
  async remediate(context: ExecutionContext, _violation: GuardrailResult): Promise<RemediationResult> {
    // Generate partial result with explanation
    return {
      success: true,
      action: 'abort_with_partial_result',
      message: `Task aborted after ${context.maxSteps} iterations`,
      newContext: {
        output: {
          success: false,
          partialOutput: 'Task exceeded maximum iteration limit',
          reason: `Aborted after ${context.maxSteps} iterations to prevent infinite loop`,
          stepsCompleted: context.step,
        },
      },
    };
  }
  
  escalation = {
    afterFailures: 1, // Immediate escalation on iteration limit
    action: 'abort' as const,
  };
}

/**
 * Guardrail: Resource Exhaustion Prevention
 * Monitors token usage, memory, time, API calls
 */
export class ResourceExhaustionGuardrail implements GuardrailRule {
  id = 'guardrail-resource-limits';
  description = 'Prevents resource exhaustion (tokens, memory, time, API calls)';
  tier = GuardrailTier.AUTONOMOUS;
  category = 'catastrophic' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const limiter = getResourceLimiter(context.taskId);
    
    if (!limiter) {
      // No limiter registered, skip
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No resource limiter registered',
      };
    }
    
    const checks = limiter.checkAll();
    const violation = checks.find(c => !c.allowed);
    
    if (violation) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'critical',
        message: `Resource limit exceeded: ${violation.message}`,
        details: {
          resource: violation.resource,
          current: violation.current,
          limit: violation.limit,
          usage: limiter.getUsage(),
        },
        suggestion: 'Reduce context size, optimize prompts, or increase resource limits',
      };
    }
    
    return {
      passed: true,
      guardrailId: this.id,
      message: 'All resource limits within bounds',
      details: { usage: limiter.getUsage() },
    };
  }
  
  async remediate(context: ExecutionContext, violation: GuardrailResult): Promise<RemediationResult> {
    const limiter = getResourceLimiter(context.taskId);
    if (!limiter) {
      return {
        success: false,
        action: 'none',
        message: 'No resource limiter available for remediation',
      };
    }
    
    const details = violation.details as { resource: string; current: number; limit: number };
    
    // Attempt remediation based on resource type
    switch (details.resource) {
      case 'tokensUsed':
        // Truncate context
        return {
          success: true,
          action: 'truncate_context',
          message: 'Context truncated to fit token limit',
          newContext: {
            prompt: '[Context truncated due to token limit]',
          },
        };
        
      case 'memoryUsedMB':
        // Suggest garbage collection (Node.js)
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
        return {
          success: true,
          action: 'force_gc',
          message: 'Forced garbage collection to free memory',
        };
        
      case 'timeElapsedMs':
        return {
          success: false,
          action: 'timeout',
          message: 'Task timed out - cannot auto-remediate',
        };
        
      case 'apiCalls':
        return {
          success: false,
          action: 'rate_limited',
          message: 'API call limit exceeded - backoff required',
        };
        
      default:
        return {
          success: false,
          action: 'unknown',
          message: `Unknown resource type: ${details.resource}`,
        };
    }
  }
  
  escalation = {
    afterFailures: 3,
    action: 'circuitBreaker' as const,
  };
}

/**
 * Guardrail: Tool Permission Enforcement
 * Prevents unauthorized tool usage
 */
export class ToolPermissionGuardrail implements GuardrailRule {
  id = 'guardrail-tool-permissions';
  description = 'Enforces tool usage permissions and prevents unauthorized actions';
  tier = GuardrailTier.AUTONOMOUS;
  category = 'catastrophic' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { proposedTool, allowedTools } = context;
    
    if (!proposedTool) {
      // No tool proposed, skip
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No tool proposed',
      };
    }
    
    if (!allowedTools || allowedTools.length === 0) {
      // No allowed tools specified, allow all (dangerous, but not blocked)
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No tool restrictions configured',
      };
    }
    
    if (!allowedTools.includes(proposedTool)) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'critical',
        message: `Tool '${proposedTool}' is not in the allowed list`,
        details: {
          proposedTool,
          allowedTools,
        },
        suggestion: `Use one of: ${allowedTools.join(', ')}`,
      };
    }
    
    return {
      passed: true,
      guardrailId: this.id,
      message: `Tool '${proposedTool}' is authorized`,
    };
  }
  
  async remediate(context: ExecutionContext, _violation: GuardrailResult): Promise<RemediationResult> {
    const { allowedTools } = context;
    
    if (!allowedTools || allowedTools.length === 0) {
      return {
        success: false,
        action: 'none',
        message: 'No alternative tools available',
      };
    }
    
    // Suggest the most similar allowed tool
    // In real implementation, use string similarity or embeddings
    const alternative = allowedTools[0];
    
    return {
      success: true,
      action: 'suggest_alternative',
      message: `Suggested alternative tool: ${alternative}`,
      newContext: {
        proposedTool: alternative,
      },
    };
  }
  
  escalation = {
    afterFailures: 1,
    action: 'humanReview' as const,
  };
}

/**
 * Guardrail: Output Schema Validation
 * Prevents invalid output formats
 */
export class OutputSchemaGuardrail implements GuardrailRule {
  id = 'guardrail-output-schema';
  description = 'Validates LLM output against expected schema';
  tier = GuardrailTier.ENFORCING;
  category = 'catastrophic' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { output, schema } = context;
    
    if (!schema) {
      // No schema specified, skip
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No output schema specified',
      };
    }
    
    if (!output) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: 'No output to validate',
        suggestion: 'Ensure LLM generates output before validation',
      };
    }
    
    // Basic validation - in real implementation use Zod or JSON Schema
    try {
      const outputObj = typeof output === 'string' ? JSON.parse(output) : output;
      
      // Check required fields exist
      if (typeof schema === 'object' && schema !== null) {
        const requiredFields = Object.keys(schema);
        const missingFields = requiredFields.filter(field => !(field in outputObj));
        
        if (missingFields.length > 0) {
          return {
            passed: false,
            guardrailId: this.id,
            severity: 'error',
            message: `Output missing required fields: ${missingFields.join(', ')}`,
            details: { missingFields },
            suggestion: 'Regenerate output with all required fields',
          };
        }
      }
      
      return {
        passed: true,
        guardrailId: this.id,
        message: 'Output schema validation passed',
      };
    } catch (error) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `Output is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'Request JSON output from LLM with explicit format instructions',
      };
    }
  }
  
  async remediate(context: ExecutionContext, _violation: GuardrailResult): Promise<RemediationResult> {
    // Attempt to fix by requesting structured output
    return {
      success: true,
      action: 'regenerate_with_schema',
      message: 'Regenerating output with schema constraints',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Previous output was invalid. Please ensure your response follows the required schema exactly.`,
      },
    };
  }
  
  escalation = {
    afterFailures: 2,
    action: 'humanReview' as const,
  };
}

/**
 * Factory function to create all catastrophic guardrails
 */
export function createCatastrophicGuardrails(): GuardrailRule[] {
  return [
    new MaxIterationGuardrail(),
    new ResourceExhaustionGuardrail(),
    new ToolPermissionGuardrail(),
    new OutputSchemaGuardrail(),
  ];
}
