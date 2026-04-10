/**
 * LLMModeAgent - Full LLM-driven agent with planning and reflection
 * 
 * Unlike HarnessAgent (structured tasks), this agent:
 * - Uses LLM to plan which tools to call
 * - Reflects on tool results
 * - Adapts strategy based on feedback
 * - Handles multi-step reasoning
 */

import { LLMClient } from '../../llm/LLMClient.js';
import { ContextCompactor } from '../../llm/ContextCompactor.js';
import { Logger } from '../../utils/Logger.js';
import { failureLogger } from '../FailureLogger.js';
import { Status } from '../../types/status.js';
import { rateLimiter } from '../tools/RateLimiter.js';
import { formatError } from '../../utils/errors.js';
import { getSelfImprovePrompt, createReflectionPrompt } from '../prompts/self-improve.js';
import { thinkingRepository } from '../ThinkingSeparation.js';
import { thinkingAnalyzer } from '../ThinkingAnalyzer.js';
import { eventBus, EventTypes } from '../../core/EventBus.js';
import { telemetryWrapper } from '../tools/TelemetryWrapper.js';
import {
  readFileTool,
  writeFileTool,
  applyEditTool,
  runBuildTool,
  runTestsTool,
  restoreBackupTool,
  createBackupTool,
  searchTool,
  listDirTool,
  typeCheckTool,
  npmTool,
  lspTool,
  astValidatorTool,
  importGuardTool,
} from '../tools/index.js';
import type { ToolResult } from '../tools/types.js';

export interface LLMTask {
  id: string;
  title: string;
  description: string;
  fileHint?: string;
  maxSteps?: number;
  approved: boolean;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
  thought: string;
  expectedResult: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface LLMSession {
  task: LLMTask;
  messages: AgentMessage[];
  status: Status.PENDING | Status.RUNNING | Status.SUCCESS | Status.FAILED | Status.ROLLED_BACK;
  startTime: string;
  endTime?: string;
  stepCount: number;
  backups: string[];
}

/**
 * LLMModeAgent - The autonomous self-improving agent
 * 
 * Architecture:
 * 1. LLM plans tool calls based on task description
 * 2. Agent executes the tool
 * 3. Tool result fed back to LLM
 * 4. LLM reflects and plans next step
 * 5. Repeat until success or max steps
 */
export class LLMModeAgent {
  private llmClient: LLMClient;
  private sessions: Map<string, LLMSession> = new Map();
  private currentSession?: LLMSession;
  private analyses: import('../ThinkingAnalyzer.js').ThinkingAnalysis[] = [];
  private compactor = new ContextCompactor({ maxMessages: 40, recentThreshold: 14 });

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Execute a task using LLM-driven planning
   */
  async executeTask(task: LLMTask): Promise<LLMSession> {
    if (task.approved !== true) {
      throw new Error(`Task "${task.id}" must be explicitly approved before execution.`);
    }

    const maxSteps = task.maxSteps || 15;
    
    const session: LLMSession = {
      task,
      messages: [],
      status: Status.RUNNING,
      startTime: new Date().toISOString(),
      stepCount: 0,
      backups: [],
    };

    this.sessions.set(task.id, session);
    this.currentSession = session;

    Logger.debug('LLMModeAgent', `Starting autonomous task: ${task.title}`);
    Logger.debug('LLMModeAgent', `Budget: ${maxSteps} LLM calls`);

    // Emit start event for TUI/SSE streaming
    eventBus.emit(EventTypes.PROCESS_START, 'LLMModeAgent', {
      process: 'agent-task',
      stage: 'planning',
      metadata: { taskId: task.id, title: task.title, maxSteps },
    });

    // Initialize conversation with system prompt
    session.messages.push({
      role: 'system',
      content: getSelfImprovePrompt(),
    });

    // Add task description
    const taskPrompt = `## Current Task

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
${task.fileHint ? `Hint: Start by looking in ${task.fileHint}` : ''}

You are in LLM-driven mode. Plan your own steps. Start by reading the relevant file(s).

Respond with a JSON object containing your tool call:
{\n  "thought": "What you're doing and why",\n  "tool": "toolName",\n  "params": { ... },\n  "expectedResult": "What you expect"\n}

When the task is complete and build passes, respond with tool "complete".`;

    session.messages.push({
      role: 'user',
      content: taskPrompt,
    });

    try {
      while (session.stepCount < maxSteps) {
        session.stepCount++;
        Logger.debug('LLMModeAgent', `Step ${session.stepCount}/${maxSteps}`);

        // Emit progress event for TUI
        eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
          process: 'agent-task',
          current: session.stepCount,
          total: maxSteps,
          stage: `planning step ${session.stepCount}`,
        });

        // Get LLM's plan
        const toolCall = await this.getLLMPlan(session);
        
        if (!toolCall) {
          Logger.error('LLMModeAgent', 'Failed to parse LLM response');
          break;
        }

        // Record assistant's plan
        session.messages.push({
          role: 'assistant',
          content: JSON.stringify(toolCall),
          toolCall,
        });

        // Check for completion
        if (toolCall.tool === 'complete') {
          Logger.debug('LLMModeAgent', 'Task completed by LLM');
          session.status = Status.SUCCESS;
          session.endTime = new Date().toISOString();
          eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
            process: 'agent-task',
            success: true,
            iterations: session.stepCount,
            durationMs: Date.now() - new Date(session.startTime).getTime(),
          });
          return session;
        }

