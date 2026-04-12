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
  gitStatusTool,
  localCheckpointTool,
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
  /** Number of files the bounded packet allows beyond the seeded lists before broader exploration */
  expansionBudget?: number;
  /** Runtime-core confidence in the current bounded localization packet */
  localizationConfidence?: 'high' | 'medium' | 'low';
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
  /** Number of successful inspection-style tool calls completed inside the main loop */
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
  private compactor: ContextCompactor;
  private modifiedExtensions = new Set<string>();

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient;
    this.compactor = new ContextCompactor({
      maxMessages: 40,
      recentThreshold: 14,
      llmClient,
      tokenThresholdRatio: 0.65,
    });
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
      successfulInspectionCalls: 0,
      modifiedExtensions: new Set(),
      exploredPaths: new Set(),
      mutatedFiles: new Set(),
    };

    this.sessions.set(task.id, session);
    this.currentSession = session;

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
          session.status = Status.FAILED;
          session.endTime = new Date().toISOString();
          return session;
        }
      }

      // ── Restore persisted run-state into live Sets ────────────────
      // This gives the resumed session access to what was already explored
      // and mutated so the LLM can avoid re-doing work.
      for (const p of existingRunState.exploredPaths) {
        session.exploredPaths.add(p);
      }
      for (const f of existingRunState.mutatedFiles) {
        session.mutatedFiles.add(f);
      }
      if (existingRunState.lastVerification) {
        session.lastVerification = existingRunState.lastVerification;
      }

      // Restore step count so budget tracking continues from where it left off.
      // This ensures the resumed run uses the REMAINING budget, not a fresh one.
      session.stepCount = existingRunState.stepsCompleted;

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

    // Build deterministic preflight section from workingSet
    const preflightSection = task.workingSet && task.workingSet.length > 0
      ? `\n\n## Deterministic Task Packet\nStart in these runtime-core files before any broader reconnaissance. Only expand beyond this working set if the requested fix cannot be completed there:\n${task.workingSet.map((f, i) => `${i === 0 ? '→' : '-'} ${f}`).join('\n')}\nHint: Start by looking in ${task.fileHint || task.workingSet[0]}`
      : (task.fileHint ? `\nHint: Start by looking in ${task.fileHint}` : '');

    // Add task description
    const taskPrompt = `## Current Task

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}${preflightSection}${resumeSection}

You are in LLM-driven mode. Plan your own steps. ${isResume ? 'Continue from where the previous run left off.' : 'Start by reading the relevant file(s).'}

Respond with a JSON object containing your tool call:
{\n  "thought": "What you're doing and why",\n  "tool": "toolName",\n  "params": { ... },\n  "expectedResult": "What you expect"\n}

When the task is complete and build passes, respond with tool "complete".`;

    session.messages.push({
      role: 'user',
      content: taskPrompt,
    });

    // ── Deterministic preflight read for bounded runs ──────────────
    // For bounded runs with a workingSet, read those files NOW before
    // the LLM planning loop begins. This injects file contents into
    // session context deterministically, reducing early blind reads.
    if (task.workingSet && task.workingSet.length > 0) {
      const unreadFiles = task.workingSet.filter(f => !session.exploredPaths.has(f));
      if (unreadFiles.length > 0) {
        Logger.debug('LLMModeAgent', `Preflight: reading ${unreadFiles.length} workingSet files`);
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
              preflightContents.push(`=== ${filePath} ===\n${content}`);
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
          session.status = Status.SUCCESS;
          session.exitReason = 'bounded-inspection';
          session.endTime = new Date().toISOString();
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
          message: 'asking GLM for next tool call',
        });

        // Get LLM's plan
        const toolCall = await this.getLLMPlan(session);
        
        if (!toolCall) {
          Logger.error('LLMModeAgent', 'Failed to parse LLM response');
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
          Logger.debug('LLMModeAgent', 'Task completed by LLM');
          await clearRunState();
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

        if (result.success && this.isInspectionTool(toolCall.tool)) {
          session.successfulInspectionCalls++;
        }

        if (this.shouldStopAfterSuccessfulVerification(session, toolCall.tool, result)) {
          Logger.info('LLMModeAgent', `Auto-completing bounded run after successful ${toolCall.tool}`);
          await clearRunState();
          session.status = Status.SUCCESS;
          session.endTime = new Date().toISOString();
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

      // Loop ended without explicit completion via 'complete' tool.
<<<<<<< HEAD
      // Bubble Tea inspection-only runs should not surface as generic failures
      // when no mutations were made, regardless of whether the loop ended via
      // parse failure or simple step exhaustion.
      const tuiInspectionOnly =
        session.task.id.startsWith('tui-self-') &&
        session.backups.length === 0 &&
        this.hasMeaningfulInspection(session);
      if (tuiInspectionOnly) {
=======
      // Only bounded runs that actually completed meaningful successful
      // inspection work should classify as bounded-no-change successes.
      if (this.shouldClassifyAsBoundedNoChangeSuccess(session)) {
>>>>>>> 5e10b72f (Prevent startup failures from masquerading as bounded no-change successes)
        Logger.debug('LLMModeAgent', `Treating TUI inspection-only run as no-change success after ${session.stepCount} steps`);
        await clearRunState();
        session.status = Status.SUCCESS;
        session.exitReason = 'bounded-no-change';
        session.endTime = new Date().toISOString();

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
        Logger.error('LLMModeAgent', `Failed to parse LLM response after ${session.stepCount} steps`);
        session.status = Status.FAILED;
        session.endTime = new Date().toISOString();

        eventBus.emit(EventTypes.PROCESS_END, 'LLMModeAgent', {
          process: 'agent-task',
          success: false,
          reason: 'Failed to parse LLM response',
          iterations: session.stepCount,
          durationMs: Date.now() - new Date(session.startTime).getTime(),
        });

        // Rollback if needed
        if (session.backups.length > 0) {
          await this.rollback(session);
          session.status = Status.ROLLED_BACK;
        }
      } else if (session.backups.length === 0) {
        if (this.isBoundedInspectionRun(session)) {
          Logger.error('LLMModeAgent', `Bounded run ended before meaningful successful inspection after ${session.stepCount} steps`);
          session.status = Status.FAILED;
          session.endTime = new Date().toISOString();

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
        session.status = Status.SUCCESS;
        session.exitReason = 'bounded-no-change';
        session.endTime = new Date().toISOString();

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

        // Determine the semantic boundary phase based on what was accomplished
        const phase = session.lastVerification
          ? (session.lastVerification.passed
            ? SemanticBoundary.VERIFICATION_FINISHED
            : SemanticBoundary.VERIFICATION_STARTED)
          : (session.mutatedFiles.size > 0
            ? SemanticBoundary.MUTATION_APPLIED
            : SemanticBoundary.INTERRUPTED);

        // Capture workspace fingerprint for safe resume validation
        let workspaceFingerprint;
        try {
          workspaceFingerprint = await captureWorkspaceFingerprint();
        } catch (fpErr) {
          Logger.warn('LLMModeAgent', `Could not capture workspace fingerprint: ${fpErr}`);
        }

        // Save run state for potential resume with authoritative tracking data
        const runState: RunState = {
          runId: `run-${task.id}-${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          taskDescription: task.description,
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
          workspaceFingerprint,
        };

        try {
          await saveRunState(runState);
          Logger.info('LLMModeAgent', 'Run state saved for potential resume');
        } catch (saveErr) {
          Logger.error('LLMModeAgent', `Failed to save run state: ${saveErr}`);
        }

        session.status = Status.SUSPENDED;
        session.endTime = new Date().toISOString();

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
    const rateLimitResult = await rateLimiter.execute(this.llmRateLimitOperation(session), async () => {
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

      const jsonText = this.extractFirstJsonObject(jsonStr);
      if (!jsonText) {
        const implicitComplete = this.tryImplicitCompletion(session, text);
        if (implicitComplete) {
          Logger.debug('LLMModeAgent', 'Using implicit completion fallback for late-stage plain-text response');
          return implicitComplete;
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
    if (!hasMutation) return null;

    const buildPassed = this.hasSuccessfulTool(session, 'runBuild');
    if (!buildPassed) return null;

    const testsPassed = this.hasSuccessfulTool(session, 'runTests');
    const completionLike = /(?:task\s+complete|fix\s+is\s+complete|providing\s+final\s+report|all\s+\d*\s*tests?\s+pass|tests?\s+pass(?:ed)?|done\b)/i.test(trimmed);

    if (!completionLike) return null;
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
            // Capture verification state for resume context
            if (this.currentSession) {
              this.currentSession.lastVerification = {
                passed: buildResult.success,
                type: 'build',
                error: buildResult.error,
                timestamp: new Date().toISOString(),
              };
            }
            return buildResult;
          }
          
          case 'runTests': {
            const testResult = await runTestsTool.execute(params);
            // Capture verification state for resume context
            if (this.currentSession) {
              this.currentSession.lastVerification = {
                passed: testResult.success,
                type: 'test',
                error: testResult.error,
                timestamp: new Date().toISOString(),
              };
            }
            return testResult;
          }
          
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
          case 'gitStatus':
            return gitStatusTool.execute(params);
          case 'localCheckpoint':
            return localCheckpointTool.execute(params);

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

  private isVerificationTool(tool: string): boolean {
    return tool === 'runBuild' || tool === 'runTests' || tool === 'typeCheck';
  }

<<<<<<< HEAD
  private isInspectionTool(tool: string): boolean {
    return tool === 'readFile' || tool === 'search' || tool === 'listDir' || tool === 'gitStatus' || tool === 'lsp' || tool === 'astValidate' || tool === 'importGuard';
  }

  private hasMeaningfulInspection(session: LLMSession): boolean {
    return session.successfulInspectionCalls > 0;
=======
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

  private hasMeaningfulSuccessfulInspection(session: LLMSession): boolean {
    for (let i = 0; i < session.messages.length - 1; i++) {
      const message = session.messages[i];
      const next = session.messages[i + 1];
      if (!message.toolCall || !this.isMeaningfulInspectionTool(message.toolCall.tool)) continue;
      if (next.toolResult?.success) return true;
    }
    return false;
  }

  private shouldClassifyAsBoundedNoChangeSuccess(session: LLMSession): boolean {
    if (!this.isBoundedInspectionRun(session)) return false;
    if (session.mutatedFiles.size > 0 || session.backups.length > 0) return false;
    return this.hasMeaningfulSuccessfulInspection(session);
>>>>>>> 5e10b72f (Prevent startup failures from masquerading as bounded no-change successes)
  }

  private shouldStopAfterSuccessfulVerification(session: LLMSession, tool: string, result: ToolResult): boolean {
    if (session.task.completionPolicy !== 'stop_after_verification') return false;
    if (!this.isVerificationTool(tool)) return false;
    if (!result.success) return false;
    if ((result.data as { skipped?: boolean } | undefined)?.skipped) return false;
    return session.backups.length > 0 || session.mutatedFiles.size > 0;
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
    if (!this.hasMeaningfulSuccessfulInspection(session)) return false;

    return true;
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
