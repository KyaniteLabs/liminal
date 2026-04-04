/**
 * Correctness Layer - Type Checking Guardrail
 * 
 * Ensures TypeScript code compiles without type errors.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import {
  GuardrailRule,
  ExecutionContext,
  GuardrailResult,
  RemediationResult,
  GuardrailTier,
} from '../core/types.js';

const execAsync = promisify(exec);

/**
 * Guardrail: TypeScript Type Checking
 * Runs tsc --noEmit to verify type correctness
 */
export class TypeCheckGuardrail implements GuardrailRule {
  id = 'guardrail-type-check';
  description = 'Ensures TypeScript code compiles without type errors';
  tier = GuardrailTier.ENFORCING;
  category = 'correctness' as const;
  
  // eslint-disable-next-line @typescript-eslint/require-await
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { changedFiles } = context;

    // If no files changed, skip
    if (!changedFiles || changedFiles.length === 0) {
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No files to type check',
      };
    }
    
    // Filter for TypeScript files
    const tsFiles = changedFiles.filter(f => 
      f.endsWith('.ts') || f.endsWith('.tsx')
    );
    
    if (tsFiles.length === 0) {
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No TypeScript files to check',
      };
    }
    
    try {
      // Run TypeScript compiler
      const { stdout, stderr } = await execAsync('npx tsc --noEmit 2>&1', {
        timeout: 60000,
        cwd: process.cwd(),
      });
      
      if (stderr || stdout.includes('error')) {
        return {
          passed: false,
          guardrailId: this.id,
          severity: 'error',
          message: `TypeScript compilation failed`,
          details: {
            errors: stderr || stdout,
            files: tsFiles,
          },
          suggestion: 'Fix type errors before proceeding',
        };
      }
      
      return {
        passed: true,
        guardrailId: this.id,
        message: `TypeScript compilation passed for ${tsFiles.length} files`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `TypeScript compiler error: ${errorMsg.substring(0, 200)}`,
        details: { error: errorMsg },
      };
    }
  }
  
  // eslint-disable-next-line @typescript-eslint/require-await
  async remediate(context: ExecutionContext, violation: GuardrailResult): Promise<RemediationResult> {
    // Type errors need human review or LLM fix
    return {
      success: true,
      action: 'request_type_fix',
      message: 'Requesting LLM to fix type errors',
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] TypeScript errors detected: ${JSON.stringify((violation.details as Record<string, unknown>)?.errors)}. Please fix all type errors and ensure code compiles.`,
      },
    };
  }
  
  escalation = {
    afterFailures: 2,
    action: 'humanReview' as const,
  };
}
