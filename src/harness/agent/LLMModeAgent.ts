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
  gitStatusTool,
} from '../tools/index.js';
import type { ToolResult } from '../tools/types.js';
import {
  saveRunState,
  readRunState,
  formatResumeContext,
  clearRunState,
  captureWorkspaceFingerprint,
  validateWorkspaceFingerprint,
  SemanticBoundary,
  type RunState,
} from '../RunStateStore.js';

const AVAILABLE_TOOL_NAMES = [
  'readFile',
  'applyEdit',
  'writeFile',
  'runBuild',
  'runTests',
  'executeSkill',
  'createBackup',
  'restoreBackup',
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
  'gitStatus',
  'complete',
] as const;

function unknownToolMessage(tool: string): string {
  const shellHint = ['execute', 'bash', 'shell', 'runCommand', 'terminal'].includes(tool)
    ? ' There is no generic shell/execute tool; use gitStatus for repo state, readFile/listDir/search/searchCode for inspection, and runBuild/typeCheck/runTests/runFocusedTests/runLint/npm for verification.'
    : '';
  return `Unknown tool: ${tool}.${shellHint} Available tools: ${AVAILABLE_TOOL_NAMES.join(', ')}`;
}

export interface LLMTask {
  id: string;
  title: string;
  description: string;
  fileHint?: string;
  /** Deterministic working set for bounded runs - agent should read these first */
  workingSet?: string[];
  /** Ordered first-pass files for bounded localization */
  primaryFiles?: string[];
  /** Optional secondary files the runtime has already budgeted for bounded expansion */
  secondaryFiles?: string[];
  /** Secondary candidates intentionally left outside the active working set until bounded expansion is allowed */
  deferredSecondaryFiles?: string[];
  /** Number of files the bounded packet allows beyond the seeded lists before broader exploration */
  expansionBudget?: number;
  /** Whether bounded expansion is still available or already exhausted */
  expansionStatus?: 'allowed' | 'exhausted';
  /** Runtime-core confidence in the current bounded localization packet */
  localizationConfidence?: 'high' | 'medium' | 'low';
  /** Preferred first verification actions for this bounded packet */
  verificationTargets?: Array<{
    tool: 'runBuild' | 'runTests' | 'typeCheck';
    reason: string;
    pattern?: string;
    priority: number;
  }>;
  /** Domain tag for the bounded run (e.g. 'runtime-core', 'runstate') */
  domain?: string;
  maxSteps?: number;
  approved: boolean;
  /** Deterministic completion policy for bounded runs */
  completionPolicy?: 'manual' | 'stop_after_verification';
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
  status: Status.PENDING | Status.RUNNING | Status.SUSPENDED | Status.SUCCESS | Status.FAILED | Status.ROLLED_BACK;
  startTime: string;
  endTime?: string;
  stepCount: number;
  backups: string[];
  /** Count of successful inspection-style tool calls completed in this run */
  successfulInspectionCalls: number;
  /** File extensions of files modified in this session, used for language-aware verification */
  modifiedExtensions: Set<string>;
  /** Files that were read during this session, for resume context */
  exploredPaths: Set<string>;
  /** Files that were mutated (applyEdit/writeFile) during this session */
  mutatedFiles: Set<string>;
  /** Last verification result (build/test) for resume context */
  lastVerification?: import('../RunStateStore.js').VerificationState;
  /** Deterministic exit reason for bounded runs (e.g. 'bounded-inspection', 'bounded-no-change') */
  exitReason?: string;
  /** Most recent planning-stage failure reason for operator diagnostics */
  lastPlanError?: string;
  /** Current bounded focus file from the task packet's primary files */
  activeFocusFile?: string;
  /** Index of the active focus inside task.primaryFiles */
  activeFocusIndex: number;
  /** Remaining inspection reads before the focus must advance or commit */
  focusInspectionBudgetRemaining: number;
  /** Current bounded-focus status */
  focusStatus: 'unresolved' | 'committed' | 'rejected';
  /** Whether the one-off adjacent file allowance has been consumed */
  focusAdjacentFileUsed: boolean;
  /** Last explicit focus decision */
  focusDecision?: 'reject' | 'resolve';
  /** When the last explicit focus decision was made */
  focusDecisionAt?: string;
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
  private static readonly PREFLIGHT_EXCERPT_LIMIT = 8000;
  private llmClient: LLMClient;
  private sessions: Map<string, LLMSession> = new Map();
  private currentSession?: LLMSession;
  private analyses: import('../ThinkingAnalyzer.js').ThinkingAnalysis[] = [];
  private compactor: ContextCompactor;
  private modifiedExtensions = new Set<string>();

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.compactor = new ContextCompactor({
      maxMessages: 40,
      recentThreshold: 14,
      llmClient,
    });
  }

  private stampSession(
    session: LLMSession,
    patch: Partial<Pick<LLMSession, 'status' | 'endTime' | 'exitReason'>>,
  ): LLMSession {
    const nextSession = { ...session, ...patch };
    this.sessions.set(nextSession.task.id, nextSession);
    this.currentSession = nextSession;
    return nextSession;
  }

  /**
   * Execute a task using LLM-driven planning
   */
  async executeTask(task: LLMTask): Promise<LLMSession> {
    if (task.approved !== true) {
      throw new Error(`Task "${task.id}" must be explicitly approved before execution.`);
    }

    const maxSteps = task.maxSteps || 15;
    
    let session: LLMSession = {
      task,
      messages: [],
      status: Status.RUNNING,
      startTime: new Date().toISOString(),
      stepCount: 0,
      backups: [],
      successfulInspectionCalls: 0,
      modifiedExtensions: new Set(),
      exploredPaths: new Set(),
      mutatedFiles: new Set(),
      activeFocusIndex: 0,
      focusInspectionBudgetRemaining: 0,
      focusStatus: 'rejected',
      focusAdjacentFileUsed: false,
      focusDecision: undefined,
      focusDecisionAt: undefined,
    };

    this.sessions.set(task.id, session);
    this.currentSession = session;
    this.initializeFocusState(session);

    // Resume detection: check for a suspended run
    const existingRunState = await readRunState();
    const isResume = existingRunState !== null && existingRunState.taskId === task.id;

    if (isResume) {
      // ── Workspace identity guard ─────────────────────────────────
      // If the suspended run captured a fingerprint, validate that the
      // workspace (same machine, same worktree) has not drifted.
      if (existingRunState.workspaceFingerprint) {
        const validation = await validateWorkspaceFingerprint(existingRunState.workspaceFingerprint);
        if (!validation.valid) {
          Logger.error('LLMModeAgent', `Resume blocked - workspace identity drifted: ${validation.reason}`);
          await clearRunState();
          session = this.stampSession(session, {
            status: Status.FAILED,
            endTime: new Date().toISOString(),
          });
          return session;
        }
      }

      this.restoreSessionFromRunState(session, existingRunState);

      Logger.debug('LLMModeAgent', `Resuming suspended run: ${existingRunState.stepsCompleted}/${existingRunState.maxSteps} steps completed`);
      Logger.debug('LLMModeAgent', `Restored ${session.exploredPaths.size} explored paths, ${session.mutatedFiles.size} mutated files`);
    }

    Logger.debug('LLMModeAgent', `Starting autonomous task: ${task.title}`);
    Logger.debug('LLMModeAgent', `Budget: ${maxSteps} LLM calls`);

    // Emit start event for TUI/SSE streaming
    eventBus.emit(EventTypes.PROCESS_START, 'LLMModeAgent', {
      process: 'agent-task',
      stage: 'planning',
      metadata: { taskId: task.id, title: task.title, maxSteps, isResume },
    });

    // Initialize conversation with system prompt
    session.messages.push({
      role: 'system',
      content: getSelfImprovePrompt(),
    });

    // Build task prompt with optional resume context
    const resumeSection = isResume && existingRunState
      ? '\n' + formatResumeContext(existingRunState)
      : '';

    const initialPreflightFiles = this.getInitialPreflightFiles(session);

    // Build deterministic preflight section from the bounded packet
    const descriptionHasDeterministicPacket = task.description.includes('## Deterministic Task Packet');
    const preflightSection = !descriptionHasDeterministicPacket && task.workingSet && task.workingSet.length > 0
      ? `\n\n## Deterministic Task Packet\nStart in these primary files before any broader reconnaissance:\n${(task.primaryFiles && task.primaryFiles.length > 0 ? task.primaryFiles : task.workingSet).map((f, i) => `${i === 0 ? '→' : '-'} ${f}`).join('\n')}${task.secondaryFiles && task.secondaryFiles.length > 0 ? `\nSecondary files (use only if the primary files are insufficient):\n${task.secondaryFiles.map(f => `- ${f}`).join('\n')}` : ''}\nHint: Start by looking in ${task.fileHint || task.workingSet[0]}`
      : (task.fileHint ? `\nHint: Start by looking in ${task.fileHint}` : '');

    // Add task description
    const taskPrompt = `## Current Task

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}${preflightSection}${resumeSection}

You are in LLM-driven mode. Plan your own steps. ${isResume ? 'Continue from where the previous run left off.' : 'Start by reading the relevant file(s).'}
If readFile returns truncated=true with startLine/endLine, continue that file with offset=endLine rather than rereading from the top.
If you need a specific method, symbol, or error location inside a large file, use search with the current file path before reading more pages.
${this.formatVerificationTargetPrompt(task)}

Respond with a JSON object containing your tool call:
{\n  "thought": "What you're doing and why",\n  "tool": "toolName",\n  "params": { ... },\n  "expectedResult": "What you expect"\n}

When the task is complete and build passes, respond with tool "complete".`;

    session.messages.push({
      role: 'user',
      content: taskPrompt,
    });

    // ── Deterministic preflight read for bounded runs ──────────────
    // For bounded runs with a packet, read the primary files NOW before
    // the LLM planning loop begins. This injects file contents into
    // session context deterministically, reducing early blind reads.
    if (initialPreflightFiles.length > 0) {
      const unreadFiles = initialPreflightFiles.filter(f => !session.exploredPaths.has(f));
      if (unreadFiles.length > 0) {
        Logger.debug('LLMModeAgent', `Preflight: reading ${unreadFiles.length} primary packet files`);
        const preflightContents: string[] = [];
        for (const filePath of unreadFiles) {
          try {
            const fileResult = await readFileTool.execute({ path: filePath });
            if (fileResult.success && fileResult.data) {
              session.exploredPaths.add(filePath);
              const content = typeof fileResult.data === 'object' && fileResult.data.content
                ? fileResult.data.content
                : typeof fileResult.data === 'string'
                  ? fileResult.data
                  : JSON.stringify(fileResult.data);
              preflightContents.push(`=== ${filePath} ===\n${this.formatPreflightExcerpt(content)}`);
            } else {
              Logger.warn('LLMModeAgent', `Preflight read failed for ${filePath}: ${fileResult.error || 'unknown error'}`);
            }
          } catch (err) {
            Logger.warn('LLMModeAgent', `Preflight read error for ${filePath}: ${err}`);
          }
        }
        if (preflightContents.length > 0) {
          session.messages.push({
            role: 'tool',
            content: `Preflight file contents loaded:\n\n${preflightContents.join('\n\n')}`,
          });
          Logger.debug('LLMModeAgent', `Preflight complete: ${preflightContents.length} files loaded into session context`);
          // Count the preflighted active focus as one inspection read, but still
          // leave room for one explicit follow-up read before the gate forces
          // edit / verify / advance behavior.
          if (session.activeFocusFile && session.exploredPaths.has(session.activeFocusFile) && session.focusInspectionBudgetRemaining > 0) {
            session.focusInspectionBudgetRemaining -= 1;
            Logger.debug('LLMModeAgent', `Preflight consumed one focus read for ${session.activeFocusFile}; remaining=${session.focusInspectionBudgetRemaining}`);
          }
        }
      }
    }

    try {
      let parseFailure = false;
      while (session.stepCount < maxSteps) {
        session.stepCount++;
        Logger.debug('LLMModeAgent', `Step ${session.stepCount}/${maxSteps}`);

        // ── Bounded-inspection guardrail ─────────────────────────────
        // For bounded runs (tui-self-* or stop_after_verification), if
        // more than half the step budget is spent with no mutations,
        // terminate deterministically instead of open-ended reconnaissance.
        if (this.shouldStopForBoundedInspection(session, maxSteps)) {
          Logger.info('LLMModeAgent', `Bounded-inspection guardrail triggered at step ${session.stepCount}/${maxSteps} - no mutations after 50% budget`);
          await clearRunState();
          session = this.stampSession(session, {
            status: Status.SUCCESS,
            exitReason: 'bounded-inspection',
            endTime: new Date().toISOString(),
          });
          eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
            process: 'agent-task',
            success: true,
            reason: 'bounded-inspection: no mutation warranted within budget',
            iterations: session.stepCount,
            durationMs: Date.now() - new Date(session.startTime).getTime(),
          });
          return session;
        }

        // Emit progress event for TUI
        eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
          process: 'agent-task',
          current: session.stepCount,
          total: maxSteps,
          stage: `planning step ${session.stepCount}`,
          message: `asking ${this.llmClient.getConfig().model || 'model'} for next tool call`,
        });

        // Get LLM's plan
        const toolCall = await this.getLLMPlan(session);
        
        if (!toolCall) {
          Logger.error('LLMModeAgent', session.lastPlanError || 'Failed to parse LLM response');
          parseFailure = true;
          break;
        }

        // Record assistant's plan
        session.messages.push({
          role: 'assistant',
          content: JSON.stringify(toolCall),
          toolCall,
        });

        eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
          process: 'agent-task',
          current: session.stepCount,
          total: maxSteps,
          stage: `planned ${toolCall.tool}`,
          message: `${toolCall.tool}: ${toolCall.thought}`,
        });

        // Check for completion
        if (toolCall.tool === 'complete') {
          const completionGateError = this.getCompletionGateError(session);
          if (completionGateError) {
            const gateResult: ToolResult = { success: false, error: completionGateError };
            session.messages.push({
              role: 'tool',
              content: JSON.stringify(gateResult),
              toolResult: gateResult,
            });
            eventBus.emit(EventTypes.PROCESS_PROGRESS, 'LLMModeAgent', {
              process: 'agent-task',
              current: session.stepCount,
              total: maxSteps,
              stage: 'executed complete',
              message: `complete failed: ${completionGateError.slice(0, 100)}`,
            });
            continue;
          }
          Logger.debug('LLMModeAgent', 'Task completed by LLM');
          await clearRunState();
          session = this.stampSession(session, {
            status: Status.SUCCESS,
            endTime: new Date().toISOString(),
          });
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
          message: this.formatToolProgressMessage(toolCall.tool, result),
        });
        
        // Record tool result
        session.messages.push({
          role: 'tool',
          content: this.formatToolResultMessage(toolCall.tool, result),
          toolResult: result,
        });

        if (this.shouldStopAfterSuccessfulVerification(session, toolCall, result)) {
          Logger.info('LLMModeAgent', `Auto-completing bounded run after successful ${toolCall.tool}`);
          await clearRunState();
          session = this.stampSession(session, {
            status: Status.SUCCESS,
            endTime: new Date().toISOString(),
          });
          eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
            process: 'agent-task',
            success: true,
            reason: `Verified success reached via ${toolCall.tool}` ,
            iterations: session.stepCount,
            durationMs: Date.now() - new Date(session.startTime).getTime(),
          });
          return session;
        }

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
              session = this.stampSession(session, { status: Status.ROLLED_BACK });
            } else {
              session = this.stampSession(session, { status: Status.FAILED });
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

      // Loop ended without explicit completion via 'complete' tool.
      // Only bounded runs that actually completed meaningful successful
      // inspection work should classify as bounded-no-change successes.
      if (!parseFailure && this.shouldClassifyAsBoundedNoChangeSuccess(session)) {
        Logger.debug('LLMModeAgent', `Treating TUI inspection-only run as no-change success after ${session.stepCount} steps`);
        await clearRunState();
        session = this.stampSession(session, {
          status: Status.SUCCESS,
          exitReason: 'bounded-no-change',
          endTime: new Date().toISOString(),
        });

        eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
          process: 'agent-task',
          success: true,
          reason: 'bounded-no-change: inspection complete, no mutations needed',
          iterations: session.stepCount,
          durationMs: Date.now() - new Date(session.startTime).getTime(),
        });

        return session;
      }

      // Distinguish between parse failure (FAILED) and natural completion.
      if (parseFailure) {

        // LLM response couldn't be parsed - this is a real failure
        Logger.error('LLMModeAgent', session.lastPlanError ? `${session.lastPlanError} after ${session.stepCount} steps` : `Failed to parse LLM response after ${session.stepCount} steps`);
        session = this.stampSession(session, {
          status: Status.FAILED,
          endTime: new Date().toISOString(),
        });

        eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
          process: 'agent-task',
          success: false,
          reason: session.lastPlanError || 'Failed to parse LLM response',
          iterations: session.stepCount,
          durationMs: Date.now() - new Date(session.startTime).getTime(),
        });

        // Rollback if needed
        if (session.backups.length > 0) {
          await this.rollback(session);
          session = this.stampSession(session, { status: Status.ROLLED_BACK });
        }
      } else if (session.backups.length === 0) {
        if (this.isBoundedInspectionRun(session)) {
          Logger.error('LLMModeAgent', `Bounded run ended before meaningful successful inspection after ${session.stepCount} steps`);
          session = this.stampSession(session, {
            status: Status.FAILED,
            endTime: new Date().toISOString(),
          });

          eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
            process: 'agent-task',
            success: false,
            reason: 'Bounded run ended before meaningful successful inspection',
            iterations: session.stepCount,
            durationMs: Date.now() - new Date(session.startTime).getTime(),
          });

          return session;
        }

        // Natural loop completion with no mutations - inspection-only success
        Logger.debug('LLMModeAgent', `Inspection complete after ${session.stepCount} steps, no mutations needed`);
        await clearRunState();
        session = this.stampSession(session, {
          status: Status.SUCCESS,
          exitReason: 'bounded-no-change',
          endTime: new Date().toISOString(),
        });

        eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
          process: 'agent-task',
          success: true,
          reason: 'bounded-no-change: inspection complete, no mutations needed',
          iterations: session.stepCount,
          durationMs: Date.now() - new Date(session.startTime).getTime(),
        });
      } else {
        // Mutations were made but task didn't complete - checkpoint and suspend for resume
        Logger.warn('LLMModeAgent', `Max steps (${maxSteps}) reached with incomplete changes - suspending for resume`);

        // Capture workspace fingerprint for safe resume validation
        let workspaceFingerprint;
        try {
          workspaceFingerprint = await captureWorkspaceFingerprint();
        } catch (fpErr) {
          Logger.warn('LLMModeAgent', `Could not capture workspace fingerprint: ${fpErr}`);
        }

        try {
          await saveRunState(this.buildSuspendedRunState(session, maxSteps, workspaceFingerprint));
          Logger.info('LLMModeAgent', 'Run state saved for potential resume');
        } catch (saveErr) {
          Logger.error('LLMModeAgent', `Failed to save run state: ${saveErr}`);
        }

        session = this.stampSession(session, {
          status: Status.SUSPENDED,
          endTime: new Date().toISOString(),
        });

        eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
          process: 'agent-task',
          success: false,
          reason: `Suspended after ${session.stepCount} steps - run can be resumed`,
          iterations: session.stepCount,
          durationMs: Date.now() - new Date(session.startTime).getTime(),
        });
      }

      return session;

    } catch (error) {
      Logger.error('LLMModeAgent', `Unexpected error: ${error}`);
      session = this.stampSession(session, {
        status: Status.FAILED,
        endTime: new Date().toISOString(),
      });

      eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
        process: 'agent-task',
        success: false,
        reason: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        iterations: session.stepCount,
      });

      if (session.backups.length > 0) {
        await this.rollback(session);
        session = this.stampSession(session, { status: Status.ROLLED_BACK });
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
    const rateLimitResult = await rateLimiter.execute(this.llmRateLimitOperation(session), async () => {
      const systemPrompt = session.messages.find(m => m.role === 'system')?.content || getSelfImprovePrompt();
      // Build conversation context
      let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = session.messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.role === 'user' ? m.content :
                   m.role === 'assistant' ? JSON.stringify(m.toolCall) :
                   (m.toolResult ? JSON.stringify(m.toolResult) : m.content),
        }));

      // Compact if conversation is getting long
      if (this.compactor.needsCompaction(messages)) {
        messages = await this.compactor.compact(messages);
        Logger.debug('LLMModeAgent', `Compacted conversation from ${session.messages.length} to ${messages.length} messages`);
      }

      const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n');

      // Call LLM
      const response = await this.llmClient.complete({
        systemPrompt,
        prompt: conversation + '\n\nWhat is your next tool call? Respond with JSON only.',
        maxTokens: 2000,
        temperature: 0.2, // Low temperature for deterministic tool calls
      });

      if (response.success === false) {
        throw new Error(response.error || 'LLM call failed before producing a response');
      }

      return response.text;
    });

    if (!rateLimitResult.result) {
      const failureReason = rateLimitResult.rateLimited
        ? (rateLimitResult.error || 'Rate limit hit for LLM call')
        : (rateLimitResult.error || 'LLM call failed before producing a response');
      if (this.currentSession) {
        this.currentSession.lastPlanError = failureReason;
      }
      Logger.error('LLMModeAgent', failureReason);

      const retryable = /rate limit|429|529|overload|timeout|502|503|504|upstream|temporar/i.test(failureReason);
      if (retryable) {
        Logger.warn('LLMModeAgent', `Retrying transient planning failure once: ${failureReason}`);
        await new Promise(resolve => setTimeout(resolve, 750));
        const retryResult = await rateLimiter.execute(this.llmRateLimitOperation(session), async () => {
          const systemPrompt = session.messages.find(m => m.role === 'system')?.content || getSelfImprovePrompt();
          let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = session.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role as 'system' | 'user' | 'assistant',
              content: m.role === 'user' ? m.content :
                       m.role === 'assistant' ? JSON.stringify(m.toolCall) :
                       (m.toolResult ? JSON.stringify(m.toolResult) : m.content),
            }));
          if (this.compactor.needsCompaction(messages)) {
            messages = await this.compactor.compact(messages);
          }
          const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n\n---\n\n');
          const response = await this.llmClient.complete({
            systemPrompt,
            prompt: conversation + '\n\nWhat is your next tool call? Respond with JSON only.',
            maxTokens: 2000,
            temperature: 0.2,
          });
          if (response.success === false) {
            throw new Error(response.error || 'LLM call failed before producing a response');
          }
          return response.text;
        });
        if (retryResult.result) {
          if (this.currentSession) this.currentSession.lastPlanError = undefined;
          rateLimitResult.result = retryResult.result;
        } else {
          const retryReason = retryResult.error || failureReason;
          if (this.currentSession) this.currentSession.lastPlanError = retryReason;
          return null;
        }
      } else {
        return null;
      }
    }

    if (this.currentSession) {
      this.currentSession.lastPlanError = undefined;
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

      const jsonText = this.extractFirstJsonObject(jsonStr);
      if (!jsonText) {
        const implicitComplete = this.tryImplicitCompletion(session, text);
        if (implicitComplete) {
          Logger.debug('LLMModeAgent', 'Using implicit completion fallback for late-stage plain-text response');
          return implicitComplete;
        }
        if (this.currentSession) {
          this.currentSession.lastPlanError = 'Failed to parse LLM response';
        }
        Logger.error('LLMModeAgent', 'No JSON object found in response');
        return null;
      }
      const parsed = JSON.parse(jsonText);
      
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
      if (this.currentSession) {
        this.currentSession.lastPlanError = `Failed to parse LLM response: ${String(e)}`;
      }
      Logger.error('LLMModeAgent', `Failed to parse LLM response: ${e}`);
      Logger.error('LLMModeAgent', `Raw response: ${rateLimitResult.result}`);
      return null;
    }
  }

  private llmRateLimitOperation(session: LLMSession): string {
    return session.task.id.startsWith('tui-self-')
      ? `tuiLlmCall:${session.task.id}`
      : 'llmCall';
  }

  private extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  private tryImplicitCompletion(session: LLMSession, text: string): ToolCall | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const hasMutation = session.backups.length > 0;
    const completionLike = /(?:task\s+complete|inspection\s+is\s+complete|diagnostic\s+(?:is\s+)?complete|returning\s+(?:the\s+)?final\s+(?:diagnostic\s+)?report|final\s+report|fix\s+is\s+complete|providing\s+final\s+report|all\s+\d*\s*tests?\s+pass|tests?\s+pass(?:ed)?|done\b)/i.test(trimmed);
    if (!completionLike) return null;

    if (!hasMutation) {
      const readOnlyDiagnostic = /(?:read-only|do not modify|do not edit|no file changes|without modifying files)/i.test(session.task.description);
      if (!readOnlyDiagnostic || !this.hasConcreteSuccessfulInspection(session)) return null;
      return {
        thought: trimmed.slice(0, 400),
        tool: 'complete',
        params: {},
        expectedResult: 'Finish the read-only inspection task',
      };
    }

    const buildPassed = this.hasSuccessfulTool(session, 'runBuild');
    if (!buildPassed) return null;

    const testsPassed = this.hasSuccessfulTool(session, 'runTests');

    if (!testsPassed && !/tests?\s+pass(?:ed)?/i.test(trimmed)) return null;

    return {
      thought: trimmed.slice(0, 400),
      tool: 'complete',
      params: {},
      expectedResult: 'Finish the verified task',
    };
  }

  private hasSuccessfulTool(session: LLMSession, toolName: string): boolean {
    for (let i = 0; i < session.messages.length - 1; i++) {
      const message = session.messages[i];
      const next = session.messages[i + 1];
      if (message.toolCall?.tool === toolName && next.toolResult?.success) {
        return true;
      }
    }
    return false;
  }

  private formatPreflightExcerpt(content: string): string {
    if (content.length <= LLMModeAgent.PREFLIGHT_EXCERPT_LIMIT) return content;
    return `${content.slice(0, LLMModeAgent.PREFLIGHT_EXCERPT_LIMIT)}\n... [truncated preflight excerpt; call readFile for full contents]`;
  }

  private formatToolResultMessage(tool: string, result: ToolResult): string {
    const base = JSON.stringify(result);
    if (!this.currentSession) return base;
    if (!result.success) {
      const focusGateRecoveryHint = this.formatFocusGateRecoveryHint(tool, result, this.currentSession);
      const message = focusGateRecoveryHint ? `${base}\n\n${focusGateRecoveryHint}` : base;
      return this.appendFocusStatusHint(message, this.currentSession);
    }
    if (tool !== 'readFile') return this.appendFocusStatusHint(base, this.currentSession);

    const data = result.data as { truncated?: boolean; endLine?: number } | undefined;
    if (!data?.truncated || typeof data.endLine !== 'number') return this.appendFocusStatusHint(base, this.currentSession);

    return this.appendFocusStatusHint(
      `${base}\n\nPagination hint: this readFile result is truncated. Continue the same file with offset=${data.endLine} instead of rereading from the top. If you only need a specific method, symbol, or error location inside this file, use search with path set to the current file before reading more pages.`,
      this.currentSession,
    );
  }

  private formatFocusGateRecoveryHint(tool: string, result: ToolResult, session: LLMSession): string | null {
    if (!result.error?.startsWith('Focus gate:') || !this.isFocusGateActive(session) || !session.activeFocusFile) {
      return null;
    }

    const nextPrimary = this.nextPrimaryFile(session);
    if (tool === 'readFile' && nextPrimary) {
      if (session.focusInspectionBudgetRemaining > 0) {
        return `Focus recovery hint: stay on ${session.activeFocusFile} for ${session.focusInspectionBudgetRemaining} more explicit read${session.focusInspectionBudgetRemaining === 1 ? '' : 's'} before advancing. If you decide this focus is wrong after that, call readFile with path=${nextPrimary} to advance intentionally.`;
      }
      return `Focus recovery hint: if you reject ${session.activeFocusFile}, call readFile with path=${nextPrimary} to advance to the next primary file.`;
    }

    if (tool === 'search') {
      return `Focus recovery hint: keep search pinned to path=${session.activeFocusFile}. If you need another primary file, advance there first with readFile.`;
    }

    return null;
  }

  private formatToolProgressMessage(tool: string, result: ToolResult): string {
    if (result.success) return `${tool} succeeded`;
    const full = this.currentSession ? this.formatToolResultMessage(tool, result) : JSON.stringify(result);
    const compact = full.replace(/\s+/g, ' ').trim();
    return `${tool} failed: ${compact.slice(0, 220)}`;
  }

  private getInitialPreflightFiles(session: LLMSession): string[] {
    if (session.activeFocusFile) return [session.activeFocusFile];
    if (session.task.primaryFiles && session.task.primaryFiles.length > 0) return [session.task.primaryFiles[0]];
    return session.task.workingSet ? [session.task.workingSet[0]] : [];
  }

  private initializeFocusState(session: LLMSession): void {
    if (!this.isBoundedInspectionRun(session) || !session.task.primaryFiles?.length) return;
    session.activeFocusIndex = 0;
    session.activeFocusFile = session.task.primaryFiles[0];
    session.focusInspectionBudgetRemaining = 2;
    session.focusStatus = 'unresolved';
    session.focusAdjacentFileUsed = false;
    session.focusDecision = undefined;
    session.focusDecisionAt = undefined;
  }

  private appendFocusStatusHint(content: string, session: LLMSession): string {
    if (!this.isFocusGateActive(session) || !session.activeFocusFile) return content;
    const nextPrimary = this.nextPrimaryFile(session);
    const verificationHint = this.formatPreferredVerificationHint(session.task);
    return `${content}\n\nFocus gate: active focus=${session.activeFocusFile}; remaining focus reads=${session.focusInspectionBudgetRemaining}; focus status=${session.focusStatus}.${nextPrimary ? ` If you reject this focus, move to next primary file: ${nextPrimary}.` : ' No additional primary files remain after this focus.'}${verificationHint ? ` ${verificationHint}` : ''}`;
  }

  private isFocusGateActive(session: LLMSession): boolean {
    return this.isBoundedInspectionRun(session) && !!session.task.primaryFiles?.length;
  }

  private normalizeToolCallForFocusGate(toolCall: ToolCall): ToolCall {
    const session = this.currentSession;
    if (!session || !this.isFocusGateActive(session) || session.focusStatus !== 'unresolved') {
      return toolCall;
    }

    if (toolCall.tool === 'readFile' && session.activeFocusFile) {
      const requestedPath = typeof toolCall.params?.path === 'string' ? toolCall.params.path : undefined;
      const nextPrimary = this.nextPrimaryFile(session);
      const canAdvanceToNextPrimary = !!requestedPath && !!nextPrimary && requestedPath === nextPrimary && session.focusInspectionBudgetRemaining <= 0;
      const isAllowedSecondary = !!requestedPath && !!session.task.secondaryFiles?.includes(requestedPath) && !session.focusAdjacentFileUsed;
      if (!requestedPath || (!canAdvanceToNextPrimary && !isAllowedSecondary && requestedPath !== session.activeFocusFile)) {
        return {
          ...toolCall,
          params: {
            ...(toolCall.params || {}),
            path: session.activeFocusFile,
          },
        };
      }
    }

    if (toolCall.tool === 'search' && session.activeFocusFile) {
      return {
        ...toolCall,
        params: {
          ...(toolCall.params || {}),
          path: session.activeFocusFile,
        },
      };
    }

    return toolCall;
  }

  private nextPrimaryFile(session: LLMSession): string | undefined {
    const primaryFiles = session.task.primaryFiles || [];
    return primaryFiles[session.activeFocusIndex + 1];
  }

  private advanceFocus(session: LLMSession, filePath: string): void {
    const primaryFiles = session.task.primaryFiles || [];
    const nextIndex = primaryFiles.indexOf(filePath);
    if (nextIndex === -1) return;
    session.activeFocusIndex = nextIndex;
    session.activeFocusFile = filePath;
    session.focusInspectionBudgetRemaining = 1;
    session.focusStatus = 'unresolved';
    session.focusAdjacentFileUsed = false;
    session.focusDecision = 'reject';
    session.focusDecisionAt = new Date().toISOString();
  }

  private validateFocusGate(toolCall: ToolCall): string | null {
    const session = this.currentSession;
    if (!session || !this.isFocusGateActive(session) || session.focusStatus !== 'unresolved') return null;

    const tool = toolCall.tool;
    if (tool === 'applyEdit' || tool === 'writeFile' || tool === 'runBuild' || tool === 'runTests' || tool === 'typeCheck' || tool === 'complete') {
      return null;
    }

    const requestedPath = typeof toolCall.params?.path === 'string' ? toolCall.params.path : undefined;
    const nextPrimary = this.nextPrimaryFile(session);

    if (tool === 'readFile') {
      if (requestedPath === session.activeFocusFile) {
        if (session.focusInspectionBudgetRemaining > 0) return null;
        return `Focus gate: inspection budget exhausted for ${session.activeFocusFile}. Apply an edit, run verification, or move to the next primary file${nextPrimary ? `: ${nextPrimary}` : ''}.`;
      }
      if (requestedPath && nextPrimary && requestedPath === nextPrimary && session.focusInspectionBudgetRemaining <= 0) {
        this.advanceFocus(session, requestedPath);
        return null;
      }
      if (requestedPath && session.task.secondaryFiles?.includes(requestedPath) && !session.focusAdjacentFileUsed) {
        session.focusAdjacentFileUsed = true;
        return null;
      }
      return `Focus gate: stay on ${session.activeFocusFile} until you edit, verify, or explicitly advance to the next primary file${nextPrimary ? ` (${nextPrimary})` : ''}.`;
    }

    if (tool === 'search') {
      if (requestedPath === session.activeFocusFile) return null;
      if (requestedPath && session.task.secondaryFiles?.includes(requestedPath) && !session.focusAdjacentFileUsed) {
        session.focusAdjacentFileUsed = true;
        return null;
      }
      return `Focus gate: search must stay inside the active focus file ${session.activeFocusFile}${nextPrimary ? ` or advance to ${nextPrimary} after exhausting focus reads` : ''}.`;
    }

    if (tool === 'listDir') {
      return `Focus gate: broad repo exploration is blocked while focus remains unresolved on ${session.activeFocusFile}.`;
    }

    return null;
  }

  private updateFocusStateAfterTool(toolCall: ToolCall, result: ToolResult): void {
    const session = this.currentSession;
    if (!session || !this.isFocusGateActive(session)) return;

    if (!result.success) return;

    if (toolCall.tool === 'readFile' && typeof toolCall.params?.path === 'string' && toolCall.params.path === session.activeFocusFile && session.focusInspectionBudgetRemaining > 0) {
      session.focusInspectionBudgetRemaining -= 1;
      return;
    }

    if (toolCall.tool === 'applyEdit' || toolCall.tool === 'writeFile' || toolCall.tool === 'runBuild' || toolCall.tool === 'runTests' || toolCall.tool === 'typeCheck' || toolCall.tool === 'complete') {
      session.focusStatus = 'committed';
      session.focusDecision = 'resolve';
      session.focusDecisionAt = new Date().toISOString();
    }
  }

  private formatVerificationTargetPrompt(task: LLMTask): string {
    if (!task.verificationTargets?.length) return '';
    const preferred = task.verificationTargets
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((target) => `${target.tool}${target.pattern ? ` (${target.pattern})` : ''}: ${target.reason}`)
      .join('\n- ');
    return `\nPreferred verification targets after a mutation:\n- ${preferred}\nPrefer the first applicable verification target before broader verification discovery.`;
  }

  private formatPreferredVerificationHint(task: LLMTask): string {
    if (!task.verificationTargets?.length) return '';
    const target = task.verificationTargets.slice().sort((a, b) => a.priority - b.priority)[0];
    return `Preferred next verification: ${target.tool}${target.pattern ? ` (${target.pattern})` : ''}.`;
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    toolCall = this.normalizeToolCallForFocusGate(toolCall);
    const { tool, params, thought } = toolCall;

    Logger.debug('LLMModeAgent', `${thought}`);
    Logger.debug('LLMModeAgent', `Executing: ${tool}(${JSON.stringify(params)})`);

    telemetryWrapper.setContext({
      taskId: this.currentSession?.task.id,
      iteration: this.currentSession?.stepCount,
    });

    const focusGateError = this.validateFocusGate(toolCall);
    if (focusGateError) {
      Logger.warn('LLMModeAgent', focusGateError);
      return { success: false, error: focusGateError };
    }

    const rateLimitResult = await rateLimiter.execute(
      tool === 'readFile' || tool === 'executeSkill' || tool === 'searchCode' || tool === 'searchDocs'
        ? 'fileRead'
        : tool === 'writeFile' || tool === 'applyEdit'
          ? 'fileWrite'
          : tool === 'runBuild'
            ? 'buildRun'
            : 'testRun',
      async () => {
        switch (tool) {
          case 'readFile': {
            // Track explored path for resume context
            if (params.path && typeof params.path === 'string') {
              this.currentSession?.exploredPaths.add(params.path);
            }
            return readFileTool.execute(params);
          }
          
          case 'writeFile': {
            // Track file extension for language-aware verification
            this.trackModifiedExtension(params.path as string);
            // Track mutated file for resume context
            if (params.path && typeof params.path === 'string') {
              this.currentSession?.mutatedFiles.add(params.path);
            }
            return writeFileTool.execute(params);
          }
          
          case 'applyEdit': {
            // Create backup first
            const backupResult = await createBackupTool.execute({ path: params.path });
            if (backupResult.success && backupResult.data?.backupPath) {
              this.currentSession?.backups.push(backupResult.data.backupPath as string);
            }
            // Track file extension for language-aware verification
            this.trackModifiedExtension(params.path as string);
            // Track mutated file for resume context
            if (params.path && typeof params.path === 'string') {
              this.currentSession?.mutatedFiles.add(params.path);
            }
            return applyEditTool.execute(params);
          }
          
          case 'runBuild': {
            // Language-aware verification: skip build if only non-code files were modified
            if (!this.needsCodeVerification()) {
              Logger.info('LLMModeAgent', 'Skipping runBuild - only non-code files modified (.md, .json, .css, .html, .yaml)');
              return {
                success: true,
                data: { skipped: true, reason: 'Only non-code files modified' },
                duration: 0
              };
            }
            const buildResult = await runBuildTool.execute(params);
            this.recordVerificationResult('build', buildResult);
            return buildResult;
          }
          
          case 'runTests': {
            const testResult = await runTestsTool.execute(params);
            this.recordVerificationResult('test', testResult);
            return testResult;
          }

          case 'executeSkill':
            return executeSkillTool.execute(params);
          
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
          case 'searchCode':
            return searchCodeTool.execute(params);
          case 'searchDocs':
            return searchDocsTool.execute(params);
          case 'listDir':
            return listDirTool.execute(params);
          case 'typeCheck':
            return typeCheckTool.execute(params);
          case 'npm':
            return npmTool.execute(params);
          case 'runLint':
            return runLintTool.execute(params);
          case 'runFocusedTests':
            return runFocusedTestsTool.execute(params);
          case 'lsp':
            return lspTool.execute(params);
          case 'astValidate':
            return astValidatorTool.execute(params);
          case 'importGuard':
            return importGuardTool.execute(params);
          case 'gitStatus':
            return gitStatusTool.execute(params);

          default:
            return { success: false, error: unknownToolMessage(tool) };
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

    this.updateFocusStateAfterTool(toolCall, result);

    return result;
  }

  private isVerificationTool(tool: string): boolean {
    return tool === 'runBuild' || tool === 'runTests' || tool === 'typeCheck';
  }

  private isBoundedInspectionRun(session: LLMSession): boolean {
    return session.task.id.startsWith('tui-self-') ||
      session.task.completionPolicy === 'stop_after_verification';
  }

  private isMeaningfulInspectionTool(tool: string): boolean {
    return tool === 'readFile' ||
      tool === 'listDir' ||
      tool === 'search' ||
      tool === 'gitStatus' ||
      tool === 'lsp' ||
      tool === 'astValidate' ||
      tool === 'importGuard';
  }

  private hasConcreteSuccessfulInspection(session: LLMSession): boolean {
    for (let i = 0; i < session.messages.length - 1; i++) {
      const message = session.messages[i];
      const next = session.messages[i + 1];
      if (!message.toolCall || !next.toolResult?.success) continue;
      if (message.toolCall.tool === 'search') continue;
      if (!this.isMeaningfulInspectionTool(message.toolCall.tool)) continue;
      return true;
    }
    return false;
  }

  private shouldClassifyAsBoundedNoChangeSuccess(session: LLMSession): boolean {
    if (!this.isBoundedInspectionRun(session)) return false;
    if (session.mutatedFiles.size > 0 || session.backups.length > 0) return false;
    return this.hasConcreteSuccessfulInspection(session);
  }

  private shouldStopAfterSuccessfulVerification(session: LLMSession, toolCall: ToolCall, result: ToolResult): boolean {
    const tool = toolCall.tool;
    if (session.task.completionPolicy !== 'stop_after_verification') return false;
    if (!this.isVerificationTool(tool)) return false;
    if (!result.success) return false;
    if ((result.data as { skipped?: boolean } | undefined)?.skipped) return false;
    const required = this.getRequiredVerificationTarget(session.task);
    if (required && !this.matchesVerificationTarget(toolCall, required)) return false;
    return session.backups.length > 0 || session.mutatedFiles.size > 0;
  }

  private getRequiredVerificationTarget(task: LLMTask): NonNullable<LLMTask['verificationTargets']>[number] | undefined {
    return task.verificationTargets?.slice().sort((a, b) => a.priority - b.priority)[0];
  }

  private matchesVerificationTarget(toolCall: Pick<ToolCall, 'tool' | 'params'>, target: NonNullable<LLMTask['verificationTargets']>[number]): boolean {
    if (toolCall.tool !== target.tool) return false;
    if (!target.pattern) return true;
    if (target.tool === 'runTests') {
      const pattern = typeof toolCall.params?.pattern === 'string' ? toolCall.params.pattern : '';
      return pattern.includes(target.pattern);
    }
    return true;
  }

  private hasSatisfiedRequiredVerification(session: LLMSession): boolean {
    const target = this.getRequiredVerificationTarget(session.task);
    if (!target) return true;
    for (let i = 0; i < session.messages.length - 1; i++) {
      const message = session.messages[i];
      const next = session.messages[i + 1];
      if (!message.toolCall || !next.toolResult?.success) continue;
      if (this.matchesVerificationTarget(message.toolCall, target)) return true;
    }
    return false;
  }

  private getVerificationGateError(session: LLMSession): string | null {
    if (session.mutatedFiles.size === 0 && session.backups.length === 0) return null;
    if (this.hasSatisfiedRequiredVerification(session)) return null;
    const target = this.getRequiredVerificationTarget(session.task);
    if (!target) return null;
    return `Verification gate: run ${target.tool}${target.pattern ? ` (${target.pattern})` : ''} before completing this task.`;
  }

  private getCompletionGateError(session: LLMSession): string | null {
    return this.getArtifactGateError(session) || this.getVerificationGateError(session);
  }

  private getRequiredArtifactPath(session: LLMSession): string | null {
    const description = session.task.description;
    const explicitGate = /Do not report success unless\s+([^\s`]+\.md)\s+was created(?:\s+or\s+overwritten)?/i.exec(description);
    if (explicitGate?.[1]) return explicitGate[1].trim();

    const artifactLine = /(?:artifact|Artifact)\s+(?:at|path):?\s*`?([^\s`]+\.md)`?/i.exec(description);
    return artifactLine?.[1]?.trim() || null;
  }

  private getArtifactGateError(session: LLMSession): string | null {
    const artifactPath = this.getRequiredArtifactPath(session);
    if (!artifactPath) return null;
    if (session.mutatedFiles.has(artifactPath)) return null;
    return `Artifact gate: create or overwrite ${artifactPath} with writeFile before completing this task.`;
  }

  /**
   * Bounded-inspection guardrail: for bounded Bubble Tea self-improvement runs,
   * terminate deterministically if no mutation has happened after spending
   * more than 50% of the step budget on reconnaissance.
   */
  private shouldStopForBoundedInspection(session: LLMSession, maxSteps: number): boolean {
    if (!this.isBoundedInspectionRun(session)) return false;

    // Must have spent more than half the budget
    if (session.stepCount <= Math.ceil(maxSteps / 2)) return false;

    // Must have no mutations at all
    if (session.mutatedFiles.size > 0 || session.backups.length > 0) return false;

    // Must have already completed meaningful successful inspection work
    if (!this.hasConcreteSuccessfulInspection(session)) return false;

    return true;
  }

  private restoreSessionFromRunState(session: LLMSession, existingRunState: RunState): void {
    for (const path of existingRunState.exploredPaths) {
      session.exploredPaths.add(path);
    }
    for (const file of existingRunState.mutatedFiles) {
      session.mutatedFiles.add(file);
    }
    if (existingRunState.lastVerification) {
      session.lastVerification = existingRunState.lastVerification;
    }
    if (existingRunState.activeFocusFile) {
      session.activeFocusFile = existingRunState.activeFocusFile;
      session.activeFocusIndex = existingRunState.activeFocusIndex ?? 0;
      session.focusInspectionBudgetRemaining = existingRunState.focusInspectionBudgetRemaining ?? 0;
      session.focusStatus = existingRunState.focusStatus ?? 'unresolved';
      session.focusAdjacentFileUsed = existingRunState.focusAdjacentFileUsed ?? false;
      session.focusDecision = existingRunState.focusDecision;
      session.focusDecisionAt = existingRunState.focusDecisionAt;
    }
    session.stepCount = existingRunState.stepsCompleted;
  }

  private recordVerificationResult(type: 'build' | 'test', result: ToolResult): void {
    if (!this.currentSession) return;
    this.currentSession.lastVerification = {
      passed: result.success,
      type,
      error: result.error,
      timestamp: new Date().toISOString(),
    };
  }

  private deriveSuspensionPhase(session: LLMSession): SemanticBoundary {
    if (session.lastVerification) {
      return session.lastVerification.passed
        ? SemanticBoundary.VERIFICATION_FINISHED
        : SemanticBoundary.VERIFICATION_STARTED;
    }

    return session.mutatedFiles.size > 0
      ? SemanticBoundary.MUTATION_APPLIED
      : SemanticBoundary.INTERRUPTED;
  }

  private buildSuspendedRunState(
    session: LLMSession,
    maxSteps: number,
    workspaceFingerprint?: RunState['workspaceFingerprint'],
  ): RunState {
    const phase = this.deriveSuspensionPhase(session);

    return {
      runId: `run-${session.task.id}-${Date.now()}`,
      taskId: session.task.id,
      taskTitle: session.task.title,
      taskDescription: session.task.description,
      status: Status.SUSPENDED,
      phase,
      stepsCompleted: session.stepCount,
      maxSteps,
      continueUntilDone: false,
      startedAt: session.startTime,
      suspendedAt: new Date().toISOString(),
      exploredPaths: Array.from(session.exploredPaths),
      progressSummary: `Completed ${session.stepCount} steps. ${session.mutatedFiles.size} files mutated. Phase: ${phase}`,
      hadMutations: session.mutatedFiles.size > 0,
      mutationApplied: session.mutatedFiles.size > 0,
      mutatedFiles: Array.from(session.mutatedFiles),
      lastVerification: session.lastVerification,
      activeFocusFile: session.activeFocusFile,
      activeFocusIndex: session.activeFocusIndex,
      focusInspectionBudgetRemaining: session.focusInspectionBudgetRemaining,
      focusStatus: session.focusStatus,
      focusAdjacentFileUsed: session.focusAdjacentFileUsed,
      focusDecision: session.focusDecision,
      focusDecisionAt: session.focusDecisionAt,
      workspaceFingerprint,
    };
  }

  private trackModifiedExtension(filePath: string): void {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (ext) this.modifiedExtensions.add(ext);
  }

  private needsCodeVerification(): boolean {
    if (this.modifiedExtensions.size === 0) return true;
    const nonCodeOnly = ['md', 'txt', 'rst', 'json', 'jsonc', 'css', 'scss', 'less', 'sass', 'html', 'htm', 'svg', 'yaml', 'yml', 'toml'];
    return Array.from(this.modifiedExtensions).some((ext) => !nonCodeOnly.includes(ext));
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
- Status: ${s.status}${s.exitReason ? ` (${s.exitReason})` : ''}
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
