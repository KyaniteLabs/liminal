/**
 * HarnessAgent - Self-Improving Agent for Liminal
 * 
 * Architecture inspired by:
 * - Karpathy Autoresearch: program.md (human) + agent execution
 * - Meta-Harness (arXiv:2603.28052): Outer-loop harness engineering
 * - Claude Code: Tool-based agent with query engine
 */

import { LLMClient } from '../../llm/LLMClient.js';
import { Logger } from '../../utils/Logger.js';
import { failureLogger } from '../FailureLogger.js';
import { Status } from '../../types/status.js';
import { rateLimiter } from '../tools/RateLimiter.js';
import { formatError } from '../../utils/errors.js';
import { SecurityError } from '../errors.js';
import { selfEvaluation } from '../SelfEvaluation.js';
import { telemetryWrapper } from '../tools/TelemetryWrapper.js';
import {
  readFileTool,
  writeFileTool,
  applyEditTool,
  runBuildTool,
  runTestsTool,
  executeSkillTool,
  searchTool,
  searchCodeTool,
  searchDocsTool,
  listDirTool,
  typeCheckTool,
  npmTool,
  runLintTool,
  runFocusedTestsTool,
  lspTool,
  astValidatorTool,
  importGuardTool,
  toolCatalogTool,
  createBackupTool,
  restoreBackupTool,
} from '../tools/index.js';
import type { ToolResult } from '../tools/types.js';

const AVAILABLE_TOOL_NAMES = [
  'readFile',
  'applyEdit',
  'writeFile',
  'runBuild',
  'runTests',
  'executeSkill',
  'search',
  'searchCode',
  'searchDocs',
  'listDir',
  'typeCheck',
  'npm',
  'runLint',
  'runFocusedTests',
  'lsp',
  'astValidate',
  'importGuard',
  'searchTools',
  'gitStatus',
  'createBackup',
  'restoreBackup',
] as const;

function unknownToolMessage(toolName: string): string {
  const shellHint = ['execute', 'bash', 'shell', 'runCommand', 'terminal'].includes(toolName)
    ? ' There is no generic shell/execute tool; use gitStatus for repo state, readFile/listDir/search/searchCode for inspection and runBuild/typeCheck/runTests/runFocusedTests/runLint/npm for verification.'
    : '';
  return `Unknown tool: ${toolName}.${shellHint} Available tools: ${AVAILABLE_TOOL_NAMES.join(', ')}`;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  targetFile?: string;
  search?: string;
  replace?: string;
  verifyCommand?: string;
  approved: boolean;
}

export interface AgentStep {
  tool: string;
  params: unknown;
  result: ToolResult;
  timestamp: string;
}

export interface AgentSession {
  task: AgentTask;
  steps: AgentStep[];
  status: Status.PENDING | Status.RUNNING | Status.SUCCESS | Status.FAILED | Status.ROLLED_BACK;
  startTime: string;
  endTime?: string;
}

/**
 * HarnessAgent - The self-improving agent
 * 
 * Follows the Autoresearch pattern:
 * - Human writes task in harness-tasks/*.md
 * - Agent reads, plans, executes using tools
 * - Fixed-time execution with verification
 * - Rolls back on failure
 */
export class HarnessAgent {
  private llmClient: LLMClient;
  private sessions: Map<string, AgentSession> = new Map();
  private currentSession?: AgentSession;
  private reasoningContext?: string;
  private reasoningTraceId?: string;

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Set reasoning context for telemetry correlation
   */
  setReasoningContext(reasoning: string, traceId?: string): void {
    this.reasoningContext = reasoning;
    this.reasoningTraceId = traceId;
    telemetryWrapper.setContext({
      reasoning: this.reasoningContext,
      reasoningTraceId: this.reasoningTraceId,
    });
  }

  /**
   * Clear reasoning context
   */
  clearReasoningContext(): void {
    this.reasoningContext = undefined;
    this.reasoningTraceId = undefined;
    telemetryWrapper.clearContext();
  }

