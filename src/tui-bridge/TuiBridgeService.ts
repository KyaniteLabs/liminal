import { Logger } from '../utils/Logger.js';
import { TuiEventStream, type TuiRunEventReplay } from './TuiEventStream.js';
import { TuiSessionStore } from './TuiSessionStore.js';
import { ConversationManager } from '../chat/ConversationManager.js';
import { RalphLoop } from '../core/RalphLoop.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiBridgeEvent, TuiFailureProvenance, TuiInputRequest, TuiPendingAction, TuiRunExecutor, TuiRunKind, TuiRunLifecycle, TuiRunPhase, TuiSessionStatus } from './types.js';
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
import { SinterCortex } from '../cortex/SinterCortex.js';
import type { CortexConfig } from '../cortex/types.js';
import { AutonomousGardener, type GardenerCycleResult } from '../autonomy/AutonomousGardener.js';
import { TasteLearningService } from '../learning/TasteLearningService.js';
import { SinterFS } from '../fs/SinterFS.js';
import { resolveSinterProjectRoot } from '../fs/projectRoot.js';
import { EmergenceHooks } from '../emergence/EmergenceHooks.js';
import { BehaviorDescriptorExtractor } from '../emergence/BehaviorDescriptorExtractor.js';
import type { DescriptorAxis } from '../emergence/types.js';
import {
  buildCreativeDomainRouteTruth,
  type CreativeDomainRouteTruth,
} from './CreativeDomainRouting.js';
import { summarizeReasoningTrace } from './TraceSummarizer.js';
import { normalizeOptions } from '../core/LoopConfig.js';
import { GenerationOrchestrator } from '../core/GenerationOrchestrator.js';
import { Gallery } from '../gallery/Gallery.js';
import { PostGenerationCognitiveWriter } from './PostGenerationCognitiveWriter.js';
import { emitPreviewArtifacts, type PreviewContext } from './PreviewService.js';
import { dispatchCommand, type CommandContext } from './CommandDispatcher.js';
import {
  buildCreativeIntentBrief,
  emitIntentBrief,
  emitReasoningTrace,
  emitCreativeClarification,
  emitCreativePreferenceGuidance,
  emitPriorRunReceiptLink,
  promptForCreativeDomain,
  describeStrictDomainMismatch,
  domainCorrectionPrompt,
  type CreativeIntentBrief,
  type IntentEmitContext,
} from './CreativeIntentHelpers.js';
import { detectProviderLabel } from '../config/ProviderRuntime.js';
import { compactLLMErrorProvenance, extractLLMErrorProvenance } from '../llm/ErrorProvenance.js';
import {
  describeStatusLifecycle,
  formatStatusEvidenceLines,
  formatStatusNextAction,
  formatStatusRiskLine,
} from '../types/status.js';