        // Execute the tool
        const result = await this.executeTool(toolCall);

        // Emit tool execution event for TUI
        eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
          process: 'agent-task',
          current: session.stepCount,
          total: maxSteps,
          stage: `executed ${toolCall.tool}`,
          message: result.success ? `${toolCall.tool} succeeded` : `${toolCall.tool} failed: ${(result.error || '').slice(0, 100)}`,
        });
        
        // Record tool result
        session.messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolResult: result,
        });

        // Check for critical failures
        if (toolCall.tool === 'runBuild' && !result.success) {
          Logger.error('LLMModeAgent', 'Build failed - entering reflection mode');
          
          // Try to fix the error
          const fixed = await this.attemptErrorRecovery(session, result);
          
          if (!fixed) {
            // Rollback if we have backups
            if (session.backups.length > 0) {
              Logger.debug('LLMModeAgent', 'Rolling back changes...');
              await this.rollback(session);
              session.status = Status.ROLLED_BACK;
            } else {
              session.status = Status.FAILED;
            }
            
            // Log failure
            failureLogger.log({
              model: this.llmClient['config']?.model || 'llm-agent',
              domain: 'harness-llm',
              prompt: task.description,
              error: `Build failed after ${session.stepCount} steps: ${result.error}`,
              errorType: 'validation',
              duration: Date.now() - new Date(session.startTime).getTime(),
            });

            eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
              process: 'agent-task',
              success: false,
              reason: 'Build failed',
              iterations: session.stepCount,
              durationMs: Date.now() - new Date(session.startTime).getTime(),
            });

            return session;
          }
        }

        // Brief pause to show progress
        await new Promise(r => setTimeout(r, 100));
      }

      // Max steps reached
        Logger.error('LLMModeAgent', `Max steps (${maxSteps}) reached`);
      session.status = Status.FAILED;
      session.endTime = new Date().toISOString();

      eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
        process: 'agent-task',
        success: false,
        reason: `Max steps (${maxSteps}) reached`,
        iterations: session.stepCount,
        durationMs: Date.now() - new Date(session.startTime).getTime(),
      });
      
      // Rollback if needed
      if (session.backups.length > 0) {
        await this.rollback(session);
        session.status = Status.ROLLED_BACK;
      }

      return session;

    } catch (error) {
      Logger.error('LLMModeAgent', `Unexpected error: ${error}`);
      session.status = Status.FAILED;
      session.endTime = new Date().toISOString();

      eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
        process: 'agent-task',
        success: false,
        reason: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        iterations: session.stepCount,
      });

      if (session.backups.length > 0) {
        await this.rollback(session);
        session.status = Status.ROLLED_BACK;
      }

      failureLogger.log({
        model: this.llmClient['config']?.model || 'llm-agent',
        domain: 'harness-llm',
        prompt: task.description,
        error: formatError('LLMModeAgent', error),
        errorType: 'generation',
        duration: Date.now() - new Date(session.startTime).getTime(),
      });

      return session;
    }
  }

  /**
   * Get LLM's planned tool call
   */
  private async getLLMPlan(session: LLMSession): Promise<ToolCall | null> {
    const rateLimitResult = await rateLimiter.execute('llmCall', async () => {
      // Build conversation context
      let messages = session.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.role === 'system' ? m.content :
                 m.role === 'user' ? m.content :
                 m.role === 'assistant' ? JSON.stringify(m.toolCall) :
                 JSON.stringify(m.toolResult),
      }));

      // Compact if conversation is getting long
      if (this.compactor.needsCompaction(messages)) {
        messages = await this.compactor.compact(messages);
        Logger.debug('LLMModeAgent', `Compacted conversation from ${session.messages.length} to ${messages.length} messages`);
      }

      const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n');

      // Call LLM
      const response = await this.llmClient.complete({
        prompt: conversation + '\n\nWhat is your next tool call? Respond with JSON only.',
        maxTokens: 2000,
        temperature: 0.2, // Low temperature for deterministic tool calls
      });

      return response.text;
    });

    if (!rateLimitResult.result) {
      Logger.error('LLMModeAgent', 'Rate limit hit for LLM call');
      return null;
    }

    // Parse JSON response
    try {
      // rateLimiter.execute() wraps the return in { result: T }, so the text is
      // in rateLimitResult.result (which is the string returned from fn above).
      let text = String(rateLimitResult.result);

      // Strip <think/>, <thinkContent/>, and similar reasoning wrappers
      // Models like MiniMax M2.7 wrap reasoning in these tags before the JSON
      text = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
                 .replace(/<thinkContent\b[^>]*>[\s\S]*?<\/thinkContent>/gi, '')
                 .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
                 .trim();

      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
                        text.match(/```\s*([\s\S]*?)```/) ||
                        [null, text];
      const jsonStr = jsonMatch[1] || text;

      // Find the first '{' and try to parse from there — handles leading text before JSON
      const jsonStart = jsonStr.indexOf('{');
      if (jsonStart === -1) {
        Logger.error('LLMModeAgent', 'No JSON object found in response');
        return null;
      }
      const parsed = JSON.parse(jsonStr.slice(jsonStart));
      
      const toolCall = {
        thought: parsed.thought || 'No thought provided',
        tool: parsed.tool || 'unknown',
        params: parsed.params || {},
        expectedResult: parsed.expectedResult || 'No expectation set',
      };
      
      // CAPTURE HARNESS THINKING - this is the harness LLM's reasoning about fixing the system
      // This is DIFFERENT from generator thinking and must be kept separate
      thinkingRepository.storeHarnessThinking({
        model: this.llmClient.getConfig().model,
        thinking: toolCall.thought,
        context: 'adaptation',
      });

      // ANALYZE THINKING - feed the LLM's plan through the ThinkingAnalyzer
      // to detect patterns, suggest fixes, and extract learning insights
      try {
        const analysis = thinkingAnalyzer.analyze(
          {
            code: jsonStr,
            thinking: toolCall.thought,
            success: true,
          },
          toolCall.thought.slice(0, 200),
          'harness-llm',
          this.llmClient.getConfig().model,
        );

        // Store the analysis result for later retrieval via getRecentInsights
        this.storeAnalysis(analysis);
      } catch (analysisErr) {
        // Analysis failure must not break the agent loop
        Logger.warn('LLMModeAgent', `ThinkingAnalyzer failed: ${analysisErr}`);
      }

      return toolCall;
    } catch (e) {
      Logger.error('LLMModeAgent', `Failed to parse LLM response: ${e}`);
      Logger.error('LLMModeAgent', `Raw response: ${rateLimitResult.result}`);
      return null;
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { tool, params, thought } = toolCall;

    Logger.debug('LLMModeAgent', `${thought}`);
    Logger.debug('LLMModeAgent', `Executing: ${tool}(${JSON.stringify(params)})`);

    telemetryWrapper.setContext({
      taskId: this.currentSession?.task.id,
      iteration: this.currentSession?.stepCount,
    });

    const rateLimitResult = await rateLimiter.execute(
      tool === 'readFile' ? 'fileRead' :
      tool === 'writeFile' || tool === 'applyEdit' ? 'fileWrite' :
      tool === 'runBuild' ? 'buildRun' : 'testRun',
      async () => {
        switch (tool) {
          case 'readFile':
            return readFileTool.execute(params);
          
          case 'writeFile':
            return writeFileTool.execute(params);
          
          case 'applyEdit': {
            // Create backup first
            const backupResult = await createBackupTool.execute({ path: params.path });
            if (backupResult.success && backupResult.data?.backupPath) {
              this.currentSession?.backups.push(backupResult.data.backupPath as string);
            }
            return applyEditTool.execute(params);
          }
          
          case 'runBuild':
            return runBuildTool.execute(params);
          
          case 'runTests':
            return runTestsTool.execute(params);
          
          case 'restoreBackup':
            return restoreBackupTool.execute(params);
          
          case 'createBackup': {
            const result = await createBackupTool.execute(params);
            if (result.success && result.data?.backupPath) {
              this.currentSession?.backups.push(result.data.backupPath as string);
            }
            return result;
          }

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

          default:
            return { success: false, error: `Unknown tool: ${tool}` };
        }
      }
    );

    const result = rateLimitResult.result || {
      success: false,
      error: rateLimitResult.error || 'Rate limit exceeded',
    };

    Logger.debug('LLMModeAgent', `Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    if (result.error) {
      Logger.debug('LLMModeAgent', `Error: ${result.error.substring(0, 200)}`);
    }

    return result;
  }

  /**
   * Attempt to recover from build errors
   */
  private async attemptErrorRecovery(session: LLMSession, buildError: ToolResult): Promise<boolean> {
    Logger.debug('LLMModeAgent', 'Attempting error recovery...');

    // Add reflection prompt
    session.messages.push({
      role: 'user',
      content: createReflectionPrompt(buildError.error || 'Unknown build error'),
    });

    // Give LLM 3 attempts to fix
    for (let i = 0; i < 3; i++) {
      Logger.debug('LLMModeAgent', `Recovery attempt ${i + 1}/3`);
      
      const toolCall = await this.getLLMPlan(session);
      if (!toolCall || toolCall.tool === 'complete') {
        return false;
      }

      session.messages.push({
        role: 'assistant',
        content: JSON.stringify(toolCall),
        toolCall,
      });

      const result = await this.executeTool(toolCall);
      session.messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        toolResult: result,
      });

      if (toolCall.tool === 'runBuild' && result.success) {
        Logger.debug('LLMModeAgent', 'Recovery successful!');
        return true;
      }
    }

    Logger.debug('LLMModeAgent', 'Recovery failed after 3 attempts');
    return false;
  }

  /**
   * Rollback all changes
   */
  private async rollback(session: LLMSession): Promise<void> {
    Logger.debug('LLMModeAgent', `Rolling back ${session.backups.length} backups...`);
    
    for (const backupPath of [...session.backups].reverse()) {
      await rateLimiter.execute('fileWrite', async () => {
        return restoreBackupTool.execute({ backupPath });
      });
    }
    
    Logger.debug('LLMModeAgent', 'Rollback complete');
  }

  /**
   * Store a ThinkingAnalysis result and persist it via the repository
   */
  private storeAnalysis(analysis: import('../ThinkingAnalyzer.js').ThinkingAnalysis): void {
    this.analyses.push(analysis);

    // Persist analysis insights as harness thinking so they surface
    // in getRecentInsights() and getActionableItems()
    if (analysis.suggestedFix) {
      thinkingRepository.storeHarnessThinking({
        model: analysis.model,
        thinking: `[ThinkingAnalysis] ${analysis.learning}. Suggested fix: ${analysis.suggestedFix.description}`,
        context: 'improvement',
      });
    }
  }

  getSession(id: string): LLMSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): LLMSession[] {
    return Array.from(this.sessions.values());
  }

  getAnalyses(): import('../ThinkingAnalyzer.js').ThinkingAnalysis[] {
    return this.analyses;
  }

  generateReport(): string {
    const sessions = this.getAllSessions();
    const successful = sessions.filter(s => s.status === Status.SUCCESS).length;
    const failed = sessions.filter(s => s.status === Status.FAILED).length;
    const rolledBack = sessions.filter(s => s.status === Status.ROLLED_BACK).length;

    return `
# LLMModeAgent Report

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
- Steps: ${s.stepCount}
- LLM Calls: ${s.messages.filter(m => m.role === 'assistant').length}
- Backups: ${s.backups.length}
- Duration: ${s.endTime ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime() : 'ongoing'}ms
`).join('')}
`.trim();
  }
}

export function createLLMModeAgent(llmClient: LLMClient): LLMModeAgent {
  return new LLMModeAgent(llmClient);
}
