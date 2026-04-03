/**
 * Correctness Layer - Test Verification Guardrail
 * 
 * Ensures all tests pass after code changes.
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

export interface TestRunResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures: TestFailure[];
}

export interface TestFailure {
  testName: string;
  error: string;
  file?: string;
  line?: number;
}

/**
 * Guardrail: Test Verification
 * Runs relevant tests to ensure changes don't break functionality
 */
export class TestVerificationGuardrail implements GuardrailRule {
  id = 'guardrail-test-verification';
  description = 'Ensures all tests pass after code changes';
  tier = GuardrailTier.ENFORCING;
  category = 'correctness' as const;
  
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const { changedFiles } = context;
    
    // If no files changed, skip
    if (!changedFiles || changedFiles.length === 0) {
      return {
        passed: true,
        guardrailId: this.id,
        message: 'No files changed, skipping test verification',
      };
    }
    
    try {
      // Run tests for changed files
      const testResult = await this.runTests(changedFiles);
      
      if (!testResult.passed) {
        return {
          passed: false,
          guardrailId: this.id,
          severity: 'error',
          message: `${testResult.failedTests} of ${testResult.totalTests} tests failed`,
          details: {
            totalTests: testResult.totalTests,
            passedTests: testResult.passedTests,
            failedTests: testResult.failedTests,
            failures: testResult.failures,
          },
          suggestion: 'Fix failing tests before proceeding',
        };
      }
      
      return {
        passed: true,
        guardrailId: this.id,
        message: `All ${testResult.totalTests} tests passed`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `Test execution failed: ${errorMsg.substring(0, 200)}`,
      };
    }
  }
  
  async remediate(context: ExecutionContext, violation: GuardrailResult): Promise<RemediationResult> {
    const failures = (violation.details as { failures?: TestFailure[] })?.failures || [];
    
    // Generate fix prompt with test failure details
    const failureSummary = failures.map(f => 
      `- ${f.testName}: ${f.error.substring(0, 100)}`
    ).join('\n');
    
    return {
      success: true,
      action: 'fix_tests',
      message: `Attempting to fix ${failures.length} failing tests`,
      newContext: {
        prompt: `${context.prompt}\n\n[GUARDRAIL REMEDIATION] Tests are failing:\n${failureSummary}\n\nPlease fix the implementation to make all tests pass.`,
      },
    };
  }
  
  escalation = {
    afterFailures: 3,
    action: 'humanReview' as const,
  };
  
  /**
   * Run tests for the given files
   */
  private async runTests(changedFiles: string[]): Promise<TestRunResult> {
    // Determine test files to run based on changed files
    const testFiles = this.findRelatedTests(changedFiles);
    
    if (testFiles.length === 0) {
      return {
        passed: true,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        failures: [],
      };
    }
    
    try {
      // Run vitest on specific test files
      const testPattern = testFiles.length > 0 
        ? testFiles.join(' ')
        : '';
      
      const { stdout, stderr } = await execAsync(
        `npx vitest run ${testPattern} --reporter=json 2>&1`,
        {
          timeout: 120000,
          cwd: process.cwd(),
        }
      );
      
      // Parse test results
      return this.parseTestResults(stdout + stderr);
    } catch (error) {
      // Vitest exits with non-zero on test failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      return this.parseTestResults(errorMsg);
    }
  }
  
  /**
   * Find test files related to changed files
   */
  private findRelatedTests(changedFiles: string[]): string[] {
    const testFiles: string[] = [];
    
    for (const file of changedFiles) {
      // Convert src/path/file.ts → test/path/file.test.ts
      if (file.startsWith('src/')) {
        const testFile = file
          .replace('src/', 'test/')
          .replace('.ts', '.test.ts');
        testFiles.push(testFile);
      }
    }
    
    return testFiles;
  }
  
  /**
   * Parse vitest JSON output
   */
  private parseTestResults(output: string): TestRunResult {
    try {
      // Try to find JSON in output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        
        const failures: TestFailure[] = [];
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        
        // Extract from vitest results structure
        if (results.testResults) {
          for (const suite of results.testResults) {
            totalTests += suite.assertionResults?.length || 0;
            
            for (const test of suite.assertionResults || []) {
              if (test.status === 'passed') {
                passedTests++;
              } else {
                failedTests++;
                failures.push({
                  testName: test.title,
                  error: test.failureMessages?.[0] || 'Unknown error',
                  file: suite.name,
                });
              }
            }
          }
        }
        
        return {
          passed: failedTests === 0,
          totalTests,
          passedTests,
          failedTests,
          failures,
        };
      }
    } catch {
      // Failed to parse JSON
    }
    
    // Fallback: simple text parsing
    const passed = !output.includes('FAIL') && output.includes('PASS');
    const failMatch = output.match(/(\d+) failed/);
    const passMatch = output.match(/(\d+) passed/);
    
    return {
      passed,
      totalTests: parseInt(passMatch?.[1] || '0') + parseInt(failMatch?.[1] || '0'),
      passedTests: parseInt(passMatch?.[1] || '0'),
      failedTests: parseInt(failMatch?.[1] || '0'),
      failures: [],
    };
  }
}