export const TUI_SYSTEM_PROMPT = `You are Sinter's Meta-Harness operator interface.

Primary role:
- Help inspect, debug, repair, and improve the Sinter codebase and harness.
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


export class TuiBridgeService {
  private sessions = new TuiSessionStore();
  private stream = new TuiEventStream({ maxStoredEventsPerSession: 500 });
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
  // Cortex goal store: persists user goals via SinterFS
  private goalStore: GoalStore | null = null;
  // Cortex loop: background executive that fuses perception + goals into actions
  private cortexLoop: SinterCortex | null = null;
  // Autonomous gardener: coordinates taste learning, dream recombination, emergence cycles
  private gardener: AutonomousGardener | null = null;
  // Taste learning service: records preference events and hydrates gardener replay bias.
  private tasteLearningService: TasteLearningService | null = null;
  // Emergence hooks: reads persisted archive experience so the gardener hydrates each cycle
  private emergenceHooks: EmergenceHooks | null = null;
  // Shared SinterFS handle for session persistence/hydration; opened lazily.
  private sinterFs: SinterFS | null = null;
  // Guards one-time hydration of persisted sessions into the resumer.
  private sessionsHydrated = false;
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
        this.stream.publishEphemeral(sessionId, { type: 'cortex.snapshot', sessionId, snapshot });
      }
    }, TuiBridgeService.CORTEX_BROADCAST_INTERVAL_MS);

    // Start the Cortex background executive loop.
    // Fuses perception + goals into priority-ranked actions, emitting
    // cortex.loop_tick, cortex.decision, and cortex.action_proposed events.
    this.cortexLoop = new SinterCortex({
      perceptionBus: this.cortexBus,
      goalStore: {
        getActiveGoals: () => this.getGoalStore()?.getActiveGoals() ?? [],
      },
      config: TuiBridgeService.CORTEX_CONFIG,
      onEvent: (evt) => {
        // Broadcast cortex loop events to all active sessions
        for (const sid of this.sessions.list()) {
          this.stream.publishEphemeral(sid, {
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
    // recombination, and emergence evaluation in the background. Each cycle
    // hydrates the archive from emergence experience persisted to SinterFS by
    // prior creative runs (EmergenceHooks.onCreativeRun), so the garden
    // accumulates instead of starting cold. Empty store → [] (handled gracefully).
    this.gardener = new AutonomousGardener(TuiBridgeService.GARDENER_CONFIG);
    this.hydrateLatestTasteModel();
    void this.gardener.start(
      () => this.getEmergenceHooks()?.hydrateArchive() ?? [],   // Archive cells hydrated from SinterFS
      () => this.gardenerAxes(),   // The real 6 behavior axes (same source the CLI garden path uses)
      (result: GardenerCycleResult) => {
        for (const sid of this.sessions.list()) {
          this.stream.publishEphemeral(sid, {
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
        this.stream.publish(sessionId, {
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

    // Initialize session graph for turn persistence. Pass SinterFS so turns
    // persist to disk and survive restarts (read back by SessionResumer.hydrate).
    const graph = new SessionGraph(sessionId, this.getSinterFS() ?? undefined);
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
    return this.stream.history(sessionId);
  }

  getEventReplay(): TuiRunEventReplay {
    return this.stream;
  }

  updateStatus(sessionId: string, patch: Partial<TuiSessionStatus>): TuiSessionStatus {
    const status = this.sessions.update(sessionId, patch);
    this.emit(sessionId, { type: 'status.updated', sessionId, status });
    return status;
  }

  private publishResolvedGeneratorModel(
    sessionId: string,
    provider: string,
    baseUrl: string,
    model: string,
  ): void {
    const status = this.sessions.get(sessionId);
    if (!status) return;
    const roles = status.roles ? { ...status.roles } : undefined;
    if (roles?.generator) {
      roles.generator = { ...roles.generator, provider, baseUrl, model };
    }
    if (roles?.harness) {
      roles.harness = { ...roles.harness, provider, baseUrl, model };
    }
    this.updateStatus(sessionId, { provider, model, roles });
  }

  private beginRun(
    sessionId: string,
    details: {
      kind: TuiRunKind;
      label: string;
      executionMode?: 'draft' | 'prove';
      executor?: TuiRunExecutor;
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
      executor: details.executor,
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

    // Slash-command dispatch (extracted to CommandDispatcher)
    const commandResult = await dispatchCommand(this.commandCtx, sessionId, input.text, llm);
    if (commandResult) return commandResult;
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
    conversation.appendMessage('user', input.text);

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

    const emitSessionTurn = (delegatedTo: string, responseContent?: string, extras?: { executor?: TuiRunExecutor; artifactRefs?: string[]; taskRefs?: string[] }) => {
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
      conversation.appendMessage('assistant', input.text);
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
        const intentBrief = buildCreativeIntentBrief(input.text);
        emitIntentBrief(this.intentCtx, sessionId, intentBrief);
        emitReasoningTrace(this.intentCtx, sessionId, {
          phase: 'analysis',
          thought: intentBrief.shouldClarify
            ? 'Prompt is underspecified; asking for missing requirements before generation.'
            : 'Prompt has enough concrete intent to prepare generation.',
          detail: intentBrief.requirements.join(' | '),
          source: 'harness',
        });
        if (intentBrief.shouldClarify) {
          emitCreativeClarification(this.intentCtx, sessionId, intentBrief, conversation);
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
          .then(() => emitSessionTurn('engineering-agent', undefined, { executor: 'llm-mode-agent' }))
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
          delegatedTo: route === 'creative' || route === 'hybrid' ? 'ralph-loop' : 'engineering-agent',
          executor: route === 'creative' || route === 'hybrid' ? 'ralph-loop' : 'llm-mode-agent',
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
   * Lazy-initialize the GoalStore with SinterFS.
   * Returns null if SinterFS cannot be opened (e.g. not in a project directory).
   */
  private getGoalStore(): GoalStore | null {
    if (!this.goalStore) {
      try {
        const fs = SinterFS.open(resolveSinterProjectRoot());
        this.goalStore = new GoalStore(fs);
      } catch (err) {
        Logger.debug('TuiBridgeService', 'GoalStore unavailable — SinterFS could not be opened:', err);
        return null;
      }
    }
    return this.goalStore;
  }

  /**
   * Lazy-initialize EmergenceHooks with SinterFS so the gardener can hydrate the
   * archive from persisted emergence experience each cycle.
   * Returns null if SinterFS cannot be opened (e.g. not in a project directory).
   */
  private getEmergenceHooks(): EmergenceHooks | null {
    if (!this.emergenceHooks) {
      try {
        const fs = SinterFS.open(resolveSinterProjectRoot());
        this.emergenceHooks = new EmergenceHooks(fs);
      } catch (err) {
        Logger.debug('TuiBridgeService', 'EmergenceHooks unavailable — SinterFS could not be opened:', err);
        return null;
      }
    }
    return this.emergenceHooks;
  }

  /**
   * The descriptor axes the background gardener searches over. Sources the real
   * 6 behavior axes from the same canonical place the rest of the system uses
   * (BehaviorDescriptorExtractor's defaults, derived from the DescriptorAxis
   * union) — matching the CLI `garden` path, which passes the identical 6 axes.
   * Without this the GUI gardener would run dream/novelty over a null (empty)
   * descriptor space.
   */
  private gardenerAxes(): DescriptorAxis[] {
    return new BehaviorDescriptorExtractor().getAvailableAxes();
  }

  /**
   * Lazily open a shared SinterFS handle (session persistence + hydration).
   * Returns null if SinterFS cannot be opened (e.g. not in a project directory),
   * in which case sessions degrade to memory-only.
   */
  private getSinterFS(): SinterFS | null {
    if (!this.sinterFs) {
      try {
        this.sinterFs = SinterFS.open(resolveSinterProjectRoot());
      } catch (err) {
        Logger.debug('TuiBridgeService', 'SinterFS unavailable — sessions are memory-only:', err);
        return null;
      }
    }
    return this.sinterFs;
  }

  /**
   * Lazily initialize taste learning against the same project-local SinterFS
   * handle used by session and archive persistence.
   */
  private getTasteLearningService(): TasteLearningService | null {
    if (!this.tasteLearningService) {
      const fs = this.getSinterFS();
      if (!fs) return null;
      this.tasteLearningService = new TasteLearningService(fs);
    }
    return this.tasteLearningService;
  }

  private hydrateLatestTasteModel(): boolean {
    const service = this.getTasteLearningService();
    if (!service || !this.gardener) return false;
    try {
      const weights = service.loadLatestModel();
      if (!weights) return false;
      this.gardener.loadTasteModel(weights);
      return true;
    } catch (err) {
      Logger.debug('TuiBridgeService', 'Taste model hydration unavailable:', err);
      return false;
    }
  }

  private async recordReviewPreference(
    sessionId: string,
    action: 'pin' | 'reject',
    artifactId: string,
  ): Promise<boolean> {
    const service = this.getTasteLearningService();
    if (!service) return false;

    try {
      await service.recordPreference({ action, artifactId, sessionId });
      const summary = await service.trainFromProject();
      if (summary.weights && this.gardener) {
        this.gardener.loadTasteModel(summary.weights);
      }
      return true;
    } catch (err) {
      Logger.warn('TuiBridgeService', `Preference ${action} persistence failed for ${artifactId}:`, err);
      return false;
    }
  }

  /**
   * Hydrate sessions persisted by prior processes into the resumer, once, so
   * `/sessions` accumulates across restarts. Safe no-op if SinterFS is
   * unavailable or already hydrated.
   */
  private ensureSessionsHydrated(): void {
    if (this.sessionsHydrated) return;
    this.sessionsHydrated = true;
    const fs = this.getSinterFS();
    if (!fs) return;
    try {
      const loaded = this.sessionResumer.hydrate(fs);
      if (loaded > 0) {
        Logger.debug('TuiBridgeService', `Hydrated ${loaded} persisted session(s) from SinterFS.`);
      }
    } catch (err) {
      Logger.debug('TuiBridgeService', 'Session hydration failed:', err);
    }
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
      const conversationContext = conversation.getConversationContext({ excludeLatest: true });
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
      conversation.appendMessage('assistant', fullContent);

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
    const intentBrief = buildCreativeIntentBrief(userText);
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
      emitIntentBrief(this.intentCtx, sessionId, intentBrief);
      emitReasoningTrace(this.intentCtx, sessionId, {
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
        emitCreativeClarification(this.intentCtx, sessionId, intentBrief, conversation);
        logBridge('generation.clarification_needed', { sessionId, reason: intentBrief.reason });
        return;
      }

      const routeTruth = buildCreativeDomainRouteTruth(userText);
      const domainPlan = routeTruth.domains;
      emitCreativePreferenceGuidance(this.intentCtx, sessionId, userText, routeTruth.selectedDomain);
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
      emitPriorRunReceiptLink(this.intentCtx, sessionId, options);
      const memoryReceiptsPromise = this.cognitiveWriter.prepareGeneration({
        sessionId,
        userText,
        domain: routeTruth.selectedDomain,
      });
      void memoryReceiptsPromise.then((memoryReceipts) => {
        this.emit(sessionId, {
          type: 'generation.cognitive_receipt',
          sessionId,
          loop: 'creative',
          receipts: memoryReceipts,
        });
      });
      emitReasoningTrace(this.intentCtx, sessionId, {
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
          { organ: 'memory', status: 'pending', detail: 'Memory retrieval is running in the background and will not block generation.' },
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
        const attemptPrompt = promptForCreativeDomain(userText, domain, attempt > 0, intentBrief, options);
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
        emitReasoningTrace(this.intentCtx, sessionId, {
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
              emitReasoningTrace(this.intentCtx, sessionId, {
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
                emitReasoningTrace(this.intentCtx, sessionId, {
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
          const mismatch = describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
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
        await emitPreviewArtifacts(this.previewCtx, sessionId, result.code, activeDomain, routeTruth);

        // Record in conversation
        conversation.appendMessage('assistant', `Generated code (${result.iterations} iterations, score: ${result.finalScore.toFixed(2)}):\n\n${result.code}`);

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

    let config = llm.getConfig();
    const sessionStatus = this.sessions.get(sessionId);
    let effectiveModel = sessionStatus?.roles?.generator?.model || config.model || 'unknown';
    let resolvedEffectiveModel = false;
    const resolver = (llm as LLMClient & { resolveEffectiveModel?: () => Promise<string> }).resolveEffectiveModel;
    if (typeof resolver === 'function') {
      try {
        effectiveModel = await resolver.call(llm);
        config = llm.getConfig();
        resolvedEffectiveModel = true;
      } catch (err) {
        Logger.info('TuiBridgeService', `Effective model preflight failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const provider = config.baseUrl ? this.providerLabelFromBaseUrl(config.baseUrl) : sessionStatus?.provider || 'unknown';
    if (resolvedEffectiveModel) {
      this.publishResolvedGeneratorModel(sessionId, provider, config.baseUrl, effectiveModel);
    }
    const harnessModelName = resolvedEffectiveModel
      ? effectiveModel
      : sessionStatus?.roles?.harness?.model || config.model || 'unknown';
    const generatorModelName = resolvedEffectiveModel
      ? effectiveModel
      : sessionStatus?.roles?.generator?.model || harnessModelName;
    // Studio owns the operator-visible timeout; the bridge only bounds it so draft runs cannot hang forever.
    const timeoutMinutes = Math.min(30, Math.max(1, Number(options.timeoutMinutes) || 1));
    const candidateCount = 1;
    const generationStartedAt = Date.now();
    const intentBrief = buildCreativeIntentBrief(userText);
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
      emitIntentBrief(this.intentCtx, sessionId, intentBrief);
      emitReasoningTrace(this.intentCtx, sessionId, {
        phase: 'analysis',
        thought: 'Fast generation is prioritizing the first visible artifact before quality scoring.',
        detail: intentBrief.requirements.join(' | '),
        model: harnessModelName,
        source: 'harness',
      });

      if (intentBrief.shouldClarify) {
        emitCreativeClarification(this.intentCtx, sessionId, intentBrief, conversation);
        return;
      }

      const routeTruth = buildCreativeDomainRouteTruth(userText);
      const domainPlan = routeTruth.domains;
      emitCreativePreferenceGuidance(this.intentCtx, sessionId, userText, routeTruth.selectedDomain);
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
      emitPriorRunReceiptLink(this.intentCtx, sessionId, options);
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
        const attemptPrompt = promptForCreativeDomain(userText, domain, attempt > 0, intentBrief, options);

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
        emitReasoningTrace(this.intentCtx, sessionId, {
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
          const attemptController = new AbortController();
          const unlinkAttemptAbort = this.linkDraftAttemptToRun(controller.signal, attemptController);
          const generationPromise = orchestrator.generate(attemptPrompt, attemptPrompt, true, attemptController.signal);
          generationPromise.catch((err) => {
            if (!attemptController.signal.aborted) {
              const message = err instanceof Error ? err.message : String(err);
              logBridge('generation.draft.background_failed', { sessionId, generatorModel: generatorModelName, message });
            }
          });
          let attemptResult: Awaited<ReturnType<GenerationOrchestrator['generate']>> | undefined;
          try {
            attemptResult = await this.awaitDraftAttempt(generationPromise, controller, attemptController, timeoutMinutes);
          } finally {
            unlinkAttemptAbort();
          }
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
            emitCreativeClarification(this.intentCtx, sessionId, clarificationBrief, conversation);
            return;
          }
          if (!attemptResult.code?.trim()) {
            throw new Error('Generation produced no code');
          }
          if (controller.signal.aborted) {
            this.emit(sessionId, { type: 'activity.updated', sessionId, message: 'Generation stopped by operator.' });
            return;
          }
          const mismatch = describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
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
            const correctionPrompt = domainCorrectionPrompt(attemptPrompt, domain, mismatch);
            const retryController = new AbortController();
            const unlinkRetryAbort = this.linkDraftAttemptToRun(controller.signal, retryController);
            const retryPromise = orchestrator.generate(correctionPrompt, correctionPrompt, true, retryController.signal);
            retryPromise.catch((err) => {
              if (!retryController.signal.aborted) {
                const message = err instanceof Error ? err.message : String(err);
                logBridge('generation.draft.domain_retry_failed', { sessionId, generatorModel: generatorModelName, message });
              }
            });
            let retryResult: Awaited<ReturnType<GenerationOrchestrator['generate']>> | undefined;
            try {
              retryResult = await this.awaitDraftAttempt(retryPromise, controller, retryController, timeoutMinutes);
            } finally {
              unlinkRetryAbort();
            }
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
            emitCreativeClarification(this.intentCtx, sessionId, clarificationBrief, conversation);
            return;
          }
          const retryMismatch = describeStrictDomainMismatch(attemptResult.code, domain, domainPlan);
          if (retryMismatch) throw new Error(retryMismatch);
          if (attemptResult.thinking) {
            const summary = summarizeReasoningTrace(attemptResult.thinking, 'generator');
            emitReasoningTrace(this.intentCtx, sessionId, {
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
          const nextDomain = domainPlan[attempt + 1];
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
          this.emit(sessionId, {
            type: 'activity.updated',
            sessionId,
            message: nextDomain
              ? `${domain} did not finish: ${message}. Trying ${nextDomain} next.`
              : `${domain} did not finish: ${message}. No backup medium completed, so recovery choices are available.`,
          });
          this.transitionRun(sessionId, 'repairing', {
            label: nextDomain ? `Trying ${nextDomain} after ${domain} draft failure` : `Recovery needed after ${domain} draft failure`,
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

      conversation.appendMessage('assistant', `Generated artifact ready:\n\n${result.code}`);
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
      await emitPreviewArtifacts(this.previewCtx, sessionId, result.code, activeDomain, routeTruth);
      this.completeRun(sessionId, {
        label: 'Creative draft complete',
        model: result.model || generatorModelName,
        provider,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const provenance = this.failureProvenance(err, { provider, model: generatorModelName, endpoint: config.baseUrl });
      this.emit(sessionId, {
        type: 'activity.updated',
        sessionId,
        message: `Generation stopped before a usable artifact: ${message}. Try again, polish safely, or switch medium.`,
      });
      this.failRun(sessionId, message, 'failed', {
        label: 'Creative draft needs recovery',
        model: generatorModelName,
        provider,
        ...(typeof provenance.retryable === 'boolean' ? { retryable: provenance.retryable } : {}),
      });
      throw err;
    } finally {
      this.activeStreams.delete(sessionId);
    }
  }

  private async awaitDraftAttempt<T>(
    generationPromise: Promise<T>,
    runController: AbortController,
    attemptController: AbortController,
    timeoutMinutes: number,
  ): Promise<T | undefined> {
    const runSignal = runController.signal;
    if (runSignal.aborted) return undefined;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener = () => {};
    const interruptPromise = new Promise<undefined>((resolve, reject) => {
      const onAbort = () => resolve(undefined);
      runSignal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () => runSignal.removeEventListener('abort', onAbort);
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Generation timed out after ${timeoutMinutes} minute${timeoutMinutes === 1 ? '' : 's'}`);
        attemptController.abort(timeoutError);
        reject(timeoutError);
        // Attempt timeouts fail only this candidate. Stop still uses the run
        // controller, while this abort prevents stale local model calls from
        // occupying the provider after the UI has moved to recovery/fallback.
      }, timeoutMinutes * 60_000);
    });

    try {
      return await Promise.race([generationPromise, interruptPromise]);
    } finally {
      removeAbortListener();
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private linkDraftAttemptToRun(runSignal: AbortSignal, attemptController: AbortController): () => void {
    if (runSignal.aborted) {
      attemptController.abort(runSignal.reason);
      return () => {};
    }
    const onAbort = () => attemptController.abort(runSignal.reason);
    runSignal.addEventListener('abort', onAbort, { once: true });
    return () => runSignal.removeEventListener('abort', onAbort);
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
      const conversationContext = conversation.getConversationContext({ excludeLatest: true });

      const fullPrompt = conversationContext
        ? `${conversationContext}user: ${userText}`
        : userText;

      let fullContent = '';
      const effectivePrompt = systemPrompt ?? TUI_SYSTEM_PROMPT;
      for await (const chunk of llm.stream(effectivePrompt, fullPrompt, controller.signal)) {
        fullContent += chunk;
        this.emit(sessionId, { type: 'response.delta', sessionId, delta: chunk });
      }
      if (!fullContent.trim()) {
        throw new Error('Empty response from LLM stream');
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
      conversation.appendMessage('assistant', fullContent);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit(sessionId, this.errorEvent(sessionId, err, { model: modelName, endpoint: config.baseUrl }));
      logBridge('chat.failed', { sessionId, model: modelName, error: message });
      throw err;
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
      executor: 'llm-mode-agent',
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
      conversation.appendMessage('assistant', fullContent);

      const duration = new Date(session.endTime || new Date().toISOString()).getTime() - new Date(session.startTime).getTime();
      const lifecycle = describeStatusLifecycle(session.status, session.lastPlanError, {
        lastVerification: session.lastVerification,
        mutatedFiles: Array.from(session.mutatedFiles),
      });
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
          nextAction: lifecycle.nextAction,
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
            nextAction: lifecycle.nextAction,
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
            nextAction: lifecycle.nextAction,
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
    const lifecycle = describeStatusLifecycle(session.status, session.lastPlanError, {
      lastVerification: session.lastVerification,
      mutatedFiles: Array.from(session.mutatedFiles),
    });
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
      ...formatStatusEvidenceLines(lifecycle),
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
      formatStatusRiskLine(lifecycle),
      `Recommended next action:`,
      session.status === 'success'
        ? '- Review the diff and merge if the changes match intent.'
        : `- ${formatStatusNextAction(lifecycle.nextAction)}`,
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

  /** Context adapter for PreviewService (F20 extraction). */
  private get previewCtx(): PreviewContext {
    return {
      emit: (sid: string, ev: TuiBridgeEvent) => this.emit(sid, ev),
      emitDomainTruth: (sid: string, route: CreativeDomainRouteTruth, patch: { generatedDomain?: string; previewDomain?: string; artifactPath?: string }) =>
        this.emitDomainTruth(sid, route, patch),
      transitionRun: (sid: string, phase: TuiRunPhase, patch?: Partial<Omit<TuiRunLifecycle, 'runId' | 'kind' | 'startedAt'>>) =>
        this.transitionRun(sid, phase, patch),
    };
  }

  /** Context adapter for CommandDispatcher (F20 extraction). */
  private get commandCtx(): CommandContext {
    return {
      emit: (sid: string, ev: TuiBridgeEvent) => this.emit(sid, ev),
      emitCommandResponse: (sid: string, content: string) => this.emitCommandResponse(sid, content),
      skillRunner: this.skillRunner,
      skillCatalog: this.skillCatalog,
      reviewManager: this.reviewManager,
      diffRenderer: this.diffRenderer,
      onboardingWizard: this.onboardingWizard,
      envValidator: this.envValidator,
      sessionResumer: this.sessionResumer,
      reportGenerator: this.reportGenerator,
      workspaceManager: this.workspaceManager,
      autonomyController: this.autonomyController,
      modeRegistry: this.modeRegistry,
      conversations: this.conversations,
      sessionGraphs: this.sessionGraphs,
      sessions: this.sessions,
      cortexLoop: this.cortexLoop,
      cortexBus: this.cortexBus,
      setProductMode: (sid: string, mode: ProductMode) => this.setProductMode(sid, mode),
      ensureSessionsHydrated: () => this.ensureSessionsHydrated(),
      recordReviewPreference: (sid: string, action: 'pin' | 'reject', artifactId: string) =>
        this.recordReviewPreference(sid, action, artifactId),
      getGoalStore: () => this.getGoalStore(),
      streamRalphGeneration: (sid: string, text: string, conv: ConversationManager, llm: LLMClient, opts?: Pick<TuiInputRequest, 'maxIterations' | 'candidateCount' | 'timeoutMinutes' | 'creativePreferences' | 'guidanceAnswers'>) =>
        this.streamRalphGeneration(sid, text, conv, llm, opts),
      streamEngineeringTask: (sid: string, text: string, conv: ConversationManager, llm: LLMClient) =>
        this.streamEngineeringTask(sid, text, conv, llm),
      streamChatResponse: (sid: string, text: string, conv: ConversationManager, llm: LLMClient, sp?: string) =>
        this.streamChatResponse(sid, text, conv, llm, sp),
      cortexConfig: TuiBridgeService.CORTEX_CONFIG,
    };
  }

  /** Context adapter for CreativeIntentHelpers (F20 extraction). */
  private get intentCtx(): IntentEmitContext {
    return {
      emit: (sid: string, ev: TuiBridgeEvent) => this.emit(sid, ev),
      updateSession: (sid: string, patch: Partial<TuiSessionStatus>) =>
        this.sessions.update(sid, patch),
    };
  }
  private emit(sessionId: string, event: TuiBridgeEvent): void {
    this.stream.publish(sessionId, event);
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
