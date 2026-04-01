/**
 * HarnessAgent - Self-Improving Agent for Liminal
 * 
 * Architecture inspired by:
 * - Karpathy Autoresearch: program.md (human) + agent execution
 * - Meta-Harness (arXiv:2603.28052): Outer-loop harness engineering
 * - Claude Code: Tool-based agent with query engine
 */

import { LLMClient } from '../../llm/LLMClient.js';
import { failureLogger } from '../FailureLogger.js';
import { rateLimiter } from '../tools/RateLimiter.js';
import { selfEvaluation } from '../SelfEvaluation.js';
import {
  readFileTool,
  writeFileTool,
  applyEditTool,
  runBuildTool,
  runTestsTool,
  searchTool,
  listDirTool,
  typeCheckTool,
  npmTool,
  lspTool,
  astValidatorTool,
  importGuardTool,
  restoreBackupTool,
} from '../tools/index.js';
import type { ToolResult } from '../tools/types.js';

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
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
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

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
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
    const { maxSteps = 10, timeoutMs = 300000, autoRollback = true } = options;
    
    const session: AgentSession = {
      task,
      steps: [],
      status: 'running',
      startTime: new Date().toISOString(),
    };
    
    this.sessions.set(task.id, session);
    this.currentSession = session;

    console.log(`[HarnessAgent] Starting task: ${task.title}`);
    console.log(`[HarnessAgent] Budget: ${maxSteps} steps, ${timeoutMs}ms timeout`);

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

        console.log(`[HarnessAgent] Applied edit to ${task.targetFile}`);
      }

      // Step 3: Verify with build
      const buildResult = await this.callTool('runBuild', {});
      
      if (!buildResult.success) {
        console.error(`[HarnessAgent] Build failed:`, buildResult.error);
        
        if (autoRollback) {
          console.log(`[HarnessAgent] Rolling back changes...`);
          await this.rollback(session);
          session.status = 'rolled_back';
        } else {
          session.status = 'failed';
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
      session.status = 'success';
      session.endTime = new Date().toISOString();
      
      console.log(`[HarnessAgent] Task completed successfully!`);
      console.log(`[HarnessAgent] Steps executed: ${session.steps.length}`);
      
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
      session.status = 'failed';
      session.endTime = new Date().toISOString();
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[HarnessAgent] Task failed:`, errorMsg);
      
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
        console.log(`[HarnessAgent] Self-correction: ${retryDecision.reason}`);
        await this.rollback(session);
        session.status = 'rolled_back';
        
        // Log the retry strategy
        console.log(`[HarnessAgent] Will retry with strategy: ${retryDecision.newStrategy}`);
      }
      
      if (autoRollback && session.steps.length > 0 && !retryDecision.shouldRetry) {
        await this.rollback(session);
        session.status = 'rolled_back';
      }
      
      return session;
    }
  }

  /**
   * Call a tool with rate limiting
   */
  private async callTool(toolName: string, params: unknown): Promise<ToolResult> {
    const operation = toolName === 'readFile' ? 'fileRead' : 
                      toolName === 'writeFile' || toolName === 'applyEdit' ? 'fileWrite' :
                      toolName === 'runBuild' ? 'buildRun' : 'testRun';
    
    const rateLimitResult = await rateLimiter.execute(operation, async () => {
      switch (toolName) {
        case 'readFile':
          return readFileTool.execute(params);
        case 'writeFile':
          return writeFileTool.execute(params);
        case 'applyEdit':
          return applyEditTool.execute(params);
        case 'runBuild':
          return runBuildTool.execute(params);
        case 'runTests':
          return runTestsTool.execute(params);
        case 'search':
          return searchTool.execute(params);
        case 'listDir':
          return listDirTool.execute(params);
        case 'typeCheck':
          return typeCheckTool.execute(params);
        case 'npm':
          return npmTool.execute(params);
        case 'lsp':
          return lspTool.execute(params);
        case 'astValidate':
          return astValidatorTool.execute(params);
        case 'importGuard':
          return importGuardTool.execute(params);
        case 'restoreBackup':
          return restoreBackupTool.execute(params);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
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
   * Rollback all changes in a session
   */
  private async rollback(session: AgentSession): Promise<void> {
    console.log(`[HarnessAgent] Rolling back ${session.steps.length} steps...`);
    
    for (const step of [...session.steps].reverse()) {
      const data = step.result.data as { backupPath?: string } | undefined;
      if ((step.tool === 'applyEdit' || step.tool === 'writeFile') && 
          data?.backupPath) {
        await this.callTool('restoreBackup', {
          backupPath: data.backupPath,
        });
      }
    }
    
    console.log(`[HarnessAgent] Rollback complete`);
  }

  /**
   * Run verification command
   */
  private async runVerification(command: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      
      await execFileAsync('sh', ['-c', command], { timeout: 30000 });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
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
    const successful = sessions.filter(s => s.status === 'success').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const rolledBack = sessions.filter(s => s.status === 'rolled_back').length;

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