  /**
   * Execute a task from harness-tasks/
   * 
   * Pattern: Autoresearch fixed-time experiment
   * - Task has fixed budget (max steps, max time)
   * - If not successful within budget, rollback and report
   */
  async executeTask(task: AgentTask, options: {
    maxSteps?: number;
    timeoutMs?: number;
    autoRollback?: boolean;
  } = {}): Promise<AgentSession> {
    if (task.approved !== true) {
      throw new Error(`Task "${task.id}" must be explicitly approved before execution.`);
    }

    const { maxSteps = 10, timeoutMs = 300000, autoRollback = true } = options;
    
    const session: AgentSession = {
      task,
      steps: [],
      status: Status.RUNNING,
      startTime: new Date().toISOString(),
    };
    
    this.sessions.set(task.id, session);
    this.currentSession = session;

    Logger.debug('HarnessAgent', `Starting task: ${task.title}`);
    Logger.debug('HarnessAgent', `Budget: ${maxSteps} steps, ${timeoutMs}ms timeout`);

    try {
      // Step 1: Read the target file if specified
      if (task.targetFile) {
        const readResult = await this.callTool('readFile', { 
          path: task.targetFile,
          maxLines: 200,
        });
        
        if (!readResult.success) {
          throw new Error(`Failed to read target file: ${readResult.error}`);
        }
      }

      // Step 2: Apply the fix if search/replace provided
      if (task.search && task.replace && task.targetFile) {
        const editResult = await this.callTool('applyEdit', {
          path: task.targetFile,
          oldString: task.search,
          newString: task.replace,
        });

        if (!editResult.success) {
          throw new Error(`Failed to apply edit: ${editResult.error}`);
        }

        Logger.debug('HarnessAgent', `Applied edit to ${task.targetFile}`);
      }

      // Step 3: Verify with build
      const buildResult = await this.callTool('runBuild', {});
      
      if (!buildResult.success) {
        Logger.error('HarnessAgent', `Build failed: ${buildResult.error}`);
        
        if (autoRollback) {
          Logger.debug('HarnessAgent', 'Rolling back changes...');
          await this.rollback(session);
          session.status = Status.ROLLED_BACK;
        } else {
          session.status = Status.FAILED;
        }
        
        // Log failure for pattern detection
        failureLogger.log({
          model: this.llmClient['config']?.model || 'harness-agent',
          domain: 'harness',
          prompt: task.description,
          error: `Build failed after edit: ${buildResult.error}`,
          errorType: 'validation',
          duration: Date.now() - new Date(session.startTime).getTime(),
        });
        
        return session;
      }

      // Step 4: Run verification command if provided
      if (task.verifyCommand) {
        const verifyResult = await this.runVerification(task.verifyCommand);
        if (!verifyResult.success) {
          throw new Error(`Verification failed: ${verifyResult.error}`);
        }
      }

      // Success!
      session.status = Status.SUCCESS;
      session.endTime = new Date().toISOString();
      
      Logger.debug('HarnessAgent', 'Task completed successfully!');
      Logger.debug('HarnessAgent', `Steps executed: ${session.steps.length}`);
      
      // Self-evaluation: Record success
      selfEvaluation.recordOutcome({
        taskId: task.id,
        success: true,
        duration: Date.now() - new Date(session.startTime).getTime(),
        toolsUsed: session.steps.map(s => s.tool),
        errors: [],
        strategy: task.verifyCommand ? 'verify-first' : 'direct',
        timestamp: session.endTime,
      });
      
      return session;
      
    } catch (error) {
      session.status = Status.FAILED;
      session.endTime = new Date().toISOString();
      
      const errorMsg = formatError('HarnessAgent', error);
      Logger.error('HarnessAgent', errorMsg);
      
      // Log failure
      failureLogger.log({
        model: this.llmClient['config']?.model || 'harness-agent',
        domain: 'harness',
        prompt: task.description,
        error: errorMsg,
        errorType: 'generation',
        duration: Date.now() - new Date(session.startTime).getTime(),
      });
      
      // Self-evaluation: Record failure
      selfEvaluation.recordOutcome({
        taskId: task.id,
        success: false,
        duration: Date.now() - new Date(session.startTime).getTime(),
        toolsUsed: session.steps.map(s => s.tool),
        errors: [errorMsg],
        strategy: task.verifyCommand ? 'verify-first' : 'direct',
        timestamp: session.endTime,
      });
      
      // Self-correction: Check if retry is warranted
      const retryDecision = selfEvaluation.shouldRetry(task.id, task.verifyCommand ? 'verify-first' : 'direct');
      if (retryDecision.shouldRetry && autoRollback) {
        Logger.debug('HarnessAgent', `Self-correction: ${retryDecision.reason}`);
        await this.rollback(session);
        session.status = Status.ROLLED_BACK;
        
        // Log the retry strategy
        Logger.debug('HarnessAgent', `Will retry with strategy: ${retryDecision.newStrategy}`);
      }
      
      if (autoRollback && session.steps.length > 0 && !retryDecision.shouldRetry) {
        await this.rollback(session);
        session.status = Status.ROLLED_BACK;
      }
      
      return session;
    }
  }

