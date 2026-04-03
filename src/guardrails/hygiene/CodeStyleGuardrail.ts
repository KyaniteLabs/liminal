/**
 * Hygiene Layer - Code Style Guardrail
 * 
 * Enforces consistent code formatting and style.
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
 * Guardrail: Code Style Enforcement
 * Runs eslint and prettier to ensure code style consistency
 */
export class CodeStyleGuardrail implements GuardrailRule {
  id = 'guardrail-code-style';
  description = 'Enforces consistent code formatting and style';
  tier = GuardrailTier.ADVISORY; // Advisory initially, can escalate
  category = 'hygiene' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { changedFiles } = context;
    
    if (!changedFiles || changedFiles.length === 0) {
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No files to check',
      };
    }
    
    // Filter for JavaScript/TypeScript files
    const codeFiles = changedFiles.filter(f => 
      f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx')
    );
    
    if (codeFiles.length === 0) {
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No code files to check',
      };
    }
    
    const issues: string[] = [];
    
    // Check with ESLint
    try {
      await execAsync(`npx eslint ${codeFiles.join(' ')} --max-warnings=0`, {
        timeout: 30000,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('error')) {
        issues.push(`ESLint errors found: ${errorMsg.substring(0, 200)}`);
      }
    }
    
    // Check with Prettier
    try {
      await execAsync(`npx prettier --check ${codeFiles.join(' ')} 2>&1`, {
        timeout: 30000,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('differ')) {
        issues.push('Prettier formatting issues found');
      }
    }
    
    if (issues.length > 0) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'warning',
        message: `Code style issues found in ${codeFiles.length} files`,
        details: { issues, files: codeFiles },
        suggestion: 'Run lint:fix and format to auto-fix issues',
      };
    }
    
    return {
      passed: true,
      guardrailId: this.id,
      message: `Code style passed for ${codeFiles.length} files`,
    };
  }
  
  async remediate(context: ExecutionContext, _violation: GuardrailResult): Promise<RemediationResult> {
    const { changedFiles } = context;
    const codeFiles = changedFiles?.filter(f => 
      f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx')
    ) || [];
    
    if (codeFiles.length === 0) {
      return {
        success: true,
        action: 'no_files',
        message: 'No code files to fix',
      };
    }
    
    try {
      // Auto-fix with ESLint
      await execAsync(`npx eslint ${codeFiles.join(' ')} --fix`, {
        timeout: 30000,
      });
      
      // Auto-fix with Prettier
      await execAsync(`npx prettier --write ${codeFiles.join(' ')}`, {
        timeout: 30000,
      });
      
      return {
        success: true,
        action: 'auto_fix',
        message: `Auto-fixed code style for ${codeFiles.length} files`,
      };
    } catch (error) {
      return {
        success: false,
        action: 'fix_failed',
        message: `Auto-fix failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
