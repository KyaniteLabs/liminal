import { Logger } from '../utils/Logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TuiEventStream } from './TuiEventStream.js';
import { TuiSessionStore } from './TuiSessionStore.js';
import { ConversationManager } from '../chat/ConversationManager.js';
import { RalphLoop } from '../core/RalphLoop.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiBridgeEvent, TuiFailureProvenance, TuiInputRequest, TuiPendingAction, TuiRunKind, TuiRunLifecycle, TuiRunPhase, TuiSessionStatus } from './types.js';
import { Domain } from '../types/domains.js';
import { eventBus, EventTypes, type BusEvent } from '../core/EventBus.js';
import { createLLMModeAgent, type LLMSession } from '../harness/agent/index.js';
import { IntentRouter } from '../agent/IntentRouter.js';
import { ModeAwareRouter, PRODUCT_MODES } from '../agent/ProductMode.js';
import type { ModeConfig, ProductMode } from '../agent/ProductMode.js';
import { ModeRegistry } from '../agent/ModeRegistry.js';
import { SkillRunner } from '../agent/SkillRunner.js';
import { SkillCatalog } from '../agent/SkillCatalog.js';
import { ReviewManager } from '../agent/ReviewManager.js';
import { DiffRenderer } from '../agent/DiffRenderer.js';
import { OnboardingWizard } from '../agent/OnboardingWizard.js';
import { EnvironmentValidator } from '../agent/EnvironmentValidator.js';
import { SessionResumer } from '../agent/SessionResumer.js';
import { ReportGenerator } from '../agent/ReportGenerator.js';
import { WorkspaceManager } from '../agent/WorkspaceManager.js';
import { AutonomyController } from '../agent/AutonomyController.js';
import { STUDIO_SYSTEM_PROMPT } from '../agent/StudioAgent.js';
import { SessionGraph } from '../agent/SessionGraph.js';
import { CortexPerceptionBus } from '../cortex/CortexPerceptionBus.js';
import { GoalStore } from '../cortex/GoalStore.js';
import { LiminalCortex } from '../cortex/LiminalCortex.js';
import { CortexExplainer } from '../cortex/CortexExplainer.js';
import type { CortexConfig } from '../cortex/types.js';
import { AutonomousGardener, type GardenerCycleResult } from '../autonomy/AutonomousGardener.js';
import { LiminalFS } from '../fs/LiminalFS.js';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import { AmbiguityDetector } from '../core/AmbiguityDetector.js';
import { buildCreativePreferencePromptHints, createCreativePreferenceSuggestion } from '../chat/CreativePreferenceGuide.js';
import type { Domain as ChatDomain } from '../chat/types.js';
import {
  buildCreativeDomainRouteTruth,
  detectPreviewDomainForCode,
  previewDomainForCode,
  validateGeneratedDomainForRequest,
  type CreativeDomainRouteTruth,
} from './CreativeDomainRouting.js';
import { summarizeReasoningTrace } from './TraceSummarizer.js';
import { normalizeOptions } from '../core/LoopConfig.js';
import { GenerationOrchestrator } from '../core/GenerationOrchestrator.js';
import { Gallery } from '../gallery/Gallery.js';
import { PostGenerationCognitiveWriter } from './PostGenerationCognitiveWriter.js';
import { detectProviderLabel } from '../config/ProviderRuntime.js';
import { compactLLMErrorProvenance, extractLLMErrorProvenance } from '../llm/ErrorProvenance.js';
import { describeStatusLifecycle } from '../types/status.js';

export const TUI_SYSTEM_PROMPT = `You are Liminal's Meta-Harness operator interface.

Primary role:
- Help inspect, debug, repair, and improve the Liminal codebase and harness.
- Treat self-improvement, CI fixes, dogfood diagnostics, TUI fixes, generator hardening, and repo maintenance as first-class tasks.
- You are allowed and expected to discuss how the system should improve itself.

Secondary role:
- Support creative coding requests when the user explicitly asks for art/music/code generation.

Operating rules:
- Be direct and technical.
- Do not refuse self-improvement work or narrow your identity to creative-only help.
- If you do not have tool execution in the current path, say what needs to be inspected or changed rather than pretending it is impossible.
- Prefer root cause, exact files, verification steps, and small patches.
- Generated code is untrusted until verified.`;

/** Keywords that indicate a generation request */
const GENERATION_KEYWORDS = [
  'generate', 'create', 'make', 'sketch', 'draw', 'code',
  'p5', 'three.js', 'shader', 'glsl', 'hydra', 'strudel',
  'visualization', 'animation', 'pattern', 'art',
];

const SELF_IMPROVEMENT_KEYWORDS = [
  'self-improve', 'self improve', 'self-improvement', 'improve itself',
  'fix', 'debug', 'diagnose', 'repair', 'refactor', 'cleanup',
  'harness', 'meta-harness', 'bubble tea', 'tui', 'ci', 'build',
  'test', 'dogfood', 'repo', 'codebase', 'generator hardening',
];

const OPERATOR_INSPECTION_PATTERNS = [
  /\bread-only\b/,
  /\bdo not modify\b/,
  /\bdo not create files?\b/,
  /\bdo not commit\b/,
  /\bdo not push\b/,
  /\buse tool calls only\b/,
  /\btelemetry-friendly\b/,
  /\bdogfood checkpoint\b/,
  /\brepository state\b/,
  /\bprovider\/model truth\b/,
  /\btool schema recovery\b/,
];

/** Check if input indicates repo/harness repair rather than creative generation. */
export function isSelfImprovementRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return SELF_IMPROVEMENT_KEYWORDS.some(kw => lower.includes(kw));
}

/** Check if input is an operator inspection/checkpoint, not creative generation. */
export function isOperatorInspectionRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const matchCount = OPERATOR_INSPECTION_PATTERNS
    .filter(pattern => pattern.test(lower))
    .length;
  return matchCount >= 2;
}

/** Check if input indicates creative generation intent */
export function isGenerationRequest(text: string): boolean {
  if (isSelfImprovementRequest(text)) return false;

  const lower = text.toLowerCase();
  const operatorLike = /\b(fix|debug|diagnose|repair|refactor|cleanup|harness|meta-harness|bubble tea|tui|ci|build|test|dogfood|repo|codebase)\b/.test(lower);
  if (operatorLike) return false;
  return GENERATION_KEYWORDS.some(kw => lower.includes(kw));
}

function logBridge(event: string, fields: Record<string, unknown>): void {
  Logger.info('TuiBridgeService', `${event} ${JSON.stringify(fields)}`);
}

interface CreativeIntentBrief {
  userRequest: string;
  requirements: string[];
  missingDetails: string[];
  questions: string[];
  shouldClarify: boolean;
  reason: string;
}

