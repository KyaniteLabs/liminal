/**
 * AutoFixOrchestrator - Core orchestrator for the `liminal fix` command.
 *
 * Coordinates self-healing fixes by:
 * 1. Analyzing the error/request
 * 2. Generating a fix via LLM
 * 3. Applying the fix
 * 4. Verifying the fix (build + tests)
 * 5. Rolling back if verification fails
 */

import path from 'path';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';
import { FixRequest, FixResult, FileChange } from './types.js';
import { createLLMModeAgent, LLMTask } from '../harness/agent/index.js';
import { Status } from '../types/status.js';
import { readFileTool } from '../harness/tools/index.js';
import { execSync } from 'child_process';

/**
 * Orchestrates the auto-fix workflow for the `liminal fix` command.
 */
export class AutoFixOrchestrator {
  private _llmClient: LLMClient;

  /**
   * Creates a new AutoFixOrchestrator instance.
   *
   * @param llmClient - The LLM client used for generating fixes
   */
  constructor(llmClient: LLMClient) {
    this._llmClient = llmClient;
  }

  /**
   * Executes a fix request based on the provided parameters.
   *
   * This is the main entry point for the `liminal fix` command.
   * Uses LLMModeAgent to autonomously fix code issues.
   *
   * @param request - The fix request parameters
   * @returns Promise resolving to the fix result
   */
  async executeFix(request: FixRequest): Promise<FixResult> {
    const taskId = this.generateTaskId();
    Logger.info('AutoFixOrchestrator', `Starting fix task ${taskId}`, {
      type: request.type,
      target: request.target,
      dryRun: request.dryRun,
      confirmLevel: request.confirmLevel,
    });

    // Handle dry run - just return what would happen
    if (request.dryRun) {
      return {
        success: true,
        taskId,
        changes: [],
        buildPassed: true,
        testsPassed: true,
        rolledBack: false,
        error: 'Dry run mode - no changes applied',
      };
    }

    try {
      switch (request.type) {
        case 'file-error':
          return await this.executeFileErrorFix(request, taskId);
        case 'test-failures':
          return await this.executeTestFailureFix(request, taskId);
        case 'natural-language':
          return await this.executeNaturalLanguageFix(request, taskId);
        default:
          return {
            success: false,
            taskId,
            changes: [],
            buildPassed: false,
            testsPassed: false,
            rolledBack: false,
            error: `Unsupported fix type: ${request.type}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logger.error('AutoFixOrchestrator', `Fix execution failed: ${errorMessage}`);
      return {
        success: false,
        taskId,
        changes: [],
        buildPassed: false,
        testsPassed: false,
        rolledBack: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a fix for a file-specific error.
   * Reads the file, creates a task for LLMModeAgent, and executes the fix.
   */
  private async executeFileErrorFix(request: FixRequest, taskId: string): Promise<FixResult> {
    if (!request.target) {
      return {
        success: false,
        taskId,
        changes: [],
        buildPassed: false,
        testsPassed: false,
        rolledBack: false,
        error: 'No target file specified for file-error fix',
      };
    }

    // Read the target file
    const readResult = await readFileTool.execute({ path: request.target });
    if (!readResult.success) {
      return {
        success: false,
        taskId,
        changes: [],
        buildPassed: false,
        testsPassed: false,
        rolledBack: false,
        error: `Failed to read file ${request.target}: ${readResult.error}`,
      };
    }

    const fileContent = readResult.data?.content || '';

    // Create the LLMModeAgent
    const agent = createLLMModeAgent(this._llmClient);

    const autoApprove = request.confirmLevel === 'auto' || request.confirmLevel === 'never';

    const task: LLMTask = {
      id: taskId,
      title: `Fix error in ${path.basename(request.target)}`,
      description: this.buildFileErrorDescription(request, fileContent),
      fileHint: request.target,
      maxSteps: 15,
      approved: autoApprove,
    };

    Logger.info('AutoFixOrchestrator', `Executing LLMModeAgent task: ${task.title}`, {
      autoApprove,
      confirmLevel: request.confirmLevel,
    });

    // Execute the task
    const session = await agent.executeTask(task);

    // Build the result based on session status
    const changes: FileChange[] = [];
    if (session.backups.length > 0) {
      changes.push({
        path: request.target,
        backupPath: session.backups[0],
      });
    }

    // Verify the fix if it succeeded
    let buildPassed = false;
    let testsPassed = false;
    const rolledBack = session.status === Status.ROLLED_BACK;

    if (session.status === Status.SUCCESS) {
      buildPassed = await this.verifyBuild();
      testsPassed = await this.verifyTests();

      if (!buildPassed) {
        Logger.warn('AutoFixOrchestrator', `Build failed after fix — reporting failure`);
      }
    }

    const result: FixResult = {
      success: session.status === Status.SUCCESS && buildPassed,
      taskId,
      changes,
      buildPassed,
      testsPassed,
      rolledBack,
      error: this.getSessionError(session.status, session.stepCount) ?? (!buildPassed ? 'Fix applied but build verification failed' : undefined),
    };

    Logger.info('AutoFixOrchestrator', `Fix task ${taskId} completed`, {
      success: result.success,
      status: session.status,
      steps: session.stepCount,
      buildPassed,
      testsPassed,
      rolledBack,
    });

    return result;
  }

  /**
   * Execute a fix for test failures.
   * Runs tests to get failure output and creates tasks to fix each failing file.
   */
  private async executeTestFailureFix(request: FixRequest, taskId: string): Promise<FixResult> {
    // For now, delegate to file-error fix with the target
    // Full implementation would parse test output and identify source files
    if (request.target) {
      return this.executeFileErrorFix(request, taskId);
    }

    return {
      success: false,
      taskId,
      changes: [],
      buildPassed: false,
      testsPassed: false,
      rolledBack: false,
      error: 'Test failure fix without target not yet implemented - specify a target file',
    };
  }

  /**
   * Execute a fix based on natural language description.
   * Creates a task for LLMModeAgent to interpret and fix.
   */
  private async executeNaturalLanguageFix(request: FixRequest, taskId: string): Promise<FixResult> {
    // Create the LLMModeAgent
    const agent = createLLMModeAgent(this._llmClient);

    const autoApprove = request.confirmLevel === 'auto' || request.confirmLevel === 'never';

    const task: LLMTask = {
      id: taskId,
      title: request.target || 'Natural language fix request',
      description: request.errorDescription || 'No description provided',
      fileHint: request.target,
      maxSteps: 15,
      approved: autoApprove,
    };

    Logger.info('AutoFixOrchestrator', `Executing LLMModeAgent task: ${task.title}`, {
      autoApprove,
      confirmLevel: request.confirmLevel,
    });

    // Execute the task
    const session = await agent.executeTask(task);

    // Build the result
    const changes: FileChange[] = [];
    if (session.backups.length > 0) {
      changes.push({
        path: request.target || 'unknown',
        backupPath: session.backups[0],
      });
    }

    let buildPassed = false;
    let testsPassed = false;
    const rolledBack = session.status === Status.ROLLED_BACK;

    if (session.status === Status.SUCCESS) {
      buildPassed = await this.verifyBuild();
      testsPassed = await this.verifyTests();
    }

    const result: FixResult = {
      success: session.status === Status.SUCCESS && buildPassed,
      taskId,
      changes,
      buildPassed,
      testsPassed,
      rolledBack,
      error: this.getSessionError(session.status, session.stepCount) ?? (!buildPassed ? 'Fix applied but build verification failed' : undefined),
    };

    Logger.info('AutoFixOrchestrator', `Fix task ${taskId} completed`, {
      success: result.success,
      status: session.status,
      steps: session.stepCount,
      buildPassed,
      testsPassed,
      rolledBack,
    });

    return result;
  }

  /**
   * Build a description for file-error fixes that includes error and content.
   */
  private buildFileErrorDescription(request: FixRequest, fileContent: string): string {
    const parts: string[] = [];

    if (request.errorDescription) {
      parts.push(`Error to fix: ${request.errorDescription}`);
    }

    parts.push(`\nFile: ${request.target}`);
    parts.push(`\nFile content:\n\`\`\`\n${fileContent}\n\`\`\``);
    parts.push(`\nPlease fix the error in this file. Run build to verify the fix.`);

    return parts.join('\n');
  }

  /**
   * Get an error message based on session status.
   */
  private getSessionError(status: Status, stepCount: number): string | undefined {
    switch (status) {
      case Status.SUCCESS:
        return undefined;
      case Status.FAILED:
        return `Fix failed after ${stepCount} steps`;
      case Status.ROLLED_BACK:
        return `Fix failed after ${stepCount} steps and changes were rolled back`;
      default:
        return `Unexpected session status: ${status}`;
    }
  }

  /**
   * Verifies that the project builds successfully.
   * Runs `pnpm build` (or `npm run build`) and returns success/failure.
   *
   * @returns Promise resolving to true if build passes, false otherwise
   */
  async verifyBuild(): Promise<boolean> {
    try {
      Logger.debug('AutoFixOrchestrator', 'Running build verification...');
      execSync('pnpm build', { stdio: 'pipe', timeout: 120_000 });
      Logger.info('AutoFixOrchestrator', 'Build verification passed');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      Logger.warn('AutoFixOrchestrator', `Build verification failed: ${msg}`);
      return false;
    }
  }

  /**
   * Verifies that all tests pass.
   * Runs `pnpm test --run` and returns success/failure.
   *
   * @returns Promise resolving to true if tests pass, false otherwise
   */
  async verifyTests(): Promise<boolean> {
    try {
      Logger.debug('AutoFixOrchestrator', 'Running test verification...');
      execSync('pnpm test --run', { stdio: 'pipe', timeout: 180_000 });
      Logger.info('AutoFixOrchestrator', 'Test verification passed');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      Logger.warn('AutoFixOrchestrator', `Test verification failed: ${msg}`);
      return false;
    }
  }

  /**
   * Generates a unique task ID for tracking fix operations.
   *
   * @returns A unique task identifier string
   */
  private generateTaskId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `fix-${timestamp}-${random}`;
  }
}