  /**
   * Call a tool with rate limiting and telemetry
   */
  private async callTool(toolName: string, params: unknown): Promise<ToolResult> {
    const operation = toolName === 'readFile' || toolName === 'executeSkill' || toolName === 'searchCode' || toolName === 'searchDocs'
      ? 'fileRead'
      : toolName === 'writeFile' || toolName === 'applyEdit'
        ? 'fileWrite'
        : toolName === 'runBuild'
          ? 'buildRun'
          : 'testRun';
    
    // Update context with current session info
    telemetryWrapper.setContext({
      reasoning: this.reasoningContext,
      reasoningTraceId: this.reasoningTraceId,
      taskId: this.currentSession?.task.id,
      iteration: this.currentSession?.steps.length,
    });
    
    const rateLimitResult = await rateLimiter.execute(operation, async () => {
      // Get the tool instance
      const tool = this.getToolInstance(toolName);
      if (!tool) {
        return { success: false, error: unknownToolMessage(toolName) };
      }
      
      // Wrap with telemetry
      return telemetryWrapper.wrap(tool, params);
    });

    const result = rateLimitResult.result || { 
      success: false, 
      error: rateLimitResult.error || 'Rate limit exceeded',
    };

    if (this.currentSession) {
      this.currentSession.steps.push({
        tool: toolName,
        params,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  }

  /**
   * Get tool instance by name
   */
  private getToolInstance(toolName: string) {
    switch (toolName) {
      case 'readFile': return readFileTool;
      case 'writeFile': return writeFileTool;
      case 'applyEdit': return applyEditTool;
      case 'runBuild': return runBuildTool;
      case 'runTests': return runTestsTool;
      case 'executeSkill': return executeSkillTool;
      case 'search': return searchTool;
      case 'searchCode': return searchCodeTool;
      case 'searchDocs': return searchDocsTool;
      case 'listDir': return listDirTool;
      case 'typeCheck': return typeCheckTool;
      case 'npm': return npmTool;
      case 'runLint': return runLintTool;
      case 'runFocusedTests': return runFocusedTestsTool;
      case 'lsp': return lspTool;
      case 'astValidate': return astValidatorTool;
      case 'importGuard': return importGuardTool;
      case 'searchTools': return toolCatalogTool;
      case 'createBackup': return createBackupTool;
      case 'restoreBackup': return restoreBackupTool;
      default: return null;
    }
  }

  /**
   * Rollback all changes in a session
   */
  private async rollback(session: AgentSession): Promise<void> {
    Logger.debug('HarnessAgent', `Rolling back ${session.steps.length} steps...`);
    
    for (const step of [...session.steps].reverse()) {
      const data = step.result.data as { backupPath?: string } | undefined;
      if ((step.tool === 'applyEdit' || step.tool === 'writeFile') && 
          data?.backupPath) {
        await this.callTool('restoreBackup', {
          backupPath: data.backupPath,
        });
      }
    }
    
    Logger.debug('HarnessAgent', 'Rollback complete');
  }

  /**
   * Run verification command
   * SECURITY: Uses allowlist validation to prevent command injection
   */
  private async runVerification(command: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      
      // SECURITY: Allowlist validation to prevent command injection
      const ALLOWED_COMMANDS = ['npm run build', 'npm run test', 'npm run typecheck', 'npm run lint'];
      if (!ALLOWED_COMMANDS.includes(command)) {
        throw new SecurityError(`Command not in allowlist: ${command}`);
      }
      
      const [cmd, ...args] = command.split(' ');
      await execFileAsync(cmd, args, { timeout: 30000 });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: formatError('HarnessAgent executeCommand', error),
      };
    }
  }

  getSession(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  generateReport(): string {
    const sessions = this.getAllSessions();
    const successful = sessions.filter(s => s.status === Status.SUCCESS).length;
    const failed = sessions.filter(s => s.status === Status.FAILED).length;
    const rolledBack = sessions.filter(s => s.status === Status.ROLLED_BACK).length;

    return `
# HarnessAgent Report

Generated: ${new Date().toISOString()}

## Summary
- Total Tasks: ${sessions.length}
- Successful: ${successful}
- Failed: ${failed}
- Rolled Back: ${rolledBack}

## Sessions
${sessions.map(s => `
### ${s.task.id}: ${s.task.title}
- Status: ${s.status}
- Steps: ${s.steps.length}
- Duration: ${s.endTime ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime() : 'ongoing'}ms
`).join('')}
`.trim();
  }

  /**
   * Self-evaluation: Get current performance metrics
   */
  selfEvaluate(): {
    summary: string;
    needsImprovement: boolean;
    recommendations: string[];
  } {
    const evaluation = selfEvaluation.evaluate();
    const regression = selfEvaluation.detectRegression();
    
    const summary = selfEvaluation.getSummary();
    
    return {
      summary,
      needsImprovement: evaluation.needsImprovement || regression.hasRegression,
      recommendations: [
        ...evaluation.recommendations,
        regression.hasRegression ? regression.details : null,
      ].filter(Boolean) as string[],
    };
  }

  /**
   * Self-correction: Get improvement task if needed
   */
  generateImprovementTask(): {
    shouldCreate: boolean;
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  } {
    return selfEvaluation.generateImprovementTask();
  }

  /**
   * Get error remediation suggestions
   */
  getErrorHelp(error: string): string[] {
    return selfEvaluation.getErrorRemediation(error);
  }
}

export function createHarnessAgent(llmClient: LLMClient): HarnessAgent {
  return new HarnessAgent(llmClient);
}