export class TuiBridgeService {
  private sessions = new TuiSessionStore();
  private stream = new TuiEventStream();
  private activeStreams = new Map<string, AbortController>();
  // Step 1: Conversation memory - one ConversationManager per session
  private conversations = new Map<string, ConversationManager>();
  // Studio routing: intelligent intent classification replaces keyword matching
  private router = new IntentRouter();
  // Session persistence: records every turn per session
  private sessionGraphs = new Map<string, SessionGraph>();
  // Product mode registry: per-session mode biasing
  private modeRegistry = new ModeRegistry();
  // Skill runner: resolves and executes skill templates
  private skillRunner = new SkillRunner();
  // Skill catalog: lists skills with mode filtering
  private skillCatalog = new SkillCatalog();
  // Review manager: candidate lifecycle (accept/reject/pin)
  private reviewManager = new ReviewManager();
  // Diff renderer: unified diff between candidates
  private diffRenderer = new DiffRenderer();
  // Onboarding wizard: provider setup
  private onboardingWizard = new OnboardingWizard();
  // Environment validator: diagnostics
  private envValidator = new EnvironmentValidator();
  // Session resumer: session history
  private sessionResumer = new SessionResumer();
  // Report generator: session reports from SessionGraph data
  private reportGenerator = new ReportGenerator();
  // Workspace manager: workspace CRUD
  private workspaceManager = new WorkspaceManager();
  // Autonomy controller: approval gating per level
  private autonomyController = new AutonomyController();
  // Cortex perception bus: aggregates live system state from EventBus
  private cortexBus = new CortexPerceptionBus(eventBus);
  // Cortex goal store: persists user goals via LiminalFS
  private goalStore: GoalStore | null = null;
  // Cortex loop: background executive that fuses perception + goals into actions
  private cortexLoop: LiminalCortex | null = null;
  // Autonomous gardener: coordinates taste learning, dream recombination, emergence cycles
  private gardener: AutonomousGardener | null = null;
  // Cognitive write-back: memory, compost, and dreaming receipts for Studio generation
  private cognitiveWriter: PostGenerationCognitiveWriter;
  /** Default Gardener configuration */
  private static readonly GARDENER_CONFIG = {
    mode: 'co-create' as const,
    totalBudget: 100,
    stagnationWindow: 10,
    explorationFraction: 0.3,
    replayRatio: 0.4,
    maxConsecutiveReplay: 3,
    maxArchiveTasks: 10,
    replayBiasStrength: 0.7,
    minTasteScore: 0.5,
  };
  /** Default Cortex configuration */
  private static readonly CORTEX_CONFIG: CortexConfig = {
    loopIntervalMs: 30000,   // 30s tick
    maxConsecutiveFailures: 5,
    budgetActionsLimit: 10,
    budgetTokenLimit: 50000,
    autonomyLevel: 'assist',
  };
  /** Interval in ms for cortex snapshot broadcasts (default: 5s) */
  private static readonly CORTEX_BROADCAST_INTERVAL_MS = 5000;
  /** Handle for the cortex broadcast interval (stored for cleanup) */
  private cortexBroadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: { cognitiveWriter?: PostGenerationCognitiveWriter } = {}) {
    this.cognitiveWriter = options.cognitiveWriter ?? new PostGenerationCognitiveWriter();
    // Start the Cortex perception bus
    this.cortexBus.start();
    // Broadcast cortex snapshots to all active sessions periodically
    // Uses emitEphemeral so these high-frequency status updates don't grow
    // the per-session event log (codex P1 review feedback).
    this.cortexBroadcastTimer = setInterval(() => {
      const snapshot = this.cortexBus.getSnapshot();
      for (const sessionId of this.sessions.list()) {
        this.stream.emitEphemeral(sessionId, { type: 'cortex.snapshot', sessionId, snapshot });
      }
    }, TuiBridgeService.CORTEX_BROADCAST_INTERVAL_MS);

    // Start the Cortex background executive loop.
    // Fuses perception + goals into priority-ranked actions, emitting
    // cortex.loop_tick, cortex.decision, and cortex.action_proposed events.
    this.cortexLoop = new LiminalCortex({
      perceptionBus: this.cortexBus,
      goalStore: {
        getActiveGoals: () => this.getGoalStore()?.getActiveGoals() ?? [],
      },
      config: TuiBridgeService.CORTEX_CONFIG,
      onEvent: (evt) => {
        // Broadcast cortex loop events to all active sessions
        for (const sid of this.sessions.list()) {
          this.stream.emitEphemeral(sid, {
            type: evt.type,
            sessionId: sid,
            tickNumber: evt.tickNumber,
            data: evt.data,
          } as Extract<TuiBridgeEvent, { type: typeof evt.type }>);
        }
      },
    });
    this.cortexLoop.start();

    // Start the Autonomous Gardener — coordinates taste learning, dream
    // recombination, and emergence evaluation in the background. Uses empty
    // archive getters initially; the gardener handles empty state gracefully.
    this.gardener = new AutonomousGardener(TuiBridgeService.GARDENER_CONFIG);
    void this.gardener.start(
      () => [],   // Archive cells — populated by emergence pipeline at runtime
      () => [],   // Descriptor axes — populated by emergence pipeline at runtime
      (result: GardenerCycleResult) => {
        for (const sid of this.sessions.list()) {
          this.stream.emitEphemeral(sid, {
            type: 'gardener.cycle',
            sessionId: sid,
            cycle: result.cycle,
            mode: result.mode,
            actions: result.actions,
            budgetRemaining: result.budgetRemaining,
            taskBreakdown: result.taskBreakdown,
            health: result.health,
          });
        }
      },
    ).catch((err) => {
      Logger.warn('TuiBridgeService', 'Gardener background cycle failed:', err);
    });

    // Wire SWARM_ROUND events from the EventBus to all active TUI sessions.
    // External consumers (Bubble Tea client, gallery) receive these via SSE
    // through the existing TuiEventStream subscription mechanism.
    eventBus.onEvent((event) => {
      if (event.type !== EventTypes.SWARM_ROUND) return;
      const data = event.data as {
        round: number;
        totalRounds: number;
        vocabularySize: number;
        winner: string | null;
        converged: boolean;
        outputs: Record<string, unknown>;
        votes: Record<string, unknown>;
        timestamp: number;
      };
      // Broadcast to every active session
      for (const sessionId of this.sessions.list()) {
        this.stream.emit(sessionId, {
          type: 'swarm.round',
          sessionId,
          round: data.round,
          totalRounds: data.totalRounds,
          vocabularySize: data.vocabularySize,
          winner: data.winner,
          converged: data.converged,
          outputs: data.outputs,
          votes: data.votes,
          timestamp: data.timestamp,
        });
      }
    });
  }

  createSession(patch: Partial<Pick<TuiSessionStatus, 'provider' | 'model' | 'roles' | 'evaluation'>> = {}): TuiSessionStatus {
    const sessionId = `tui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Initialize conversation manager for this session
    const conversation = new ConversationManager();
    conversation.startNewSession();
    this.conversations.set(sessionId, conversation);

    // Initialize session graph for turn persistence
    const graph = new SessionGraph(sessionId);
    this.sessionGraphs.set(sessionId, graph);

    // Register with session resumer for /sessions command
    this.sessionResumer.register(sessionId, graph);

    return this.sessions.create({
      sessionId,
      mode: 'chat',
      provider: patch.provider,
      model: patch.model,
      roles: patch.roles,
      evaluation: patch.evaluation,
      trust: { level: 'untrusted', label: 'Generated code is untrusted by default' },
    });
  }

  getStatus(sessionId: string): TuiSessionStatus {
    const status = this.sessions.get(sessionId);
    if (!status) throw new Error(`Unknown TUI session: ${sessionId}`);
    return status;
  }

  getEvents(sessionId: string): TuiBridgeEvent[] {
    return this.stream.getEvents(sessionId);
  }

  getEventsSince(sessionId: string, lastEventId: number) {
    return this.stream.getEventsSince(sessionId, lastEventId);
  }

  subscribe(sessionId: string, listener: (event: TuiBridgeEvent) => void): () => void {
    return this.stream.subscribe(sessionId, listener);
  }

  subscribeWithId(sessionId: string, listener: (stored: { id: number; event: TuiBridgeEvent }) => void): () => void {
    return this.stream.subscribeWithId(sessionId, listener);
  }

  updateStatus(sessionId: string, patch: Partial<TuiSessionStatus>): TuiSessionStatus {
    const status = this.sessions.update(sessionId, patch);
    this.emit(sessionId, { type: 'status.updated', sessionId, status });
    return status;
  }

  private beginRun(
    sessionId: string,
    details: {
      kind: TuiRunKind;
      label: string;
      executionMode?: 'draft' | 'prove';
      model?: string;
      provider?: string;
    },
  ): TuiRunLifecycle {
    const now = new Date().toISOString();
    const run: TuiRunLifecycle = {
      runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: details.kind,
      phase: 'queued',
      label: details.label,
      startedAt: now,
      updatedAt: now,
      executionMode: details.executionMode,
      model: details.model,
      provider: details.provider,
    };
    this.setRunLifecycle(sessionId, run, details.label);
    return run;
  }

  private transitionRun(
    sessionId: string,
    phase: TuiRunPhase,
    patch: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt'>> = {},
  ): TuiRunLifecycle | undefined {
    const current = this.sessions.get(sessionId)?.run;
    if (!current) return undefined;
    const now = new Date().toISOString();
    const run: TuiRunLifecycle = {
      ...current,
      ...patch,
      phase,
      updatedAt: now,
      completedAt: phase === 'completed' ? (patch.completedAt ?? now) : patch.completedAt ?? current.completedAt,
      failedAt: phase === 'failed' ? (patch.failedAt ?? now) : patch.failedAt ?? current.failedAt,
    };
    this.setRunLifecycle(sessionId, run, run.label);
    return run;
  }

  private completeRun(
    sessionId: string,
    patch: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt' | 'phase'>> = {},
  ): TuiRunLifecycle | undefined {
    return this.transitionRun(sessionId, 'completed', {
      ...patch,
      outcome: 'completed',
    });
  }

  private failRun(
    sessionId: string,
    error: string,
    outcome: 'failed' | 'cancelled' = 'failed',
    patch: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt' | 'phase' | 'error' | 'outcome'>> = {},
  ): TuiRunLifecycle | undefined {
    return this.transitionRun(sessionId, 'failed', { ...patch, error, outcome });
  }

  private suspendRun(
    sessionId: string,
    error: string,
    patch: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt' | 'phase' | 'error' | 'outcome'>> = {},
  ): TuiRunLifecycle | undefined {
    return this.transitionRun(sessionId, 'suspended', { ...patch, error, outcome: 'suspended' });
  }

  private setRunLifecycle(sessionId: string, run: TuiRunLifecycle, activeTask?: string): void {
    const status = this.sessions.update(sessionId, {
      run,
      activeTask: activeTask ?? run.label,
      model: run.model ?? this.sessions.get(sessionId)?.model,
      provider: run.provider ?? this.sessions.get(sessionId)?.provider,
    });
    this.emit(sessionId, { type: 'run.lifecycle', sessionId, run });
    this.emit(sessionId, { type: 'status.updated', sessionId, status });
  }

  private emitDomainTruth(
    sessionId: string,
    route: CreativeDomainRouteTruth,
    patch: { generatedDomain?: string; previewDomain?: string; artifactPath?: string } = {},
  ): void {
    this.emit(sessionId, {
      type: 'generation.domain_truth',
      sessionId,
      requestedDomain: route.requestedDomain,
      selectedDomain: route.selectedDomain,
      domains: route.domains,
      promptDomainLocked: route.promptDomainLocked,
      source: route.source,
      ...patch,
    });
  }

  private failureProvenance(
    error: unknown,
    fallback: TuiFailureProvenance = {},
  ): TuiFailureProvenance {
    return compactLLMErrorProvenance(extractLLMErrorProvenance(error), fallback);
  }

  private errorEvent(sessionId: string, error: unknown, fallback: TuiFailureProvenance = {}): TuiBridgeEvent {
    return {
      type: 'error',
      sessionId,
      message: error instanceof Error ? error.message : String(error),
      ...this.failureProvenance(error, fallback),
    };
  }

  emitCommandResponse(sessionId: string, content: string): void {
    this.emit(sessionId, { type: 'response.started', sessionId });
    this.emit(sessionId, { type: 'response.delta', sessionId, delta: content });
    this.emit(sessionId, { type: 'response.completed', sessionId, content });
    this.emit(sessionId, { type: 'response.committed', sessionId, content });
  }

  /** Emit video render lifecycle events via SSE. */
  emitVideoRenderStart(sessionId: string, domain: string): void {
    this.emit(sessionId, { type: 'video:render:start', sessionId, domain });
  }

  emitVideoRenderComplete(sessionId: string, domain: string, videoPath: string): void {
    this.emit(sessionId, { type: 'video:render:complete', sessionId, domain, videoPath });
  }

  emitVideoRenderError(sessionId: string, domain: string, error: string): void {
    this.emit(sessionId, { type: 'video:render:error', sessionId, domain, error });
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async submitInput(
    sessionId: string,
    input: TuiInputRequest,
    llm?: LLMClient,
  ): Promise<{ reviewRequired: boolean }> {
    // Cancel any in-flight stream for this session
    this.cancelStream(sessionId);

    this.sessions.update(sessionId, { mode: input.mode });
    const selfImprovement = isSelfImprovementRequest(input.text);
    const creativeGeneration = isGenerationRequest(input.text);

    // Handle /modes command: list available modes (must check before /mode prefix)
    if (input.text.trim() === '/modes') {
      const modes = Object.entries(PRODUCT_MODES).map(([mode, info]) => ({
        mode,
        label: info.label,
        description: info.description,
      }));
      this.emit(sessionId, { type: 'mode.list', sessionId, modes });
      const content = modes.map(m => `  ${m.mode.padEnd(8)} ${m.label} — ${m.description}`).join('\n');
      this.emitCommandResponse(sessionId, `Available modes:\n${content}`);
      return { reviewRequired: false };
    }

    // Handle /mode command: switch product mode for this session
    if (input.text.startsWith('/mode')) {
      return this.handleModeCommand(sessionId, input.text);
    }

    // Handle /skills command: list available skills
    if (input.text.trim() === '/skills') {
      const modeConfig = this.modeRegistry.getMode(sessionId);
      const entries = await this.skillCatalog.list({ mode: modeConfig?.mode });
      this.emit(sessionId, {
        type: 'skill.list',
        sessionId,
        skills: entries.map(e => ({ name: e.name, description: e.description, mode: e.mode })),
      });
      if (entries.length === 0) {
        this.emitCommandResponse(sessionId, 'No skills available. Add .skills/<name>/SKILL.md files.');
      } else {
        const lines = entries.map(e => {
          const modeTag = e.mode ? ` [${e.mode}]` : '';
          return `  ${e.name.padEnd(20)} ${e.description}${modeTag}`;
        });
        this.emitCommandResponse(sessionId, `Available skills:\n${lines.join('\n')}`);
      }
      return { reviewRequired: false };
    }

    // Handle /skill <name> command: run a skill
    if (input.text.startsWith('/skill ')) {
      return this.handleSkillCommand(sessionId, input.text, llm);
    }

    // Handle review commands: /accept, /reject, /pin, /diff, /candidates
    if (input.text.startsWith('/accept') || input.text.startsWith('/reject') ||
        input.text.startsWith('/pin') || input.text.startsWith('/diff') ||
        input.text.trim() === '/candidates') {
      return this.handleReviewCommand(sessionId, input.text);
    }

    // Handle /setup: run onboarding wizard
    if (input.text.trim() === '/setup') {
      return this.handleSetupCommand(sessionId);
    }

    // Handle /diagnostics: run environment validation
    if (input.text.trim() === '/diagnostics') {
      return this.handleDiagnosticsCommand(sessionId);
    }

    // Handle /sessions: list session history
    if (input.text.trim() === '/sessions') {
      return this.handleSessionsCommand(sessionId);
    }

    // Handle /report [json|markdown]: generate session report
    if (input.text.trim() === '/report' || input.text.trim() === '/report markdown' || input.text.trim() === '/report json') {
      return this.handleReportCommand(sessionId, input.text.trim());
    }

    // Handle /workspace create <name>|switch <name>|list
    if (input.text.startsWith('/workspace')) {
      return this.handleWorkspaceCommand(sessionId, input.text.trim());
    }

    // Handle /autonomy <assist|co-create|autopilot>
    if (input.text.startsWith('/autonomy')) {
      return this.handleAutonomyCommand(sessionId, input.text.trim());
    }

    // Handle /goal add <text>|list|remove <id>|done <id>
    if (input.text.startsWith('/goal')) {
      return this.handleGoalCommand(sessionId, input.text.trim());
    }

    // Handle /cortex [start|stop]
    if (input.text.trim() === '/cortex' || input.text.trim().startsWith('/cortex ')) {
      return this.handleCortexCommand(sessionId, input.text.trim());
    }

    // Studio routing: classify intent via IntentRouter with mode biasing
    const modeConfig = this.modeRegistry.getMode(sessionId);
    const classifier = new ModeAwareRouter(this.router, () => modeConfig);
    const baseClassification = classifier.classify(input.text);
    const classification = input.clientIntent === 'creative'
      ? {
          ...baseClassification,
          intent: 'creative' as const,
          confidence: 'high' as const,
          topic: baseClassification.topic ?? 'generate',
        }
      : isOperatorInspectionRequest(input.text)
      ? {
          ...baseClassification,
          intent: 'engineering' as const,
          confidence: 'high' as const,
          topic: baseClassification.topic ?? 'inspect',
        }
      : baseClassification;

    logBridge('input.received', {
      sessionId,
      mode: input.mode,
      intent: input.clientIntent,
      studioIntent: classification.intent,
      studioConfidence: classification.confidence,
      topic: classification.topic,
      selfImprovement,
      creativeGeneration,
      chars: input.text.length,
    });

    if (input.clientIntent === 'action' || input.mode === 'action') {
      const pendingAction: TuiPendingAction = {
        id: `action-${Date.now()}`,
        title: input.text.slice(0, 60),
        description: input.text,
        prompt: input.text,
        route: 'operator',
        kind: 'llm',
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
      };
      const status = this.sessions.update(sessionId, {
        mode: 'action',
        trust: { level: 'review-required', label: 'Review required before mutation' },
        pendingAction,
      });
      this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
      this.emit(sessionId, { type: 'status.updated', sessionId, status });
      logBridge('input.routed', { sessionId, route: 'action.review_required' });
      return { reviewRequired: true };
    }

    // Get or create conversation manager for this session
    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      conversation = new ConversationManager();
      conversation.startNewSession();
      this.conversations.set(sessionId, conversation);
    }

    // Record user message in conversation history
    conversation['recordMessage']('user', input.text);

    // Step 2: Route via StudioAgent classification
    this.emit(sessionId, { type: 'response.started', sessionId });

    const routeStart = Date.now();
    const handleError = (err: unknown) => {
      const config = llm?.getConfig();
      this.emit(sessionId, this.errorEvent(sessionId, err, {
        provider: config?.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : undefined,
        model: config?.model,
        endpoint: config?.baseUrl,
      }));
    };

    const emitSessionTurn = (delegatedTo: string, responseContent?: string, extras?: { artifactRefs?: string[]; taskRefs?: string[] }) => {
      const turnId = `turn-${Date.now()}`;
      const durationMs = Date.now() - routeStart;
      this.emit(sessionId, {
        type: 'session.turn',
        sessionId,
        turnId,
        intent: classification.intent,
        delegatedTo,
        durationMs,
        ...extras,
      });

      // Record turn in session graph
      const graph = this.sessionGraphs.get(sessionId);
      if (graph) {
        graph.recordTurn({
          turnId,
          input: input.text,
          intent: classification.intent,
          delegatedTo,
          response: responseContent ?? '',
          durationMs,
          artifactRefs: extras?.artifactRefs,
          taskRefs: extras?.taskRefs,
        });
      }
    };

    if (!llm) {
      // Fallback: echo without LLM
      this.emit(sessionId, { type: 'response.delta', sessionId, delta: input.text });
      this.emit(sessionId, { type: 'response.completed', sessionId, content: input.text });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: input.text });
      conversation['recordMessage']('assistant', input.text);
      emitSessionTurn('echo', input.text);
      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: input.mode,
          activeTask: input.text.slice(0, 60),
        }),
      });
      return { reviewRequired: false };
    }

    // Route based on StudioAgent intent classification
    // Autonomy gating: check if the action kind requires review at current level
    switch (classification.intent) {
      case 'creative': {
        const intentBrief = this.buildCreativeIntentBrief(input.text);
        this.emitIntentBrief(sessionId, intentBrief);
        this.emitReasoningTrace(sessionId, {
          phase: 'analysis',
          thought: intentBrief.shouldClarify
            ? 'Prompt is underspecified; asking for missing requirements before generation.'
            : 'Prompt has enough concrete intent to prepare generation.',
          detail: intentBrief.requirements.join(' | '),
          source: 'harness',
        });
        if (intentBrief.shouldClarify) {
          this.emitCreativeClarification(sessionId, intentBrief, conversation);
          emitSessionTurn('clarification', intentBrief.questions.join('\n'));
          break;
        }

        if (input.clientIntent === 'creative') {
          logBridge('input.routed', { sessionId, route: 'workbench.creative', confidence: classification.confidence });
          const executionMode = input.executionMode ?? 'draft';
          const runCreative = executionMode === 'draft'
            ? this.streamDraftGeneration(sessionId, input.text, conversation, llm, input)
            : this.streamRalphGeneration(sessionId, input.text, conversation, llm, input);
          runCreative
            .then(() => emitSessionTurn(executionMode === 'draft' ? 'draft-generator' : 'ralph-loop'))
            .catch(handleError);
          break;
        }

        const actionKind = 'creative' as const;
        if (this.autonomyController.requiresReview(actionKind, sessionId)) {
          const pendingAction: TuiPendingAction = {
            id: `action-${Date.now()}`,
            title: input.text.slice(0, 60),
            description: `Creative: ${input.text}`,
            prompt: input.text,
            route: 'creative',
            kind: 'llm',
            requiresConfirmation: true,
            createdAt: new Date().toISOString(),
          };
          const status = this.sessions.update(sessionId, {
            mode: 'action',
            trust: { level: 'review-required', label: `Autonomy: ${this.autonomyController.getConfig(sessionId).label} — creative needs review` },
            pendingAction,
          });
          this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
          this.emit(sessionId, { type: 'status.updated', sessionId, status });
          return { reviewRequired: true };
        }
        logBridge('input.routed', { sessionId, route: 'studio.creative', confidence: classification.confidence });
        this.streamRalphGeneration(sessionId, input.text, conversation, llm, input)
          .then(() => emitSessionTurn('ralph-loop'))
          .catch(handleError);
        break;
      }

      case 'engineering': {
        const actionKind = 'engineering' as const;
        if (this.autonomyController.requiresReview(actionKind, sessionId)) {
          const pendingAction: TuiPendingAction = {
            id: `action-${Date.now()}`,
            title: input.text.slice(0, 60),
            description: `Engineering: ${input.text}`,
            prompt: input.text,
            route: 'engineering',
            kind: 'structured',
            requiresConfirmation: true,
            createdAt: new Date().toISOString(),
          };
          const status = this.sessions.update(sessionId, {
            mode: 'action',
            trust: { level: 'review-required', label: `Autonomy: ${this.autonomyController.getConfig(sessionId).label} — engineering needs review` },
            pendingAction,
          });
          this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
          this.emit(sessionId, { type: 'status.updated', sessionId, status });
          return { reviewRequired: true };
        }
        logBridge('input.routed', { sessionId, route: 'studio.engineering', confidence: classification.confidence });
        this.streamEngineeringTask(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('conveyor'))
          .catch(handleError);
        break;
      }

      case 'hybrid': {
        const actionKind = 'engineering' as const;
        if (this.autonomyController.requiresReview(actionKind, sessionId)) {
          const pendingAction: TuiPendingAction = {
            id: `action-${Date.now()}`,
            title: input.text.slice(0, 60),
            description: `Hybrid: ${input.text}`,
            prompt: input.text,
            route: 'hybrid',
            kind: 'llm',
            requiresConfirmation: true,
            createdAt: new Date().toISOString(),
          };
          const status = this.sessions.update(sessionId, {
            mode: 'action',
            trust: { level: 'review-required', label: `Autonomy: ${this.autonomyController.getConfig(sessionId).label} — hybrid needs review` },
            pendingAction,
          });
          this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
          this.emit(sessionId, { type: 'status.updated', sessionId, status });
          return { reviewRequired: true };
        }
        logBridge('input.routed', { sessionId, route: 'studio.hybrid', confidence: classification.confidence });
        this.streamHybridTask(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('ralph-loop'))
          .catch(handleError);
        break;
      }

      case 'direct':
      default:
        logBridge('input.routed', { sessionId, route: 'studio.direct', confidence: classification.confidence });
        this.streamDirectChat(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('llm-chat'))
          .catch(handleError);
        break;
    }

    return { reviewRequired: false };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async confirmAction(sessionId: string, actionId: string, llm?: LLMClient): Promise<void> {
    const currentStatus = this.getStatus(sessionId);
    if (!currentStatus.pendingAction || currentStatus.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    const pendingAction = currentStatus.pendingAction;
    const nextStatus = this.sessions.update(sessionId, {
      mode: 'confirm',
      pendingAction: undefined,
      trust: { level: 'confirmed', label: 'Operator confirmed mutation' },
    });
    this.emit(sessionId, { type: 'action.confirmed', sessionId, actionId });
    this.emit(sessionId, { type: 'status.updated', sessionId, status: nextStatus });

    if (!llm) return;

    const approvedText = (pendingAction.prompt ?? pendingAction.description.replace(/^(Operator|Engineering|Hybrid|Creative):\s*/i, '')).trim();
    if (!approvedText) return;
    const route = pendingAction.route ?? this.inferPendingActionRoute(pendingAction.description);

    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      conversation = new ConversationManager();
      conversation.startNewSession();
      this.conversations.set(sessionId, conversation);
    }

    this.emit(sessionId, { type: 'response.started', sessionId });
    const routeStart = Date.now();
    const runApproved = route === 'creative'
      ? this.streamRalphGeneration(sessionId, approvedText, conversation, llm)
      : route === 'hybrid'
        ? this.streamHybridTask(sessionId, approvedText, conversation, llm)
        : this.streamEngineeringTask(sessionId, approvedText, conversation, llm);

    runApproved
      .then(() => {
        this.emit(sessionId, {
          type: 'session.turn',
          sessionId,
          turnId: `turn-${Date.now()}`,
          intent: route === 'creative' ? 'creative' : route === 'hybrid' ? 'hybrid' : 'engineering',
          delegatedTo: route === 'creative' || route === 'hybrid' ? 'ralph-loop' : 'conveyor',
          durationMs: Date.now() - routeStart,
        });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Task failed: ${message}` });
        this.emit(sessionId, {
          type: 'error',
          sessionId,
          message,
        });
      });
  }

  private inferPendingActionRoute(description: string): NonNullable<TuiPendingAction['route']> {
    if (/^Creative:/i.test(description)) return 'creative';
    if (/^Hybrid:/i.test(description)) return 'hybrid';
    return 'engineering';
  }

  cancelAction(sessionId: string, actionId: string): void {
    const currentStatus = this.getStatus(sessionId);
    if (!currentStatus.pendingAction || currentStatus.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    const nextStatus = this.sessions.update(sessionId, {
      mode: 'chat',
      pendingAction: undefined,
      trust: { level: 'untrusted', label: 'Generated code is untrusted by default' },
    });
    this.emit(sessionId, { type: 'action.cancelled', sessionId, actionId });
    this.emit(sessionId, { type: 'status.updated', sessionId, status: nextStatus });
  }

  cancelRun(sessionId: string): void {
    this.cancelStream(sessionId);
    const status = this.sessions.get(sessionId);
    if (!status) {
      throw new Error(`Unknown TUI session: ${sessionId}`);
    }
    this.emit(sessionId, {
      type: 'generation.cancelled',
      sessionId,
      reason: 'operator-stop',
      cancelledAt: new Date().toISOString(),
      message: 'Generation stopped by operator.',
    });
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
    this.emit(sessionId, {
      type: 'status.updated',
      sessionId,
      status: this.sessions.update(sessionId, {
        mode: 'chat',
        activeTask: 'Generation stopped',
      }),
    });
    this.failRun(sessionId, 'Generation stopped by operator.', 'cancelled');
  }

  /**
   * Set the product mode for a session.
   * Emits mode.product_changed event for the TUI to render the mode badge.
   */
  setProductMode(sessionId: string, mode: ProductMode): ModeConfig {
    const config = this.modeRegistry.setMode(sessionId, mode);
    const modeInfo = PRODUCT_MODES[mode];

    logBridge('mode.changed', { sessionId, mode, label: modeInfo.label });

    this.emit(sessionId, {
      type: 'mode.product_changed',
      sessionId,
      mode,
      label: modeInfo.label,
      description: modeInfo.description,
    });

    return config;
  }

  /**
   * Handle /mode <ask|make|remix|improve> command.
   * Parses the mode name, sets it, and responds with confirmation.
   */
  private handleModeCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.trim().split(/\s+/);
    const modeName = parts[1]?.toLowerCase();

    if (!modeName || !Object.hasOwn(PRODUCT_MODES, modeName)) {
      const available = Object.keys(PRODUCT_MODES).join(', ');
      this.emitCommandResponse(sessionId, `Unknown mode. Available: ${available}`);
      return { reviewRequired: false };
    }

    const config = this.setProductMode(sessionId, modeName as ProductMode);
    const modeInfo = PRODUCT_MODES[config.mode];
    this.emitCommandResponse(sessionId, `Mode switched to ${modeInfo.label} — ${modeInfo.description}`);
    return { reviewRequired: false };
  }

  /**
   * Handle /skill <name> [args] command.
   * Resolves the skill template, emits skill.started, delegates to the
   * appropriate route (creative/engineering/chat), then emits skill.completed.
   */
  private async handleSkillCommand(
    sessionId: string,
    input: string,
    llm?: LLMClient,
  ): Promise<{ reviewRequired: boolean }> {
    const parts = input.trim().split(/\s+/);
    const skillName = parts[1];

    if (!skillName) {
      this.emitCommandResponse(sessionId, 'Usage: /skill <name> [input text]');
      return { reviewRequired: false };
    }

    const userInput = parts.slice(2).join(' ');
    const result = await this.skillRunner.resolve(skillName, { input: userInput });

    if (!result) {
      this.emitCommandResponse(sessionId, `Unknown skill: ${skillName}. Use /skills to list available skills.`);
      return { reviewRequired: false };
    }

    logBridge('skill.started', { sessionId, skillName, target: result.target, durationMs: result.durationMs });
    this.emit(sessionId, { type: 'skill.started', sessionId, skillName });

    // Get conversation for this session
    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      conversation = new ConversationManager();
      conversation.startNewSession();
      this.conversations.set(sessionId, conversation);
    }
    conversation['recordMessage']('user', input);

    if (!llm) {
      this.emitCommandResponse(sessionId, result.prompt);
      this.emit(sessionId, { type: 'skill.completed', sessionId, skillName, durationMs: result.durationMs });
      return { reviewRequired: false };
    }

    // Route the expanded skill prompt through the existing delegation paths
    const routeStart = Date.now();
    const handleError = (err: unknown) => {
      this.emit(sessionId, { type: 'error', sessionId, message: err instanceof Error ? err.message : String(err) });
    };

    const emitCompletion = () => {
      this.emit(sessionId, {
        type: 'skill.completed',
        sessionId,
        skillName,
        durationMs: Date.now() - routeStart,
      });
    };

    // Autonomy gating: check if the skill's action kind requires review
    // Chat skills bypass gating (matching direct-chat behavior)
    if (result.target !== 'chat') {
      const skillActionKind = result.target === 'creative' ? 'creative' as const : 'engineering' as const;
      if (this.autonomyController.requiresReview(skillActionKind, sessionId)) {
      const pendingAction: TuiPendingAction = {
        id: `skill-${skillName}-${Date.now()}`,
        title: `Skill: ${skillName}`,
        description: result.prompt.slice(0, 100),
        prompt: result.prompt,
        route: result.target === 'creative' ? 'creative' : result.target === 'engineering' ? 'engineering' : 'hybrid',
        kind: 'llm',
        requiresConfirmation: true,
        createdAt: new Date().toISOString(),
      };
      const status = this.sessions.update(sessionId, {
        mode: 'action',
        trust: { level: 'review-required', label: `Autonomy: ${this.autonomyController.getConfig(sessionId).label} — skill "${skillName}" needs review` },
        pendingAction,
      });
      this.emit(sessionId, { type: 'action.review_required', sessionId, action: pendingAction });
      this.emit(sessionId, { type: 'status.updated', sessionId, status });
      return { reviewRequired: true };
      }
    }

    switch (result.target) {
      case 'creative':
        this.streamRalphGeneration(sessionId, result.prompt, conversation, llm)
          .then(() => emitCompletion())
          .catch(handleError);
        break;
      case 'engineering':
        this.streamEngineeringTask(sessionId, result.prompt, conversation, llm)
          .then(() => emitCompletion())
          .catch(handleError);
        break;
      default:
        this.streamChatResponse(sessionId, result.prompt, conversation, llm, STUDIO_SYSTEM_PROMPT)
          .then(() => emitCompletion())
          .catch(handleError);
        break;
    }

    return { reviewRequired: false };
  }

  /**
   * Handle review commands: /accept <id>, /reject <id>, /pin <id>,
   * /diff <idA> <idB>, /candidates
   */
  private handleReviewCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0];

    if (cmd === '/candidates') {
      const candidates = this.reviewManager.list({ sessionId });
      if (candidates.length === 0) {
        this.emitCommandResponse(sessionId, 'No review candidates for this session.');
      } else {
        const lines = candidates.map(c => {
          const statusTag = c.status === 'accepted' ? ' ✓' : c.status === 'rejected' ? ' ✗' : ' …';
          return `  ${c.id.slice(0, 20).padEnd(22)} ${c.score.toFixed(2)}  ${c.label}${statusTag}`;
        });
        this.emitCommandResponse(sessionId, `Review candidates:\n${lines.join('\n')}`);
      }
      return { reviewRequired: false };
    }

    if (cmd === '/accept') {
      const candidateId = parts[1];
      if (!candidateId) {
        this.emitCommandResponse(sessionId, 'Usage: /accept <candidate-id>');
        return { reviewRequired: false };
      }
      const candidate = this.reviewManager.accept(candidateId);
      if (!candidate) {
        this.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
      } else {
        this.emit(sessionId, { type: 'review.candidate_accepted', sessionId, candidateId });
        this.emitCommandResponse(sessionId, `Accepted: ${candidate.label} (score: ${candidate.score.toFixed(2)})`);
      }
      return { reviewRequired: false };
    }

    if (cmd === '/reject') {
      const candidateId = parts[1];
      if (!candidateId) {
        this.emitCommandResponse(sessionId, 'Usage: /reject <candidate-id>');
        return { reviewRequired: false };
      }
      const candidate = this.reviewManager.reject(candidateId);
      if (!candidate) {
        this.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
      } else {
        this.emit(sessionId, { type: 'review.candidate_rejected', sessionId, candidateId });
        this.emitCommandResponse(sessionId, `Rejected: ${candidate.label}`);
      }
      return { reviewRequired: false };
    }

    if (cmd === '/pin') {
      const candidateId = parts[1];
      if (!candidateId) {
        this.emitCommandResponse(sessionId, 'Usage: /pin <candidate-id>');
        return { reviewRequired: false };
      }
      const ok = this.reviewManager.pin(candidateId);
      if (!ok) {
        this.emitCommandResponse(sessionId, `Candidate ${candidateId} not found.`);
      } else {
        this.emit(sessionId, { type: 'review.favorite_pinned', sessionId, candidateId });
        this.emitCommandResponse(sessionId, `Pinned: ${candidateId}`);
      }
      return { reviewRequired: false };
    }

    if (cmd === '/diff') {
      const idA = parts[1];
      const idB = parts[2];
      if (!idA || !idB) {
        this.emitCommandResponse(sessionId, 'Usage: /diff <candidateA-id> <candidateB-id>');
        return { reviewRequired: false };
      }
      const candA = this.reviewManager.get(idA);
      const candB = this.reviewManager.get(idB);
      if (!candA || !candB) {
        this.emitCommandResponse(sessionId, 'One or both candidates not found.');
        return { reviewRequired: false };
      }
      const result = this.diffRenderer.diff(candA.content, candB.content);
      const rendered = this.diffRenderer.render(result);
      this.emit(sessionId, { type: 'review.diff_ready', sessionId, candidateA: idA, candidateB: idB, diff: rendered });
      this.emitCommandResponse(sessionId, `Diff (${idA} vs ${idB}):\n${rendered}`);
      return { reviewRequired: false };
    }

    return { reviewRequired: false };
  }

  /**
   * Handle /setup: run the onboarding wizard with step-by-step events.
   */
  private async handleSetupCommand(sessionId: string): Promise<{ reviewRequired: boolean }> {
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Running setup wizard...' });

    // Emit each step as an onboarding.step event for TUI rendering
    const onStep = (step: { id: string; title: string; status: string; value?: string }) => {
      this.emit(sessionId, {
        type: 'onboarding.step',
        sessionId,
        stepId: step.id,
        title: step.title,
        stepStatus: step.status,
        value: step.value,
      });
    };

    const wizard = this.onboardingWizard;
    const result = await wizard.run();

    // Emit step events for each completed/failed step
    for (const step of result.steps) {
      onStep(step);
    }

    // Emit completion event
    this.emit(sessionId, {
      type: 'onboarding.complete',
      sessionId,
      configWritten: result.configWritten,
      configPath: result.configPath,
    });

    if (result.configWritten) {
      this.emitCommandResponse(sessionId, `Setup complete. Config written to ${result.configPath}`);
    } else {
      const failed = result.steps.filter(s => s.status === 'failed').map(s => s.title);
      this.emitCommandResponse(sessionId, `Setup incomplete. Issues: ${failed.join(', ')}`);
    }

    return { reviewRequired: false };
  }

  /**
   * Handle /diagnostics: run environment validation checks.
   */
  private async handleDiagnosticsCommand(sessionId: string): Promise<{ reviewRequired: boolean }> {
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Running diagnostics...' });

    const validator = this.envValidator;
    const report = await validator.validate();

    this.emit(sessionId, {
      type: 'diagnostics.result',
      sessionId,
      checks: report.checks.map(c => ({ name: c.name, status: c.status, message: c.message })),
      allPassed: report.allPassed,
    });

    const statusIcons: Record<string, string> = { pass: '✓', fail: '✗', warn: '⚠' };
    const lines = report.checks.map(c => `  ${statusIcons[c.status] || '?'} ${c.name}: ${c.message}`);
    const summary = report.allPassed ? 'All checks passed.' : 'Some checks failed or need attention.';
    this.emitCommandResponse(sessionId, `Diagnostics:\n${lines.join('\n')}\n\n${summary}`);

    return { reviewRequired: false };
  }

  /**
   * Handle /sessions: list resumable sessions.
   */
  private handleSessionsCommand(sessionId: string): { reviewRequired: boolean } {
    const sessions = this.sessionResumer.listSessions();

    this.emit(sessionId, {
      type: 'session.list',
      sessionId,
      sessions: sessions.map(s => ({
        sessionId: s.sessionId,
        turnCount: s.turnCount,
        lastIntent: s.lastIntent,
        updatedAt: s.updatedAt,
      })),
    });

    if (sessions.length === 0) {
      this.emitCommandResponse(sessionId, 'No sessions recorded yet.');
    } else {
      const lines = sessions.map(s => {
        const turns = `${s.turnCount} turns`;
        const intent = s.lastIntent ? ` — ${s.lastIntent.slice(0, 40)}` : '';
        return `  ${s.sessionId.slice(0, 24).padEnd(26)} ${turns.padEnd(10)} ${s.updatedAt.slice(0, 19)}${intent}`;
      });
      this.emitCommandResponse(sessionId, `Sessions:\n${lines.join('\n')}`);
    }

    return { reviewRequired: false };
  }

  /**
   * Handle /report [json|markdown]: generate a session report.
   */
  private handleReportCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const graph = this.sessionGraphs.get(sessionId);
    if (!graph) {
      this.emitCommandResponse(sessionId, 'No session data available for this session.');
      return { reviewRequired: false };
    }

    const format = input.endsWith('json') ? 'json' as const : 'markdown' as const;
    const report = this.reportGenerator.generate(graph, format);
    const manifest = report.manifest;

    this.emit(sessionId, {
      type: 'report.generated',
      sessionId,
      format: report.format,
      content: report.content,
      turns: manifest.turnCount,
      durationMs: report.totalDurationMs,
    });

    this.emitCommandResponse(sessionId, report.content);
    return { reviewRequired: false };
  }

  /**
   * Handle /workspace create <name>|switch <name>|list
   */
  private handleWorkspaceCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.split(/\s+/);
    const subcmd = parts[1]?.toLowerCase();

    if (subcmd === 'create') {
      const name = parts[2];
      if (!name) {
        this.emitCommandResponse(sessionId, 'Usage: /workspace create <name>');
        return { reviewRequired: false };
      }
      const config = this.workspaceManager.create(name);
      if (!config) {
        this.emitCommandResponse(sessionId, `Workspace "${name}" already exists.`);
        return { reviewRequired: false };
      }
      // Auto-switch to the new workspace
      this.workspaceManager.switchTo(name);
      this.emit(sessionId, { type: 'workspace.created', sessionId, workspaceName: name });
      this.emit(sessionId, { type: 'workspace.switched', sessionId, workspaceName: name });
      this.emitCommandResponse(sessionId, `Workspace "${name}" created and activated.`);
      return { reviewRequired: false };
    }

    if (subcmd === 'switch') {
      const name = parts[2];
      if (!name) {
        this.emitCommandResponse(sessionId, 'Usage: /workspace switch <name>');
        return { reviewRequired: false };
      }
      const config = this.workspaceManager.switchTo(name);
      if (!config) {
        this.emitCommandResponse(sessionId, `Workspace "${name}" not found.`);
        return { reviewRequired: false };
      }
      this.emit(sessionId, { type: 'workspace.switched', sessionId, workspaceName: name });
      this.emitCommandResponse(sessionId, `Switched to workspace "${name}".`);
      return { reviewRequired: false };
    }

    // Default: list workspaces
    const names = this.workspaceManager.list();
    this.emit(sessionId, { type: 'workspace.list', sessionId, workspaces: names });
    if (names.length === 0) {
      this.emitCommandResponse(sessionId, 'No workspaces. Use /workspace create <name>.');
    } else {
      const active = this.workspaceManager.activeName;
      const lines = names.map(n => {
        const marker = n === active ? ' *' : '';
        return `  ${n}${marker}`;
      });
      this.emitCommandResponse(sessionId, `Workspaces:\n${lines.join('\n')}`);
    }
    return { reviewRequired: false };
  }

  /**
   * Handle /autonomy <assist|co-create|autopilot>
   */
  private handleAutonomyCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.split(/\s+/);
    const level = parts[1]?.toLowerCase();

    if (!level) {
      // Show current level and available options
      const current = this.autonomyController.getConfig(sessionId);
      const all = this.autonomyController.listLevels();
      const lines = all.map(l => {
        const marker = l.level === current.level ? ' ← current' : '';
        return `  ${l.level.padEnd(12)} ${l.label} — ${l.description}${marker}`;
      });
      this.emitCommandResponse(sessionId, `Autonomy levels:\n${lines.join('\n')}`);
      return { reviewRequired: false };
    }

    const config = this.autonomyController.setLevel(level, sessionId);
    if (!config) {
      const available = this.autonomyController.listLevels().map(l => l.level).join(', ');
      this.emitCommandResponse(sessionId, `Unknown autonomy level. Available: ${available}`);
      return { reviewRequired: false };
    }

    this.emit(sessionId, {
      type: 'autonomy.changed',
      sessionId,
      level: config.level,
      label: config.label,
      description: config.description,
    });
    this.emitCommandResponse(sessionId, `Autonomy set to ${config.label} — ${config.description}`);
    return { reviewRequired: false };
  }

  /**
   * Lazy-initialize the GoalStore with LiminalFS.
   * Returns null if LiminalFS cannot be opened (e.g. not in a project directory).
   */
  private getGoalStore(): GoalStore | null {
    if (!this.goalStore) {
      try {
        const fs = LiminalFS.open(process.cwd());
        this.goalStore = new GoalStore(fs);
      } catch (err) {
        Logger.debug('TuiBridgeService', 'GoalStore unavailable — LiminalFS could not be opened:', err);
        return null;
      }
    }
    return this.goalStore;
  }

  /**
   * Handle /goal add <text>|list|remove <id>|done <id>
   */
  private handleGoalCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.split(/\s+/);
    const subcmd = parts[1]?.toLowerCase();

    if (subcmd === 'add') {
      const text = parts.slice(2).join(' ').trim();
      if (!text) {
        this.emitCommandResponse(sessionId, 'Usage: /goal add <text>');
        return { reviewRequired: false };
      }
      const store = this.getGoalStore();
      if (!store) {
        this.emitCommandResponse(sessionId, 'Goal store unavailable. Run from a project directory.');
        return { reviewRequired: false };
      }

      // Parse optional priority and category from text: /goal add [priority:high] [category:coverage] Fix tests
      let priority: import('../cortex/types.js').GoalPriority = 'normal';
      let category: import('../cortex/types.js').GoalCategory = 'maintenance';
      let goalText = text;

      const priorityMatch = goalText.match(/\[priority:(critical|high|normal|low)\]\s*/i);
      if (priorityMatch) {
        priority = priorityMatch[1].toLowerCase() as import('../cortex/types.js').GoalPriority;
        goalText = goalText.replace(priorityMatch[0], '').trim();
      }

      const categoryMatch = goalText.match(/\[category:(coverage|performance|reliability|feature|maintenance)\]\s*/i);
      if (categoryMatch) {
        category = categoryMatch[1].toLowerCase() as import('../cortex/types.js').GoalCategory;
        goalText = goalText.replace(categoryMatch[0], '').trim();
      }

      // Reject if goal text is empty after stripping optional tags
      if (!goalText) {
        this.emitCommandResponse(sessionId, 'Goal text is required. Usage: /goal add [priority:X] [category:Y] <text>');
        return { reviewRequired: false };
      }

      const goal = store.addGoal({ text: goalText, priority, category });
      this.emit(sessionId, { type: 'cortex.goal_added', sessionId, goal });
      this.emitCommandResponse(sessionId, `Goal added: "${goal.text}" [${goal.priority}/${goal.category}]`);
      return { reviewRequired: false };
    }

    if (subcmd === 'list') {
      const store = this.getGoalStore();
      if (!store) {
        this.emitCommandResponse(sessionId, 'Goal store unavailable. Run from a project directory.');
        return { reviewRequired: false };
      }

      const goals = store.getActiveGoals();
      this.emit(sessionId, { type: 'cortex.goal_list', sessionId, goals });
      if (goals.length === 0) {
        this.emitCommandResponse(sessionId, 'No active goals. Use /goal add <text>.');
      } else {
        const lines = goals.map(g => {
          const marker = g.priority === 'critical' ? '!!' : g.priority === 'high' ? ' !' : '  ';
          return ` ${marker} ${g.id} ${g.text}`;
        });
        this.emitCommandResponse(sessionId, `Cortex Goals (${goals.length}):\n${lines.join('\n')}`);
      }
      return { reviewRequired: false };
    }

    if (subcmd === 'remove') {
      const goalId = parts[2];
      if (!goalId) {
        this.emitCommandResponse(sessionId, 'Usage: /goal remove <id>');
        return { reviewRequired: false };
      }
      const store = this.getGoalStore();
      if (!store) {
        this.emitCommandResponse(sessionId, 'Goal store unavailable.');
        return { reviewRequired: false };
      }

      const removed = store.removeGoal(goalId);
      if (!removed) {
        this.emitCommandResponse(sessionId, `Goal "${goalId}" not found.`);
      } else {
        this.emit(sessionId, { type: 'cortex.goal_removed', sessionId, goalId });
        this.emitCommandResponse(sessionId, `Goal "${goalId}" removed.`);
      }
      return { reviewRequired: false };
    }

    if (subcmd === 'done') {
      const goalId = parts[2];
      if (!goalId) {
        this.emitCommandResponse(sessionId, 'Usage: /goal done <id>');
        return { reviewRequired: false };
      }
      const store = this.getGoalStore();
      if (!store) {
        this.emitCommandResponse(sessionId, 'Goal store unavailable.');
        return { reviewRequired: false };
      }

      const completed = store.completeGoal(goalId);
      if (!completed) {
        this.emitCommandResponse(sessionId, `Goal "${goalId}" not found.`);
      } else {
        this.emit(sessionId, { type: 'cortex.goal_completed', sessionId, goalId });
        this.emitCommandResponse(sessionId, `Goal completed: "${completed.text}"`);
      }
      return { reviewRequired: false };
    }

    // Default: show usage
    this.emitCommandResponse(sessionId, 'Usage: /goal add <text> | list | remove <id> | done <id>\nOptions: [priority:high] [category:coverage] before text');
    return { reviewRequired: false };
  }

  /**
   * Handle /cortex [start|stop]
   * Shows the Cortex dashboard, or starts/stops the background loop.
   */
  private handleCortexCommand(sessionId: string, input: string): { reviewRequired: boolean } {
    const parts = input.split(/\s+/);
    const subcmd = parts[1]?.toLowerCase();

    if (subcmd === 'start') {
      if (this.cortexLoop && !this.cortexLoop.isRunning()) {
        this.cortexLoop.start();
        this.emitCommandResponse(sessionId, 'Cortex loop started.');
      } else if (this.cortexLoop?.isRunning()) {
        this.emitCommandResponse(sessionId, 'Cortex loop is already running.');
      } else {
        this.emitCommandResponse(sessionId, 'Cortex loop not available.');
      }
      return { reviewRequired: false };
    }

    if (subcmd === 'stop') {
      if (this.cortexLoop?.isRunning()) {
        this.cortexLoop.stop();
        this.emitCommandResponse(sessionId, 'Cortex loop stopped.');
      } else {
        this.emitCommandResponse(sessionId, 'Cortex loop is not running.');
      }
      return { reviewRequired: false };
    }

    // Default: show dashboard
    const snapshot = this.cortexBus.getSnapshot();
    const goals = this.getGoalStore()?.getActiveGoals() ?? [];
    const budget = this.cortexLoop?.getBudgetUsage() ?? { actionsTaken: 0, actionsLimit: 0, tokenEstimate: 0, tokenLimit: 0 };
    const cortexState = this.cortexLoop?.getState() ?? { tickNumber: 0, decisions: [], stuckWorkers: [] };
    const explainer = new CortexExplainer();
    const dashboard = explainer.formatDashboard({
      snapshot,
      goals,
      budget,
      stuckWorkers: cortexState.stuckWorkers ?? [],
      latestDecisions: cortexState.decisions ?? [],
      tickNumber: cortexState.tickNumber ?? 0,
      autonomyLevel: TuiBridgeService.CORTEX_CONFIG.autonomyLevel,
    });

    this.emit(sessionId, {
      type: 'cortex.dashboard',
      sessionId,
      content: dashboard,
    });
    this.emitCommandResponse(sessionId, dashboard);
    return { reviewRequired: false };
  }

  /**
   * Stream a direct chat response from the LLM.
   * Uses STUDIO_SYSTEM_PROMPT for the creative-first persona.
   * No autonomy gating — direct chat is read-only.
   */
  private async streamDirectChat(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const config = llm.getConfig();
    const modelName = config.model || 'unknown';
    const provider = config.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : 'unknown';
    const startTime = Date.now();
    logBridge('direct.started', { sessionId, model: modelName, chars: userText.length });
    this.beginRun(sessionId, {
      kind: 'chat',
      label: 'Direct chat',
      model: modelName,
      provider,
    });
    this.transitionRun(sessionId, 'generating', { label: 'Streaming direct chat response' });

    try {
      // Build conversation context from history (same pattern as streamChatResponse)
      const history = conversation['sessionHistory']?.find(
        (s: { sessionId: string }) => s.sessionId === conversation['currentSession']?.id
      );
      const messages = history?.messages || [];
      let conversationContext = '';
      if (messages.length > 1) {
        const contextMessages = messages.slice(0, -1);
        conversationContext = contextMessages
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join('\n\n') + '\n\n';
      }
      const fullPrompt = conversationContext
        ? `${conversationContext}user: ${userText}`
        : userText;

      const response = await llm.generate(STUDIO_SYSTEM_PROMPT, fullPrompt, controller.signal);

      const content = response.code || response.explanation || '';
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const chunks = this.chunkString(content, 50);
      let fullContent = '';
      for (const chunk of chunks) {
        fullContent += chunk;
        this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
        await new Promise(r => setTimeout(r, 10));
      }

      this.emit(sessionId, { type: 'response.completed', sessionId, content: fullContent });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: fullContent });
      conversation['recordMessage']('assistant', fullContent);

      this.emit(sessionId, {
        type: 'response.metadata',
        sessionId,
        model: modelName,
        duration: Date.now() - startTime,
      });

      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: 'Direct chat',
          model: modelName,
        }),
      });
      this.completeRun(sessionId, { label: 'Direct chat complete', model: modelName, provider });

      logBridge('direct.completed', { sessionId, model: modelName, duration: Date.now() - startTime });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failRun(sessionId, message);
      this.emit(sessionId, this.errorEvent(sessionId, err, { provider, model: modelName, endpoint: config.baseUrl }));
      throw err;
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Stream a RalphLoop generation with telemetry events
   */
  private async streamRalphGeneration(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
    options: Pick<TuiInputRequest, 'maxIterations' | 'candidateCount' | 'timeoutMinutes' | 'creativePreferences' | 'guidanceAnswers'> = {},
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const config = llm.getConfig();
    const sessionStatus = this.sessions.get(sessionId);
    const provider = config.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : sessionStatus?.provider || 'unknown';
    const harnessModelName = sessionStatus?.roles?.harness?.model || config.model || 'unknown';
    const generatorModelName = sessionStatus?.roles?.generator?.model || harnessModelName;
    const evaluatorModelName = sessionStatus?.roles?.evaluator?.model || harnessModelName;
    const timeoutMinutes = Math.min(10, Math.max(1, Number(options.timeoutMinutes) || 3));
    const candidateCount = Math.min(3, Math.max(1, Number(options.candidateCount) || 1));
    const maxIterations = Math.min(10, Math.max(1, Number(options.maxIterations) || 5));
    const generationStartedAt = Date.now();
    const intentBrief = this.buildCreativeIntentBrief(userText);
    logBridge('generation.started', {
      sessionId,
      harnessModel: harnessModelName,
      generatorModel: generatorModelName,
      evaluatorModel: evaluatorModelName,
      chars: userText.length,
    });
    this.beginRun(sessionId, {
      kind: 'creative',
      label: 'Creative prove queued',
      executionMode: 'prove',
      model: generatorModelName,
      provider,
    });

    try {
      this.transitionRun(sessionId, 'planning', { label: 'Reading prompt and choosing creative route' });
      // Emit initial activity
      this.emit(sessionId, {
        type: 'activity.updated',
        sessionId,
        message: 'Reading prompt and extracting requirements...',
      });
      this.emitIntentBrief(sessionId, intentBrief);
      this.emitReasoningTrace(sessionId, {
        phase: 'analysis',
        thought: 'Extracted concrete requirements and missing details before spending model time.',
        detail: intentBrief.requirements.join(' | '),
        model: harnessModelName,
        source: 'harness',
      });
      this.emit(sessionId, {
        type: 'activity.updated',
        sessionId,
        message: `Intent brief: ${intentBrief.requirements.slice(0, 2).join(' | ')}`,
      });

      if (intentBrief.shouldClarify) {
        this.emitCreativeClarification(sessionId, intentBrief, conversation);
        logBridge('generation.clarification_needed', { sessionId, reason: intentBrief.reason });
        return;
      }

      const routeTruth = buildCreativeDomainRouteTruth(userText);
      const domainPlan = routeTruth.domains;
      this.emitCreativePreferenceGuidance(sessionId, userText, routeTruth.selectedDomain);
      this.emit(sessionId, {
        type: 'generation.route.selected',
        sessionId,
        domain: routeTruth.selectedDomain,
        domains: domainPlan,
        requestedDomain: routeTruth.requestedDomain,
        selectedDomain: routeTruth.selectedDomain,
        promptDomainLocked: routeTruth.promptDomainLocked,
        source: routeTruth.source,
        startedAt: new Date(generationStartedAt).toISOString(),
        timeoutMinutes,
        candidateCount,
        executionMode: 'prove',
      });
      this.emitDomainTruth(sessionId, routeTruth);
      const memoryReceipts = await this.cognitiveWriter.prepareGeneration({
        sessionId,
        userText,
        domain: routeTruth.selectedDomain,
      });
      this.emitReasoningTrace(sessionId, {
        phase: 'domain-routing',
        thought: `Routing through ${domainPlan.length} possible domain path(s): ${domainPlan.join(' -> ')}.`,
        detail: `Fast preview defaults: ${candidateCount} candidate(s), ${maxIterations} max iteration(s), ${timeoutMinutes}m per attempt.`,
        model: harnessModelName,
        source: 'harness',
      });
      this.emit(sessionId, {
        type: 'tool.started',
        sessionId,
        toolName: 'domain-router',
        displayLabel: 'Choosing creative domain route',
        argsSummary: `request="${intentBrief.userRequest.slice(0, 120)}"`,
        stepNum: 1,
      });
      this.emit(sessionId, {
        type: 'generation.domain_plan',
        sessionId,
        domains: domainPlan,
        requestedDomain: routeTruth.requestedDomain,
        selectedDomain: routeTruth.selectedDomain,
        promptDomainLocked: routeTruth.promptDomainLocked,
        source: routeTruth.source,
        startedAt: new Date(generationStartedAt).toISOString(),
        timeoutMinutes,
        candidateCount,
        executionMode: 'prove',
      });
      this.emit(sessionId, {
        type: 'generation.cognitive_receipt',
        sessionId,
        loop: 'creative',
        receipts: [
          { organ: 'perception', status: 'observed', detail: `Captured ${intentBrief.requirements.length} requirement(s) from the prompt.` },
          { organ: 'intuition', status: 'observed', detail: `Selected route ${domainPlan.join(' -> ')} from prompt and selector context.` },
          ...memoryReceipts,
          { organ: 'compost', status: 'pending', detail: 'Compost write-back will run after a candidate is generated.' },
          { organ: 'dreaming', status: 'pending', detail: 'Dream recombination is a follow-up loop, not run during this foreground generation.' },
          { organ: 'evaluation', status: 'pending', detail: 'Evaluator receipt will update after candidate generation.' },
        ],
      });
      this.emit(sessionId, {
        type: 'tool.completed',
        sessionId,
        toolName: 'domain-router',
        resultSummary: `Plan: ${domainPlan.join(' -> ')}`,
        success: true,
        stepNum: 1,
      });
      let result: Awaited<ReturnType<typeof RalphLoop.run>> | undefined;
      let activeDomain = domainPlan[0];
      let lastError: unknown;

      for (let attempt = 0; attempt < domainPlan.length; attempt++) {
        const attemptStartedAt = Date.now();
        const domain = domainPlan[attempt];
        activeDomain = domain;
        const attemptPrompt = this.promptForCreativeDomain(userText, domain, attempt > 0, intentBrief, options);
        const attemptLabel = `${attempt + 1}/${domainPlan.length}: ${domain}`;
        this.emit(sessionId, {
          type: 'generation.attempt.started',
          sessionId,
          domain,
          attempt: attempt + 1,
          attemptTotal: domainPlan.length,
          startedAt: new Date(attemptStartedAt).toISOString(),
          timeoutMinutes,
          candidateCount,
          executionMode: 'prove',
        });
        this.transitionRun(sessionId, 'generating', {
          label: `Generating ${domain} candidate`,
          model: generatorModelName,
          provider,
        });
        this.emit(sessionId, {
          type: 'activity.updated',
          sessionId,
          message: `Calling generator for attempt ${attemptLabel}; waiting for up to ${timeoutMinutes}m.`,
        });
        this.emitReasoningTrace(sessionId, {
          phase: 'generation',
          thought: `Calling ${generatorModelName} to produce ${candidateCount} ${domain} candidate(s).`,
          detail: `Attempt ${attempt + 1}/${domainPlan.length}; explicit requirements remain in the prompt.`,
          model: generatorModelName,
          source: 'harness',
        });
        this.emit(sessionId, {
          type: 'tool.started',
          sessionId,
          toolName: 'generator',
          displayLabel: `Generating ${candidateCount} ${domain} candidates`,
          argsSummary: `attempt ${attempt + 1}/${domainPlan.length}; model=${generatorModelName}`,
          stepNum: attempt + 2,
        });

        try {
          // Run RalphLoop with telemetry callbacks
          const attemptResult = await RalphLoop.run(attemptPrompt, {
            chatMode: true,
            onThought: (thought: string) => {
              this.emit(sessionId, {
                type: 'activity.updated',
                sessionId,
                message: thought,
              });
            },
            onIteration: (iterationContext) => {
              this.transitionRun(sessionId, 'evaluating', {
                label: `Evaluating iteration ${iterationContext.iteration}`,
                model: evaluatorModelName,
                provider,
              });
              this.emit(sessionId, {
                type: 'generation.candidate.generated',
                sessionId,
                domain,
                attempt: attempt + 1,
                attemptTotal: domainPlan.length,
                iteration: iterationContext.iteration,
                candidateCount,
                codeSize: iterationContext.code.length,
                duration: Date.now() - attemptStartedAt,
              });
              // Step 3: Emit generation.iteration telemetry
              this.emit(sessionId, {
                type: 'generation.iteration',
                sessionId,
                iteration: iterationContext.iteration,
                score: iterationContext.evaluation.score,
                code: iterationContext.code,
                stageTimings: iterationContext.stageTimings,
              });
              this.emitReasoningTrace(sessionId, {
                source: 'evaluator',
                phase: 'evaluation',
                thought: `Evaluator scored iteration ${iterationContext.iteration} at ${iterationContext.evaluation.score.toFixed(2)}.`,
                detail: iterationContext.evaluatorReasoning
                  ? summarizeReasoningTrace(iterationContext.evaluatorReasoning, 'evaluator').summary
                  : String(iterationContext.evaluatorRepairAdvice?.issue || `Generated ${iterationContext.code.length} bytes for ${domain}.`),
                model: evaluatorModelName,
              });
              if (iterationContext.generatorThinking) {
                const summary = summarizeReasoningTrace(iterationContext.generatorThinking, 'generator');
                this.emitReasoningTrace(sessionId, {
                  source: 'generator',
                  phase: 'generator-thinking',
                  thought: summary.summary,
                  detail: summary.details.join(' | ') || iterationContext.generatorThinking.slice(0, 600),
                  model: iterationContext.generatorModel || generatorModelName,
                });
              }
            },
            maxIterations,
            timeoutMinutes,
            collabDomain: domain,
            numCandidates: candidateCount,
            tolerateErrors: true,
            signal: controller.signal,
          });
          if (!attemptResult.code?.trim()) {
            throw new Error('Generation produced no code');
          }
          if (controller.signal.aborted) {
            this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
            return;
          }
          const mismatch = this.describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
          if (mismatch) throw new Error(mismatch);
          this.emit(sessionId, {
            type: 'tool.completed',
            sessionId,
            toolName: 'generator',
            resultSummary: `${domain} candidate accepted (${attemptResult.code.length} bytes, score ${attemptResult.finalScore.toFixed(2)})`,
            success: true,
            stepNum: attempt + 2,
          });
          result = attemptResult;
          break;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          this.emit(sessionId, {
            type: 'generation.attempt.failed',
            sessionId,
            domain,
            attempt: attempt + 1,
            attemptTotal: domainPlan.length,
            error: message,
            duration: Date.now() - attemptStartedAt,
            ...this.failureProvenance(err, { provider, model: generatorModelName }),
          });
          this.transitionRun(sessionId, 'repairing', {
            label: `Repairing after ${domain} generation failure`,
            model: generatorModelName,
            provider,
          });
          this.emit(sessionId, {
            type: 'activity.updated',
            sessionId,
            message: `Generation attempt ${attemptLabel} failed: ${message}`,
          });
          this.emit(sessionId, {
            type: 'tool.completed',
            sessionId,
            toolName: 'generator',
            resultSummary: message,
            success: false,
            stepNum: attempt + 2,
          });
          if (controller.signal.aborted) throw err;
        }
      }

      if (!result) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'All generation attempts failed'));
      }

      // Stream the final code as response deltas
      if (result.code) {
        // Split code into chunks for streaming effect
        const chunks = this.chunkString(result.code, 50);
        let fullContent = '';
        for (const chunk of chunks) {
          fullContent += chunk;
          this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
          // Small delay for streaming effect
          await new Promise(r => setTimeout(r, 10));
        }

        this.emit(sessionId, { type: 'response.completed', sessionId, content: fullContent });
        this.emit(sessionId, { type: 'response.committed', sessionId, content: fullContent });

        // Step 4: Emit generation.complete telemetry
        this.emit(sessionId, {
          type: 'generation.complete',
          sessionId,
          iterations: result.iterations,
          finalScore: result.finalScore,
          duration: result.duration,
          model: result.model || generatorModelName,
          reason: result.reason,
          qualityState: 'scored',
          executionMode: 'prove',
        });
        const writeBack = await this.cognitiveWriter.writeBackGeneration({
          sessionId,
          userText,
          domain: activeDomain,
          code: result.code,
          finalScore: result.finalScore,
          iterations: result.iterations,
          model: result.model || generatorModelName,
          reason: result.reason,
          executionMode: 'prove',
        });
        this.emit(sessionId, {
          type: 'generation.cognitive_receipt',
          sessionId,
          loop: 'creative',
          receipts: [
            { organ: 'perception', status: 'observed', detail: 'Prompt and generated artifact were captured in the session transcript.' },
            { organ: 'intuition', status: 'observed', detail: `Route completed through ${activeDomain}.` },
            { organ: 'evaluation', status: 'observed', detail: `Scored ${result.finalScore.toFixed(2)} over ${result.iterations} iteration(s).` },
            { organ: 'immune-truth', status: 'observed', detail: 'Generation used scored output and explicit preview/artifact events; no silent fallback artifact was emitted.' },
            ...writeBack.receipts,
          ],
        });

        // Step 4: Emit response.metadata for chat responses
        this.emit(sessionId, {
          type: 'response.metadata',
          sessionId,
          model: result.model || generatorModelName,
          duration: result.duration,
        });

        // Detect code in response and emit preview events for TUI
        const codeContent = this.extractCodeContent(result.code);
        if (codeContent) {
          this.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'code' });
          this.emit(sessionId, { type: 'preview.content', sessionId, content: codeContent, previewType: 'code' });
        }

        this.transitionRun(sessionId, 'rendering', {
          label: 'Rendering preview artifact',
          model: result.model || generatorModelName,
          provider,
        });
        await this.emitPreviewArtifacts(sessionId, result.code, activeDomain, routeTruth);

        // Record in conversation
        conversation['recordMessage']('assistant', `Generated code (${result.iterations} iterations, score: ${result.finalScore.toFixed(2)}):\n\n${result.code}`);

        // Create review candidate from generation result
        const candidate = this.reviewManager.addCandidate(
          sessionId,
          `gen-iter-${result.iterations}`,
          result.code,
          result.finalScore,
        );
        this.emit(sessionId, {
          type: 'review.candidate_added',
          sessionId,
          candidateId: candidate.id,
          label: candidate.label,
          score: candidate.score,
        });
      }
      logBridge('generation.completed', {
        sessionId,
        model: result.model || generatorModelName,
        iterations: result.iterations,
        score: result.finalScore,
        duration: result.duration,
      });

      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: result.reason.slice(0, 60),
          model: result.model || generatorModelName,
        }),
      });
      this.completeRun(sessionId, {
        label: 'Creative prove complete',
        model: result.model || generatorModelName,
        provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logBridge('generation.failed', { sessionId, generatorModel: generatorModelName, message });
      this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Generation failed: ${message}` });
      this.emit(sessionId, this.errorEvent(sessionId, err, { provider, model: generatorModelName, endpoint: config.baseUrl }));
      this.failRun(sessionId, message);
      throw err;
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Stream a chat response with conversation history and telemetry
   */
  private async streamDraftGeneration(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
    options: Pick<TuiInputRequest, 'maxIterations' | 'candidateCount' | 'timeoutMinutes' | 'creativePreferences' | 'guidanceAnswers'> = {},
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const config = llm.getConfig();
    const sessionStatus = this.sessions.get(sessionId);
    const provider = config.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : sessionStatus?.provider || 'unknown';
    const harnessModelName = sessionStatus?.roles?.harness?.model || config.model || 'unknown';
    const generatorModelName = sessionStatus?.roles?.generator?.model || harnessModelName;
    const timeoutMinutes = Math.min(3, Math.max(1, Number(options.timeoutMinutes) || 1));
    const candidateCount = 1;
    const generationStartedAt = Date.now();
    const intentBrief = this.buildCreativeIntentBrief(userText);
    this.beginRun(sessionId, {
      kind: 'creative',
      label: 'Creative draft queued',
      executionMode: 'draft',
      model: generatorModelName,
      provider,
    });

    try {
      this.transitionRun(sessionId, 'planning', { label: 'Reading prompt and choosing draft route' });
      this.emit(sessionId, {
        type: 'activity.updated',
        sessionId,
        message: 'Generating a first artifact before quality scoring.',
      });
      this.emitIntentBrief(sessionId, intentBrief);
      this.emitReasoningTrace(sessionId, {
        phase: 'analysis',
        thought: 'Fast generation is prioritizing the first visible artifact before quality scoring.',
        detail: intentBrief.requirements.join(' | '),
        model: harnessModelName,
        source: 'harness',
      });

      if (intentBrief.shouldClarify) {
        this.emitCreativeClarification(sessionId, intentBrief, conversation);
        return;
      }

      const routeTruth = buildCreativeDomainRouteTruth(userText);
      const domainPlan = routeTruth.domains;
      this.emitCreativePreferenceGuidance(sessionId, userText, routeTruth.selectedDomain);
      this.emit(sessionId, {
        type: 'generation.route.selected',
        sessionId,
        domain: routeTruth.selectedDomain,
        domains: domainPlan,
        requestedDomain: routeTruth.requestedDomain,
        selectedDomain: routeTruth.selectedDomain,
        promptDomainLocked: routeTruth.promptDomainLocked,
        source: routeTruth.source,
        startedAt: new Date(generationStartedAt).toISOString(),
        timeoutMinutes,
        candidateCount,
        executionMode: 'draft',
      });
      this.emitDomainTruth(sessionId, routeTruth);
      const memoryReceiptsPromise = this.cognitiveWriter.prepareGeneration({
        sessionId,
        userText,
        domain: routeTruth.selectedDomain,
      });
      this.emit(sessionId, {
        type: 'generation.domain_plan',
        sessionId,
        domains: domainPlan,
        requestedDomain: routeTruth.requestedDomain,
        selectedDomain: routeTruth.selectedDomain,
        promptDomainLocked: routeTruth.promptDomainLocked,
        source: routeTruth.source,
        startedAt: new Date(generationStartedAt).toISOString(),
        timeoutMinutes,
        candidateCount,
        executionMode: 'draft',
      });
      void memoryReceiptsPromise.then((memoryReceipts) => {
        this.emit(sessionId, {
          type: 'generation.cognitive_receipt',
          sessionId,
          loop: 'creative',
          receipts: [
            { organ: 'perception', status: 'observed', detail: `Captured ${intentBrief.requirements.length} requirement(s) from the prompt.` },
            { organ: 'intuition', status: 'observed', detail: `Generation route selected ${domainPlan.join(' -> ')}.` },
            ...memoryReceipts,
            { organ: 'evaluation', status: 'pending', detail: 'Quality scoring is deferred until the artist asks to polish.' },
          ],
        });
      });

      let result: Awaited<ReturnType<GenerationOrchestrator['generate']>> | undefined;
      let activeDomain = domainPlan[0];
      let lastError: unknown;

      for (let attempt = 0; attempt < domainPlan.length; attempt++) {
        const attemptStartedAt = Date.now();
        const domain = domainPlan[attempt];
        activeDomain = domain;
        const attemptPrompt = this.promptForCreativeDomain(userText, domain, attempt > 0, intentBrief, options);

        this.emit(sessionId, {
          type: 'generation.attempt.started',
          sessionId,
          domain,
          attempt: attempt + 1,
          attemptTotal: domainPlan.length,
          startedAt: new Date(attemptStartedAt).toISOString(),
          timeoutMinutes,
          candidateCount,
          executionMode: 'draft',
        });
        this.transitionRun(sessionId, 'generating', {
          label: `Generating ${domain} draft`,
          model: generatorModelName,
          provider,
        });
        this.emitReasoningTrace(sessionId, {
          phase: 'generation',
          thought: `Calling ${generatorModelName} for a fast ${domain} generation.`,
          detail: 'Fast generation skips evaluator scoring and repair so preview can appear immediately.',
          model: generatorModelName,
          source: 'harness',
        });

        try {
          const orchestrator = new GenerationOrchestrator(
            normalizeOptions({ collabDomain: domain }),
            new Gallery('gallery'),
            null,
          );
          const generationPromise = orchestrator.generate(attemptPrompt, attemptPrompt, true, controller.signal);
          generationPromise.catch((err) => {
            if (!controller.signal.aborted) {
              const message = err instanceof Error ? err.message : String(err);
              logBridge('generation.draft.background_failed', { sessionId, generatorModel: generatorModelName, message });
            }
          });
          let attemptResult = await this.awaitDraftAttempt(generationPromise, controller.signal, timeoutMinutes);
          if (!attemptResult) {
            this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
            return;
          }
          if (attemptResult.needsClarification) {
            const clarificationBrief: CreativeIntentBrief = {
              userRequest: intentBrief.userRequest,
              requirements: intentBrief.requirements,
              missingDetails: intentBrief.missingDetails,
              questions: attemptResult.clarifyingQuestions.map((question) => question.question),
              shouldClarify: true,
              reason: `Generation needs clarification for ${domain}.`,
            };
            this.emitCreativeClarification(sessionId, clarificationBrief, conversation);
            return;
          }
          if (!attemptResult.code?.trim()) {
            throw new Error('Generation produced no code');
          }
          if (controller.signal.aborted) {
            this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
            return;
          }
          const mismatch = this.describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
          if (mismatch) {
            this.emit(sessionId, {
              type: 'activity.updated',
              sessionId,
              message: `${mismatch}; retrying ${domain} without changing domains.`,
            });
            this.transitionRun(sessionId, 'repairing', {
              label: `Repairing ${domain} domain mismatch`,
              model: generatorModelName,
              provider,
            });
            const correctionPrompt = this.domainCorrectionPrompt(attemptPrompt, domain, mismatch);
            const retryPromise = orchestrator.generate(correctionPrompt, correctionPrompt, true, controller.signal);
            retryPromise.catch((err) => {
              if (!controller.signal.aborted) {
                const message = err instanceof Error ? err.message : String(err);
                logBridge('generation.draft.domain_retry_failed', { sessionId, generatorModel: generatorModelName, message });
              }
            });
            const retryResult = await this.awaitDraftAttempt(retryPromise, controller.signal, timeoutMinutes);
            if (!retryResult) {
              this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
              return;
            }
            if (retryResult.needsClarification) {
              attemptResult = retryResult;
            } else if (retryResult.code?.trim()) {
              attemptResult = retryResult;
            }
          }
          if (attemptResult.needsClarification) {
            const clarificationBrief: CreativeIntentBrief = {
              userRequest: intentBrief.userRequest,
              requirements: intentBrief.requirements,
              missingDetails: intentBrief.missingDetails,
              questions: attemptResult.clarifyingQuestions.map((question) => question.question),
              shouldClarify: true,
              reason: `Generation needs clarification for ${domain}.`,
            };
            this.emitCreativeClarification(sessionId, clarificationBrief, conversation);
            return;
          }
          const retryMismatch = this.describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
          if (retryMismatch) throw new Error(retryMismatch);
          if (attemptResult.thinking) {
            const summary = summarizeReasoningTrace(attemptResult.thinking, 'generator');
            this.emitReasoningTrace(sessionId, {
              source: 'generator',
              phase: 'generator-thinking',
              thought: summary.summary,
              detail: summary.details.join(' | ') || attemptResult.thinking.slice(0, 600),
              model: attemptResult.model || generatorModelName,
            });
          }
          result = attemptResult;
          break;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          this.emit(sessionId, {
            type: 'generation.attempt.failed',
            sessionId,
            domain,
            attempt: attempt + 1,
            attemptTotal: domainPlan.length,
            error: message,
            duration: Date.now() - attemptStartedAt,
            ...this.failureProvenance(err, { provider, model: generatorModelName }),
          });
          this.transitionRun(sessionId, 'repairing', {
            label: `Repairing after ${domain} draft failure`,
            model: generatorModelName,
            provider,
          });
          if (controller.signal.aborted) throw err;
        }
      }

      if (!result || result.needsClarification) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'All generation attempts failed'));
      }

      this.emit(sessionId, { type: 'response.delta', sessionId, delta: result.code });
      this.emit(sessionId, { type: 'response.completed', sessionId, content: result.code });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: result.code });
      this.emit(sessionId, {
        type: 'response.metadata',
        sessionId,
        model: result.model || generatorModelName,
        duration: Date.now() - generationStartedAt,
      });

      const codeContent = this.extractCodeContent(result.code);
      if (codeContent) {
        this.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'code' });
        this.emit(sessionId, { type: 'preview.content', sessionId, content: codeContent, previewType: 'code' });
      }

      conversation['recordMessage']('assistant', `Generated artifact ready:\n\n${result.code}`);
      this.emit(sessionId, {
        type: 'generation.complete',
        sessionId,
        iterations: 1,
        finalScore: 0,
        duration: Date.now() - generationStartedAt,
        model: result.model || generatorModelName,
        reason: 'generated artifact ready (unscored)',
        qualityState: 'unscored',
        executionMode: 'draft',
      });
      const writeBack = await this.cognitiveWriter.writeBackGeneration({
        sessionId,
        userText,
        domain: activeDomain,
        code: result.code,
        finalScore: 0,
        iterations: 1,
        model: result.model || generatorModelName,
        reason: 'generated artifact ready (unscored)',
        executionMode: 'draft',
      });
      this.emit(sessionId, {
        type: 'generation.cognitive_receipt',
        sessionId,
        loop: 'creative',
        receipts: [
          { organ: 'perception', status: 'observed', detail: 'Prompt and generated artifact were captured in the session transcript.' },
          { organ: 'intuition', status: 'observed', detail: `Generation route completed through ${activeDomain}.` },
          { organ: 'evaluation', status: 'unavailable', detail: 'Initial generation intentionally did not run evaluator scoring.' },
          { organ: 'immune-truth', status: 'observed', detail: 'Initial artifact is labeled unscored instead of presented as finished output.' },
          ...writeBack.receipts,
        ],
      });
      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: 'Generated artifact ready',
          model: result.model || generatorModelName,
        }),
      });
      this.transitionRun(sessionId, 'rendering', {
        label: 'Rendering draft preview artifact',
        model: result.model || generatorModelName,
        provider,
      });
      await this.emitPreviewArtifacts(sessionId, result.code, activeDomain, routeTruth);
      this.completeRun(sessionId, {
        label: 'Creative draft complete',
        model: result.model || generatorModelName,
        provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failRun(sessionId, message);
      throw err;
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  private async awaitDraftAttempt<T>(
    generationPromise: Promise<T>,
    signal: AbortSignal,
    timeoutMinutes: number,
  ): Promise<T | undefined> {
    if (signal.aborted) return undefined;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    const interruptPromise = new Promise<undefined>((resolve, reject) => {
      const onAbort = () => resolve(undefined);
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      timeoutId = setTimeout(() => {
        reject(new Error(`Generation timed out after ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}`));
      }, timeoutMinutes * 60_000);
    });

    try {
      return await Promise.race([generationPromise, interruptPromise]);
    } finally {
      removeAbortListener();
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Stream a chat response with conversation history and telemetry
   */
  private async streamChatResponse(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
    systemPrompt?: string,
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const startTime = Date.now();
    const config = llm.getConfig();
    const modelName = config.model || 'unknown';
    logBridge('chat.started', { sessionId, model: modelName, chars: userText.length });

    try {
      // Build conversation context from history
      const history = conversation['sessionHistory']?.find(
        (s: { sessionId: string }) => s.sessionId === conversation['currentSession']?.id
      );
      const messages = history?.messages || [];

      // Build full prompt with conversation history
      let conversationContext = '';
      if (messages.length > 1) {
        // Skip the most recent user message (that's userText)
        const contextMessages = messages.slice(0, -1);
        conversationContext = contextMessages
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join('\n\n') + '\n\n';
      }

      const fullPrompt = conversationContext
        ? `${conversationContext}user: ${userText}`
        : userText;

      let fullContent = '';
      const effectivePrompt = systemPrompt ?? TUI_SYSTEM_PROMPT;
      for await (const chunk of llm.stream(effectivePrompt, fullPrompt, controller.signal)) {
        fullContent += chunk;
        this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
      }

      const duration = Date.now() - startTime;

      this.emit(sessionId, { type: 'response.completed', sessionId, content: fullContent });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: fullContent });

      // Emit telemetry
      this.emit(sessionId, {
        type: 'response.metadata',
        sessionId,
        model: modelName,
        duration,
      });

      // Record assistant response in conversation
      conversation['recordMessage']('assistant', fullContent);

      // Detect code in response and emit preview events for TUI
      const codeContent = this.extractCodeContent(fullContent);
      if (codeContent) {
        this.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'code' });
        this.emit(sessionId, { type: 'preview.content', sessionId, content: codeContent, previewType: 'code' });
      }

      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: fullContent.slice(0, 60),
          model: modelName,
        }),
      });
      logBridge('chat.completed', { sessionId, model: modelName, duration, chars: fullContent.length });
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Stream an engineering task through the LLMModeAgent with task lifecycle events.
   */
  private async streamEngineeringTask(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const config = llm.getConfig();
    const modelName = config.model || 'unknown';
    const provider = config.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : 'unknown';
    const liveTaskDescription = this.withLiveSessionContext(sessionId, userText, config);
    const maxSteps = Number(process.env.LIMINAL_TUI_AGENT_MAX_STEPS || 20);
    const agent = createLLMModeAgent(llm);
    const taskId = `studio-eng-${Date.now()}`;

    // Emit task lifecycle events
    this.beginRun(sessionId, {
      kind: 'engineering',
      label: `Engineering task queued: ${userText.slice(0, 60)}`,
      model: modelName,
      provider,
    });
    this.transitionRun(sessionId, 'planning', { label: 'Planning engineering task' });
    this.emit(sessionId, { type: 'task.queued', sessionId, taskId, description: userText.slice(0, 120) });
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Engineering task queued: ${userText.slice(0, 60)}` });

    const listener = (event: BusEvent) => {
      if (event.source !== 'LLMModeAgent') return;
      if (event.type === EventTypes.PROCESS_START || event.type === EventTypes.PROCESS_PROGRESS) {
        const message = event.data.message || event.data.stage || 'working';
        this.emitOperatorProgress(sessionId, event);
        const stage = typeof event.data.stage === 'string' ? event.data.stage : '';
        if (stage.includes('verification') || stage.includes('runBuild') || stage.includes('runTests')) {
          this.transitionRun(sessionId, 'evaluating', { label: String(message), model: modelName, provider });
        } else if (stage.startsWith('planned ')) {
          this.transitionRun(sessionId, 'planning', { label: String(message), model: modelName, provider });
        } else if (stage.startsWith('executed ')) {
          this.transitionRun(sessionId, 'generating', { label: String(message), model: modelName, provider });
        }
        this.emit(sessionId, { type: 'activity.updated', sessionId, message: String(message) });
        this.emitLiveNarration(sessionId, String(message));
      }
      if (event.type === EventTypes.PROCESS_END) {
        const message = event.data.success ? 'Task complete' : `Task failed: ${String(event.data.reason || 'unknown')}`;
        this.emit(sessionId, { type: 'activity.updated', sessionId, message });
        this.emitLiveNarration(sessionId, message);
      }
    };

    eventBus.onEvent(listener);
    logBridge('engineering.started', { sessionId, taskId, model: modelName, maxSteps });

    try {
      this.emit(sessionId, { type: 'task.started', sessionId, taskId });
      this.transitionRun(sessionId, 'generating', { label: 'Executing engineering task', model: modelName, provider });

      const session = await agent.executeTask({
        id: taskId,
        title: `Studio engineering: ${userText.slice(0, 60)}`,
        description: liveTaskDescription,
        maxSteps,
        approved: true,
      });

      const fullContent = this.formatAgentSession(session);
      for (const chunk of this.chunkString(fullContent, 80)) {
        this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
        await new Promise(r => setTimeout(r, 5));
      }
      this.emit(sessionId, { type: 'response.completed', sessionId, content: fullContent });
      this.emit(sessionId, { type: 'response.committed', sessionId, content: fullContent });
      conversation['recordMessage']('assistant', fullContent);

      const duration = new Date(session.endTime || new Date().toISOString()).getTime() - new Date(session.startTime).getTime();
      const lifecycle = describeStatusLifecycle(session.status, session.lastPlanError);
      this.emit(sessionId, { type: 'response.metadata', sessionId, model: modelName, duration });
      this.emit(sessionId, { type: 'task.completed', sessionId, taskId, success: lifecycle.succeeded, durationMs: duration });

      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: `Engineering ${session.status}`,
          model: modelName,
        }),
      });
      if (lifecycle.succeeded) {
        this.completeRun(sessionId, {
          label: 'Engineering task complete',
          model: modelName,
          provider,
          agentStatus: session.status,
          resumable: lifecycle.resumable,
          retryable: lifecycle.retryable,
        });
      } else if (lifecycle.resumable) {
        this.suspendRun(
          sessionId,
          session.lastPlanError || `Engineering ${session.status}`,
          {
            label: 'Engineering suspended - resumable',
            lastPlanError: session.lastPlanError,
            agentStatus: session.status,
            resumable: true,
            retryable: lifecycle.retryable,
            model: modelName,
            provider,
          },
        );
      } else {
        this.failRun(
          sessionId,
          session.lastPlanError || `Engineering ${session.status}`,
          'failed',
          {
            label: `Engineering ${session.status}`,
            lastPlanError: session.lastPlanError,
            agentStatus: session.status,
            resumable: false,
            retryable: lifecycle.retryable,
            model: modelName,
            provider,
          },
        );
      }

      logBridge('engineering.completed', {
        sessionId,
        taskId,
        status: session.status,
        steps: session.stepCount,
        tools: this.agentToolsUsed(session),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failRun(sessionId, message);
      throw err;
    } finally {
      eventBus.offEvent(listener);
      this.activeStreams.delete(sessionId);
    }
  }

  private withLiveSessionContext(
    sessionId: string,
    userText: string,
    config: ReturnType<LLMClient['getConfig']>,
  ): string {
    const status = this.getStatus(sessionId);
    const runtimeProvider = config.baseUrl
      ? this.providerLabelFromBaseUrl(config.baseUrl)
      : status.provider || 'unknown';
    const runtimeModel = config.model || status.model || 'unknown';
    const lines = [
      userText,
      '',
      'Live Bubble Tea session context:',
      `- sessionId: ${sessionId}`,
      `- status.provider: ${status.provider || 'unknown'}`,
      `- status.model: ${status.model || 'unknown'}`,
      `- runtime.provider: ${runtimeProvider}`,
      `- runtime.model: ${runtimeModel}`,
      `- runtime.baseUrl: ${config.baseUrl || 'unknown'}`,
      '',
      'Treat this context as live bridge-provided evidence for the current TUI session provider/model.',
    ];
    return lines.join('\n');
  }

  private providerLabelFromBaseUrl(baseUrl: string): string {
    const label = detectProviderLabel(baseUrl);
    return label === 'llm' ? 'unknown' : label;
  }

  private buildCreativeIntentBrief(userText: string): CreativeIntentBrief {
    const userRequest = this.extractUserPrompt(userText);
    const detector = new AmbiguityDetector();
    const issues = detector.detect(userRequest);
    const words = userRequest.split(/\s+/).filter(Boolean);
    const lower = userRequest.toLowerCase();
    const hasColor = /\b(red|orange|yellow|green|blue|purple|violet|pink|white|black|gold|silver|cyan|magenta|monochrome|neon|pastel)\b/.test(lower);
    const hasMotion = /\b(dance|dancing|move|moving|rotate|spinning|pulse|breath|breathes|breathing|flow|grow|morph|animate|animated|kinetic)\b/.test(lower);
    const hasStyle = /\b(glass|metal|organic|alien|soft|hard|minimal|detailed|surreal|realistic|abstract|luminous|dark|bright|noir|retro|cyberpunk)\b/.test(lower);
    const subjectStopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'create', 'draw', 'for', 'from', 'generate',
      'in', 'into', 'make', 'of', 'on', 'or', 'sketch', 'the', 'to', 'with',
    ]);
    const vagueSubjectWords = new Set(['better', 'cooler', 'interesting', 'it', 'nice', 'nicer', 'something', 'stuff', 'that', 'things', 'this']);
    const hasNamedVisualObject = /\b(aurora|bird|boat|building|butterfly|castle|city|cloud|comet|creature|crystal|diagram|dragon|fish|flower|forest|galaxy|iceberg|icebergs|icon|island|landscape|logo|machine|moon|mountain|ocean|organism|pattern|planet|portrait|river|robot|scene|shader|ship|sky|star|stars|storm|tree|wave|waves)\b/.test(lower);
    const hasConcreteNounHint = words.some((word) => {
      const cleaned = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      return cleaned.length >= 4 && !subjectStopWords.has(cleaned) && !vagueSubjectWords.has(cleaned);
    });
    const hasSubject = hasNamedVisualObject || hasConcreteNounHint;
    const highIssues = issues.filter((issue) => (
      issue.severity === 'high' &&
      !(issue.type === 'missing_context' && (words.length >= 10 || hasSubject))
    ));
    const requirements = [
      `Primary request: ${userRequest}`,
      hasSubject ? 'Preserve the named subject and objects from the prompt.' : 'User has not named a concrete subject yet.',
      hasColor ? 'Preserve explicit color and palette cues.' : 'No explicit palette was provided.',
      hasMotion ? 'Preserve explicit motion or behavior cues.' : 'No explicit motion/behavior was provided.',
      hasStyle ? 'Preserve explicit style/material/mood cues.' : 'No explicit style/material/mood was provided.',
    ];
    const missingDetails = [
      !hasSubject ? 'subject' : '',
      !hasColor ? 'palette' : '',
      !hasMotion ? 'motion' : '',
      !hasStyle ? 'style/material' : '',
    ].filter(Boolean);
    const questions = [
      ...highIssues.map((issue) => issue.suggestedQuestion),
      !hasSubject ? 'What is the main subject or object that must be recognizable?' : '',
      !hasColor ? 'What palette or color mood should dominate?' : '',
      !hasMotion ? 'Should it be still, looping, breathing, dancing, morphing, or interactive?' : '',
      !hasStyle ? 'What material or aesthetic should it feel like?' : '',
    ].filter(Boolean).slice(0, 4);
    const shouldClarify = highIssues.length > 0 || (!hasSubject && (words.length < 3 || (!hasColor && !hasMotion && !hasStyle)));
    const reason = highIssues[0]?.description || (words.length < 3 ? 'Prompt is too short to preserve intent reliably.' : 'Prompt is missing a concrete subject.');

    return {
      userRequest,
      requirements,
      missingDetails,
      questions,
      shouldClarify,
      reason,
    };
  }

  private emitIntentBrief(sessionId: string, intentBrief: CreativeIntentBrief): void {
    this.emit(sessionId, {
      type: 'generation.intent_brief',
      sessionId,
      userRequest: intentBrief.userRequest,
      requirements: intentBrief.requirements,
      missingDetails: intentBrief.missingDetails,
      questions: intentBrief.questions,
      willClarify: intentBrief.shouldClarify,
    });
  }

  private emitReasoningTrace(
    sessionId: string,
    trace: { phase: string; thought: string; model?: string; detail?: string; source?: 'harness' | 'generator' | 'evaluator' },
  ): void {
    this.emit(sessionId, {
      type: 'generation.reasoning_trace',
      sessionId,
      ...trace,
    });
  }

  private emitCreativeClarification(
    sessionId: string,
    intentBrief: CreativeIntentBrief,
    conversation: ConversationManager,
  ): void {
    const content = [
      'I need to clarify this before generating so I do not guess wrong.',
      '',
      ...intentBrief.questions.map((question, index) => `${index + 1}. ${question}`),
    ].join('\n');
    this.emit(sessionId, {
      type: 'generation.clarification_needed',
      sessionId,
      questions: intentBrief.questions,
      reason: intentBrief.reason,
    });
    this.emit(sessionId, { type: 'response.delta', sessionId, delta: content });
    this.emit(sessionId, { type: 'response.completed', sessionId, content });
    this.emit(sessionId, { type: 'response.committed', sessionId, content });
    conversation['recordMessage']('assistant', content);
    this.emit(sessionId, {
      type: 'status.updated',
      sessionId,
      status: this.sessions.update(sessionId, {
        mode: 'chat',
        activeTask: 'Clarifying generation intent',
      }),
    });
  }

  private extractUserPrompt(userText: string): string {
    const match = userText.match(/(?:^|\n)User prompt:\s*([\s\S]+)$/i);
    return (match?.[1] ?? userText).trim();
  }

  private emitCreativePreferenceGuidance(sessionId: string, userText: string, domain: Domain | string): boolean {
    const prompt = this.extractUserPrompt(userText);
    const suggestion = createCreativePreferenceSuggestion({
      prompt,
      domain: this.toChatDomain(domain),
      techniques: [],
      constraints: [],
      references: [],
      iteration: 0,
      currentScore: 0,
    });
    if (!suggestion) return false;

    const questions = suggestion.description
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- '))
      .map(line => line.slice(2).trim())
      .filter(Boolean);

    this.emit(sessionId, {
      type: 'guidance.suggestion',
      sessionId,
      category: 'creative-preferences',
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      optional: true,
      questions,
    });
    return true;
  }

  private toChatDomain(domain: Domain | string): ChatDomain {
    const value = String(domain);
    if (value === Domain.GLSL || value === Domain.WEBGL) return 'shader';
    if (value === Domain.TONE) return 'music';
    if (value === Domain.REVIEWD || value === Domain.HYPERFRAMES) return 'revideo';
    if (['p5', 'shader', 'three', 'music', 'hydra', 'strudel', 'revideo'].includes(value)) {
      return value as ChatDomain;
    }
    return 'p5';
  }

  private promptForCreativeDomain(
    userText: string,
    domain: Domain,
    fallback: boolean,
    intentBrief?: CreativeIntentBrief,
    options: Pick<TuiInputRequest, 'creativePreferences' | 'guidanceAnswers'> = {},
  ): string {
    const prefix = fallback
      ? `Previous generation route failed. Retry the original request as ${domain}.`
      : `Target creative domain: ${domain}.`;
    const domainInstruction = domain === Domain.THREE
      ? 'Return raw Three.js scene code only. Do not return SVG, p5, prose, or markdown. Expose an audio-reactive object by reading window.__liminalAudio each animation frame; map rms/energy to scale/brightness and centroid/brightness to hue/material intensity.'
      : domain === Domain.P5
        ? 'Return raw p5.js sketch code only. Do not return any other framework, markup, prose, or markdown. Read window.__liminalAudio inside draw(); map rms/energy to scale/brightness and centroid/brightness to hue/motion.'
        : domain === Domain.GLSL || domain === Domain.SHADER || domain === Domain.WEBGL
          ? 'Return raw GLSL fragment shader code only. Do not return SVG, p5, prose, or markdown.'
          : domain === Domain.HYDRA
            ? 'Return raw Hydra video-synth code only. Do not return SVG, p5, prose, or markdown.'
            : domain === Domain.KINETIC
              ? 'Return a complete raw HTML/CSS kinetic typography artifact only. Include visible animated text or letter elements and CSS @keyframes. Do not return p5, SVG-only output, prose, or markdown.'
              : `Return raw ${domain} artifact code only. Do not return SVG unless the target domain is SVG.`;
    const briefLines = intentBrief
      ? [
          'Intent brief:',
          `- User request: ${intentBrief.userRequest}`,
          ...intentBrief.requirements.map((requirement) => `- ${requirement}`),
          intentBrief.missingDetails.length > 0
            ? `- Unknown details: ${intentBrief.missingDetails.join(', ')}. Make conservative choices, but do not ignore explicit requirements.`
            : '- Unknown details: none significant.',
        ]
      : [];
    const preferenceHints = this.buildCreativePreferenceLines(userText, domain, options);
    return [userText, '', ...briefLines, ...preferenceHints, '', prefix, domainInstruction].join('\n');
  }

  private buildCreativePreferenceLines(
    userText: string,
    domain: Domain | string,
    options: Pick<TuiInputRequest, 'creativePreferences' | 'guidanceAnswers'>,
  ): string[] {
    const answers = {
      ...this.cleanPreferenceAnswers(options.creativePreferences),
      ...this.cleanPreferenceAnswers(options.guidanceAnswers),
    };
    if (Object.keys(answers).length === 0) return [];

    const hints = buildCreativePreferencePromptHints({
      domain: this.toChatDomain(domain),
      prompt: this.extractUserPrompt(userText),
      answers,
    });
    if (hints.length === 0) return [];

    return [
      '',
      'Creative preferences (user-confirmed, optional):',
      ...hints.map(hint => `- ${hint}`),
    ];
  }

  private cleanPreferenceAnswers(answers: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
    return Object.fromEntries(
      Object.entries(answers)
        .filter(([, value]) => value != null && String(value).trim() !== ''),
    );
  }

  private describeStrictDomainMismatch(code: string, requestedDomain: Domain, domainPlan: Domain[]): string | null {
    if (domainPlan.length !== 1) return null;
    const validation = validateGeneratedDomainForRequest(code, requestedDomain);
    return validation.ok ? null : validation.message ?? 'Generated artifact did not match the requested domain';
  }

  private domainCorrectionPrompt(originalPrompt: string, requestedDomain: Domain, mismatch: string): string {
    return [
      originalPrompt,
      '',
      `Reject the previous answer: ${mismatch}.`,
      `The requested creative domain is locked to ${requestedDomain}; do not switch frameworks or languages.`,
      `Return only valid ${requestedDomain} artifact code with no prose or markdown.`,
    ].join('\n');
  }

  private inlinePreviewType(previewDomain: import('../utils/htmlWrapper.js').Domain): 'html' | 'music' | null {
    if (previewDomain === 'tone' || previewDomain === 'strudel') return 'music';
    if (previewDomain === 'hydra' || previewDomain === 'html') return 'html';
    return null;
  }

  private async emitPreviewArtifacts(
    sessionId: string,
    code: string,
    requestedDomain: Domain,
    routeTruth?: CreativeDomainRouteTruth,
  ): Promise<void> {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.join(process.cwd(), '.omx', 'proof', 'live-previews');
    const generatedDomain = detectPreviewDomainForCode(code);
    const previewDomain = previewDomainForCode(code, requestedDomain);
    const htmlPath = path.join(dir, `${previewDomain}-${safeSessionId}-${stamp}.html`);
    const pngPath = path.join(dir, `${previewDomain}-${safeSessionId}-${stamp}.png`);
    const truth = routeTruth ?? {
      requestedDomain,
      selectedDomain: requestedDomain,
      domains: [requestedDomain],
      promptDomainLocked: false,
      source: 'inferred' as const,
    };

    await fs.mkdir(dir, { recursive: true });
    const html = this.toPreviewHtml(code, previewDomain);
    await fs.writeFile(htmlPath, html, 'utf8');
    this.emitDomainTruth(sessionId, truth, {
      generatedDomain,
      previewDomain,
      artifactPath: htmlPath,
    });
    this.transitionRun(sessionId, 'rendering', {
      label: `Rendering ${previewDomain} preview`,
      artifactPath: htmlPath,
      previewType: this.inlinePreviewType(previewDomain) ?? 'image',
    });
    this.emit(sessionId, { type: 'artifact.found', sessionId, artifactLabel: `${previewDomain} HTML preview`, artifactPath: htmlPath });
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Preview artifact: ${htmlPath}` });

    const inlinePreviewType = this.inlinePreviewType(previewDomain);
    if (inlinePreviewType) {
      this.emit(sessionId, { type: 'preview.started', sessionId, previewType: inlinePreviewType });
      this.emit(sessionId, { type: 'preview.content', sessionId, content: html, previewType: inlinePreviewType });
      this.emit(sessionId, {
        type: 'preview.completed',
        sessionId,
        content: html,
        previewType: inlinePreviewType,
        artifactPath: htmlPath,
        requestedDomain,
        generatedDomain,
        previewDomain,
      });
      this.emit(sessionId, {
        type: 'preview.verified',
        sessionId,
        previewType: inlinePreviewType,
        artifactPath: htmlPath,
        checks: ['html artifact written', 'inline preview mounted without popup'],
        requestedDomain,
        generatedDomain,
        previewDomain,
      });
      this.transitionRun(sessionId, 'rendering', {
        label: `Rendered ${inlinePreviewType} preview`,
        artifactPath: htmlPath,
        previewType: inlinePreviewType,
      });
      this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Inline ${inlinePreviewType} preview mounted: ${htmlPath}` });
      return;
    }

    try {
      await this.renderHtmlScreenshot(htmlPath, pngPath, previewDomain);
      const png = await fs.readFile(pngPath);
      const b64 = png.toString('base64');
      this.emit(sessionId, { type: 'artifact.found', sessionId, artifactLabel: `${previewDomain} preview image`, artifactPath: pngPath });
      this.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'image' });
      this.emit(sessionId, { type: 'preview.content', sessionId, content: b64, previewType: 'image' });
      this.emit(sessionId, {
        type: 'preview.completed',
        sessionId,
        content: b64,
        previewType: 'image',
        imageUrl: pngPath,
        artifactPath: pngPath,
        requestedDomain,
        generatedDomain,
        previewDomain,
      });
      this.emit(sessionId, {
        type: 'preview.verified',
        sessionId,
        previewType: 'image',
        artifactPath: pngPath,
        imageUrl: pngPath,
        checks: ['html artifact written', 'screenshot rendered'],
        requestedDomain,
        generatedDomain,
        previewDomain,
      });
      this.transitionRun(sessionId, 'rendering', {
        label: 'Rendered image preview',
        artifactPath: pngPath,
        previewType: 'image',
      });
      this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Inline preview image: ${pngPath}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit(sessionId, {
        type: 'preview.missing',
        sessionId,
        previewType: 'image',
        artifactPath: htmlPath,
        reason: message,
        requestedDomain,
        generatedDomain,
        previewDomain,
      });
      this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Preview render failed: ${message}` });
      this.emit(sessionId, { type: 'error', sessionId, message: `Preview render failed: ${message}` });
    }
  }

  private toPreviewHtml(code: string, previewDomain: import('../utils/htmlWrapper.js').Domain): string {
    const trimmed = code.trim();
    if (/^(?:<!DOCTYPE\s+html|<html\b)/i.test(trimmed)) {
      if (previewDomain === 'tone') {
        return HTMLWrapper.wrap(trimmed, { domain: previewDomain, title: `Liminal ${previewDomain} Preview` });
      }
      return trimmed;
    }
    return HTMLWrapper.wrap(trimmed, { domain: previewDomain, title: `Liminal ${previewDomain} Preview` });
  }

  private async renderHtmlScreenshot(htmlPath: string, pngPath: string, previewDomain: string): Promise<void> {
    const { default: puppeteer } = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;
    try {
      page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (error: unknown) => {
        pageErrors.push(error instanceof Error ? error.message : String(error));
      });
      await page.setViewport({ width: 960, height: 640 });
      await page.goto(`file://${htmlPath}`, { waitUntil: 'load', timeout: 30000 });
      if (['p5', 'three', 'shader', 'hydra'].includes(previewDomain)) {
        await page.waitForSelector('canvas', { timeout: 10000 });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (pageErrors.length > 0) {
        throw new Error(`Preview runtime error: ${pageErrors.join(' | ')}`);
      }
      await page.screenshot({ path: pngPath, type: 'png' });
    } finally {
      if (page) await page.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }

  private emitOperatorProgress(sessionId: string, event: BusEvent): void {
    const current = typeof event.data.current === 'number' ? event.data.current : undefined;
    const total = typeof event.data.total === 'number' ? event.data.total : undefined;
    const stage = typeof event.data.stage === 'string' ? event.data.stage : '';
    const message = typeof event.data.message === 'string' ? event.data.message : stage;

    if (current != null || total != null) {
      this.emit(sessionId, {
        type: 'phase.changed',
        sessionId,
        phase: this.phaseForProcessStage(stage),
        stepCurrent: current,
        stepTotal: total,
        objective: message,
      });
    }

    if (stage.startsWith('planned ')) {
      const toolName = stage.slice('planned '.length).trim();
      if (!toolName) return;
      if (toolName === 'complete') return;
      const thought = (typeof event.data.thought === 'string' && event.data.thought)
        || message.replace(new RegExp(`^${toolName}:\\s*`), '');
      this.emit(sessionId, {
        type: 'tool.started',
        sessionId,
        toolName,
        thought,
        displayLabel: thought || toolName,
        stepNum: current,
      });
      return;
    }

    if (stage.startsWith('executed ')) {
      const toolName = stage.slice('executed '.length).trim();
      if (!toolName) return;
      const failed = /\bfailed\b/i.test(message);
      this.emit(sessionId, {
        type: 'tool.completed',
        sessionId,
        toolName,
        resultSummary: message,
        success: !failed,
        stepNum: current,
      });
    }
  }

  private phaseForProcessStage(stage: string): string {
    if (stage.includes('verification') || stage.includes('typeCheck') || stage.includes('runBuild') || stage.includes('runTests')) return 'Verify';
    if (stage.startsWith('executed ')) return 'Inspect';
    if (stage.startsWith('planned ')) return 'Plan';
    return 'Plan';
  }

  /**
   * Stream a hybrid task: creative generation followed by engineering verification.
   */
  private async streamHybridTask(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
  ): Promise<void> {
    // Phase 1: Creative generation
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Starting creative generation...' });
    await this.streamRalphGeneration(sessionId, userText, conversation, llm);

    // Phase 2: Engineering verification
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Verifying with engineering agent...' });
    await this.streamEngineeringTask(sessionId, `Verify and improve the creative output for: ${userText}`, conversation, llm);
  }

  private cancelStream(sessionId: string): void {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
    }
  }

  /** Extract code from markdown fences or detect raw code patterns */
  private extractCodeContent(content: string): string | null {
    // Try markdown fence extraction
    const fenceMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();

    // Detect raw code patterns (function declarations, const assignments)
    if (/\bfunction\s+\w+/.test(content) || /\bconst\s+\w+\s*=\s*\(.*\)\s*=>/.test(content)) {
      return content.trim();
    }

    return null;
  }

  private formatAgentSession(session: LLMSession): string {
    const lifecycle = describeStatusLifecycle(session.status, session.lastPlanError);
    const duration = session.endTime
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : Date.now() - new Date(session.startTime).getTime();
    const toolLines = session.messages
      .filter((m) => m.toolCall)
      .map((m) => {
        const mIndex = session.messages.indexOf(m);
        const result = mIndex >= 0
          ? session.messages.slice(mIndex + 1).find((candidate) => candidate.role === 'tool' && candidate.toolResult)
          : undefined;
        return `- ${m.toolCall?.tool}: ${m.toolCall?.thought}${result?.toolResult ? ` (${result.toolResult.success ? 'ok' : 'failed'})` : ''}`;
      })
      .slice(-12);
    const touchedFiles = Array.from(session.mutatedFiles);
    const filesChanged = session.status === 'rolled_back' ? [] : touchedFiles;
    const rolledBackFiles = session.status === 'rolled_back' ? touchedFiles : [];
    const testTools = new Set(['runTests', 'runFocusedTests']);
    const otherVerificationTools = new Set(['typeCheck', 'runBuild']);
    const testsRun = session.messages
      .filter((m) => m.toolCall && testTools.has(m.toolCall.tool))
      .map((m) => `- ${m.toolCall?.tool}`);
    const otherVerificationRun = session.messages
      .filter((m) => m.toolCall && otherVerificationTools.has(m.toolCall.tool))
      .map((m) => `- ${m.toolCall?.tool}`);
    const verdict = session.status === 'success'
      ? 'The engineering run completed successfully.'
      : lifecycle.resumable
        ? 'The engineering run is suspended with a checkpoint and can be resumed.'
      : session.status === 'failed' || session.status === 'rolled_back'
        ? 'The engineering run did not complete successfully.'
        : 'The engineering run completed with unresolved issues.';
    const evidence = [
      `- Task: ${session.task.title}`,
      `- Steps: ${session.stepCount}`,
      `- Duration: ${duration}ms`,
      `- Tools used: ${this.agentToolsUsed(session).join(', ') || 'none'}`,
      `- Resumable: ${lifecycle.resumable ? 'yes' : 'no'}`,
      `- Retryable provider failure: ${lifecycle.retryable ? 'yes' : 'no'}`,
    ];

    return [
      `Status: ${session.status}`,
      `Verdict:`,
      verdict,
      `Evidence:`,
      evidence.join('\n'),
      `Files changed:`,
      filesChanged.length > 0
        ? filesChanged.map((file) => `- ${file}`).join('\n')
        : rolledBackFiles.length > 0
          ? `- none (rolled back ${rolledBackFiles.length} touched file${rolledBackFiles.length === 1 ? '' : 's'})`
          : '- none',
      `Tests run:`,
      testsRun.length > 0 ? testsRun.join('\n') : '- none recorded',
      `Other verification:`,
      otherVerificationRun.length > 0 ? otherVerificationRun.join('\n') : '- none recorded',
      ...(session.lastPlanError ? [
        `Last planning failure:`,
        session.lastPlanError,
      ] : []),
      `Remaining risks:`,
      lifecycle.resumable
        ? '- Medium: checkpointed work exists; resume before starting a replacement run in the same area.'
        : session.status === 'success'
        ? '- Low: trust generated changes only after reviewing the diff and verification output.'
        : '- The run did not report full success; inspect logs and working tree changes before trusting results.',
      `Recommended next action:`,
      lifecycle.resumable
        ? '- Resume the suspended run from the checkpoint instead of restarting from scratch.'
        : session.status === 'success'
        ? '- Review the diff and merge if the changes match intent.'
        : '- Inspect the failure, rerun verification, and continue from the most relevant file.',
      '',
      `Supporting tool trace:`,
      toolLines.length > 0 ? toolLines.join('\n') : '- no tool calls recorded',
    ].join('\n');
  }

  private agentToolsUsed(session: LLMSession): string[] {
    return Array.from(new Set(
      session.messages
        .map((m) => m.toolCall?.tool)
        .filter((tool): tool is string => Boolean(tool))
    ));
  }

  /** Split string into chunks for streaming effect */
  private chunkString(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private emit(sessionId: string, event: TuiBridgeEvent): void {
    this.stream.emit(sessionId, event);
  }


  /**
   * Publish a typed operator event into a session stream.
   * Used by the Bubble Tea operator-surface tests and by future explicit
   * operator instrumentation publishers.
   */
  publishEvent<T extends TuiBridgeEvent['type']>(
    sessionId: string,
    event: Omit<Extract<TuiBridgeEvent, { type: T }>, 'sessionId'>,
  ): void {
    this.emit(sessionId, { ...event, sessionId } as TuiBridgeEvent);
  }

  private emitLiveNarration(sessionId: string, message: string): void {
    if (!message.trim()) return;
    this.emit(sessionId, {
      type: 'response.delta',
      sessionId,
      delta: `${message}\n`,
    });
  }
  /** Stop cortex broadcast timer, loop, and perception bus. Call on shutdown. */
  destroy(): void {
    if (this.gardener) {
      this.gardener.stop();
      this.gardener = null;
    }
    if (this.cortexBroadcastTimer !== null) {
      clearInterval(this.cortexBroadcastTimer);
      this.cortexBroadcastTimer = null;
    }
    if (this.cortexLoop) {
      this.cortexLoop.stop();
      this.cortexLoop = null;
    }
    this.cortexBus.stop();
  }
}
