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
import { failureLogger } from '../FailureLogger.js';
import { Status } from '../../types/status.js';
import { rateLimiter } from '../tools/RateLimiter.js';
import { formatError } from '../../utils/errors.js';
import { getSelfImprovePrompt, createReflectionPrompt } from '../prompts/self-improve.js';
import {
  readFileTool,
  writeFileTool,
  applyEditTool,
  runBuildTool,
  runTestsTool,
  restoreBackupTool,
  createBackupTool,
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

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
  }

  /**
   * Execute a task using LLM-driven planning
   */
  async executeTask(task: LLMTask): Promise<LLMSession> {
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

    console.log(`[LLMModeAgent] Starting autonomous task: ${task.title}`);
    console.log(`[LLMModeAgent] Budget: ${maxSteps} LLM calls`);

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
        console.log(`\n[LLMModeAgent] Step ${session.stepCount}/${maxSteps}`);

        // Get LLM's plan
        const toolCall = await this.getLLMPlan(session);
        
        if (!toolCall) {
          console.error('[LLMModeAgent] Failed to parse LLM response');
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
          console.log('[LLMModeAgent] Task completed by LLM');
          session.status = Status.SUCCESS;
          session.endTime = new Date().toISOString();
          return session;
        }

        // Execute the tool
        const result = await this.executeTool(toolCall);
        
        // Record tool result
        session.messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolResult: result,
        });

        // Check for critical failures
        if (toolCall.tool === 'runBuild' && !result.success) {
          console.error('[LLMModeAgent] Build failed - entering reflection mode');
          
          // Try to fix the error
          const fixed = await this.attemptErrorRecovery(session, result);
          
          if (!fixed) {
            // Rollback if we have backups
            if (session.backups.length > 0) {
              console.log('[LLMModeAgent] Rolling back changes...');
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
            
            return session;
          }
        }

        // Brief pause to show progress
        await new Promise(r => setTimeout(r, 100));
      }

      // Max steps reached
      console.error(`[LLMModeAgent] Max steps (${maxSteps}) reached`);
      session.status = Status.FAILED;
      session.endTime = new Date().toISOString();
      
      // Rollback if needed
      if (session.backups.length > 0) {
        await this.rollback(session);
        session.status = Status.ROLLED_BACK;
      }

      return session;

    } catch (error) {
      console.error('[LLMModeAgent] Unexpected error:', error);
      session.status = Status.FAILED;
      session.endTime = new Date().toISOString();
      
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
      const conversation = session.messages.map(m => {
        if (m.role === 'system') return m.content;
        if (m.role === 'user') return `User: ${m.content}`;
        if (m.role === 'assistant') {
          const tc = m.toolCall!;
          return `Assistant: ${tc.thought}\nTool: ${tc.tool}\nParams: ${JSON.stringify(tc.params)}`;
        }
        if (m.role === 'tool') {
          const tr = m.toolResult!;
          return `Tool Result: ${tr.success ? 'SUCCESS' : 'FAILED'} - ${tr.error || 'OK'}`;
        }
        return '';
      }).join('\n\n---\n\n');

      // Call LLM
      const response = await this.llmClient.complete({
        prompt: conversation + '\n\nWhat is your next tool call? Respond with JSON only.',
        maxTokens: 2000,
        temperature: 0.2, // Low temperature for deterministic tool calls
      });

      return { result: response.text };
    });

    if (!rateLimitResult.result) {
      console.error('[LLMModeAgent] Rate limit hit for LLM call');
      return null;
    }

    // Parse JSON response
    try {
      const text = rateLimitResult.result as unknown as string;
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || 
                        text.match(/```\s*([\s\S]*?)```/) ||
                        [null, text];
      const jsonStr = jsonMatch[1] || text;
      const parsed = JSON.parse(jsonStr.trim());
      
      return {
        thought: parsed.thought || 'No thought provided',
        tool: parsed.tool || 'unknown',
        params: parsed.params || {},
        expectedResult: parsed.expectedResult || 'No expectation set',
      };
    } catch (e) {
      console.error('[LLMModeAgent] Failed to parse LLM response:', e);
      console.error('Raw response:', rateLimitResult.result);
      return null;
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const { tool, params, thought } = toolCall;
    
    console.log(`[LLMModeAgent] ${thought}`);
    console.log(`[LLMModeAgent] Executing: ${tool}(${JSON.stringify(params)})`);

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
          
          default:
            return { success: false, error: `Unknown tool: ${tool}` };
        }
      }
    );

    const result = rateLimitResult.result || {
      success: false,
      error: rateLimitResult.error || 'Rate limit exceeded',
    };

    console.log(`[LLMModeAgent] Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.error) {
      console.log(`[LLMModeAgent] Error: ${result.error.substring(0, 200)}`);
    }

    return result;
  }

  /**
   * Attempt to recover from build errors
   */
  private async attemptErrorRecovery(session: LLMSession, buildError: ToolResult): Promise<boolean> {
    console.log('[LLMModeAgent] Attempting error recovery...');

    // Add reflection prompt
    session.messages.push({
      role: 'user',
      content: createReflectionPrompt(buildError.error || 'Unknown build error'),
    });

    // Give LLM 3 attempts to fix
    for (let i = 0; i < 3; i++) {
      console.log(`[LLMModeAgent] Recovery attempt ${i + 1}/3`);
      
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
        console.log('[LLMModeAgent] Recovery successful!');
        return true;
      }
    }

    console.log('[LLMModeAgent] Recovery failed after 3 attempts');
    return false;
  }

  /**
   * Rollback all changes
   */
  private async rollback(session: LLMSession): Promise<void> {
    console.log(`[LLMModeAgent] Rolling back ${session.backups.length} backups...`);
    
    for (const backupPath of [...session.backups].reverse()) {
      await rateLimiter.execute('fileWrite', async () => {
        return restoreBackupTool.execute({ backupPath });
      });
    }
    
    console.log('[LLMModeAgent] Rollback complete');
  }

  getSession(id: string): LLMSession | undefined {
    return this.sessions.get(id);
  }

  getAllSessions(): LLMSession[] {
    return Array.from(this.sessions.values());
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
