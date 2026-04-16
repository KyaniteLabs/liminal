import { Logger } from '../utils/Logger.js';
import { TuiEventStream } from './TuiEventStream.js';
import { TuiSessionStore } from './TuiSessionStore.js';
import { ConversationManager } from '../chat/ConversationManager.js';
import { RalphLoop } from '../core/RalphLoop.js';
import type { LLMClient } from '../llm/LLMClient.js';
import type { TuiBridgeEvent, TuiInputRequest, TuiPendingAction, TuiSessionStatus } from './types.js';
import { Domain } from '../types/domains.js';
import { eventBus, EventTypes, type BusEvent } from '../core/EventBus.js';
import { createLLMModeAgent, type LLMSession } from '../harness/agent/index.js';
import { IntentRouter } from '../agent/IntentRouter.js';
import { STUDIO_SYSTEM_PROMPT } from '../agent/StudioAgent.js';
import { SessionGraph } from '../agent/SessionGraph.js';

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

/** Check if input indicates repo/harness repair rather than creative generation. */
export function isSelfImprovementRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return SELF_IMPROVEMENT_KEYWORDS.some(kw => lower.includes(kw));
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
  private stream = new TuiEventStream();
  private activeStreams = new Map<string, AbortController>();
  // Step 1: Conversation memory - one ConversationManager per session
  private conversations = new Map<string, ConversationManager>();
  // Studio routing: intelligent intent classification replaces keyword matching
  private router = new IntentRouter();
  // Session persistence: records every turn per session
  private sessionGraphs = new Map<string, SessionGraph>();

  constructor() {
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

  createSession(patch: Partial<Pick<TuiSessionStatus, 'provider' | 'model'>> = {}): TuiSessionStatus {
    const sessionId = `tui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Initialize conversation manager for this session
    const conversation = new ConversationManager();
    conversation.startNewSession();
    this.conversations.set(sessionId, conversation);

    // Initialize session graph for turn persistence
    this.sessionGraphs.set(sessionId, new SessionGraph(sessionId));

    return this.sessions.create({
      sessionId,
      mode: 'chat',
      provider: patch.provider,
      model: patch.model,
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

  emitCommandResponse(sessionId: string, content: string): void {
    this.emit(sessionId, { type: 'response.started', sessionId });
    this.emit(sessionId, { type: 'response.delta', sessionId, delta: content });
    this.emit(sessionId, { type: 'response.completed', sessionId, content });
    this.emit(sessionId, { type: 'response.committed', sessionId, content });
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

    // Studio routing: classify intent via IntentRouter
    const classification = this.router.classify(input.text);

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
      this.emit(sessionId, {
        type: 'error',
        sessionId,
        message: err instanceof Error ? err.message : String(err),
      });
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
    switch (classification.intent) {
      case 'creative':
        logBridge('input.routed', { sessionId, route: 'studio.creative', confidence: classification.confidence });
        this.streamRalphGeneration(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('ralph-loop'))
          .catch(handleError);
        break;

      case 'engineering':
        logBridge('input.routed', { sessionId, route: 'studio.engineering', confidence: classification.confidence });
        this.streamEngineeringTask(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('conveyor'))
          .catch(handleError);
        break;

      case 'hybrid':
        logBridge('input.routed', { sessionId, route: 'studio.hybrid', confidence: classification.confidence });
        this.streamHybridTask(sessionId, input.text, conversation, llm)
          .then(() => emitSessionTurn('ralph-loop'))
          .catch(handleError);
        break;

      case 'direct':
      default:
        logBridge('input.routed', { sessionId, route: 'studio.chat', confidence: classification.confidence });
        this.streamChatResponse(sessionId, input.text, conversation, llm, STUDIO_SYSTEM_PROMPT)
          .then(() => emitSessionTurn('llm-chat'))
          .catch(handleError);
        break;
    }

    return { reviewRequired: false };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async confirmAction(sessionId: string, actionId: string): Promise<void> {
    const status = this.getStatus(sessionId);
    if (!status.pendingAction || status.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    this.sessions.update(sessionId, {
      mode: 'confirm',
      pendingAction: undefined,
      trust: { level: 'confirmed', label: 'Operator confirmed mutation' },
    });
    this.emit(sessionId, { type: 'action.confirmed', sessionId, actionId });
  }

  cancelAction(sessionId: string, actionId: string): void {
    const status = this.getStatus(sessionId);
    if (!status.pendingAction || status.pendingAction.id !== actionId) {
      throw new Error(`Pending action ${actionId} not found`);
    }
    this.sessions.update(sessionId, {
      mode: 'chat',
      pendingAction: undefined,
      trust: { level: 'untrusted', label: 'Generated code is untrusted by default' },
    });
    this.emit(sessionId, { type: 'action.cancelled', sessionId, actionId });
  }

  /**
   * Stream a RalphLoop generation with telemetry events
   */
  private async streamRalphGeneration(
    sessionId: string,
    userText: string,
    conversation: ConversationManager,
    llm: LLMClient,
  ): Promise<void> {
    const controller = new AbortController();
    this.activeStreams.set(sessionId, controller);

    const config = llm.getConfig();
    const modelName = config.model || 'unknown';
    logBridge('generation.started', { sessionId, model: modelName, chars: userText.length });

    try {
      // Emit initial activity
      this.emit(sessionId, {
        type: 'activity.updated',
        sessionId,
        message: 'Starting generation...',
      });

      // Run RalphLoop with telemetry callbacks
      const result = await RalphLoop.run(userText, {
        chatMode: true,
        onThought: (thought: string) => {
          this.emit(sessionId, {
            type: 'activity.updated',
            sessionId,
            message: thought,
          });
        },
        onIteration: (iterationContext) => {
          // Step 3: Emit generation.iteration telemetry
          this.emit(sessionId, {
            type: 'generation.iteration',
            sessionId,
            iteration: iterationContext.iteration,
            score: iterationContext.evaluation.score,
            code: iterationContext.code,
          });
        },
        maxIterations: 10,
        timeoutMinutes: 5,
        collabDomain: Domain.P5,
        signal: controller.signal,
      });

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
          model: result.model || modelName,
          reason: result.reason,
        });

        // Step 4: Emit response.metadata for chat responses
        this.emit(sessionId, {
          type: 'response.metadata',
          sessionId,
          model: result.model || modelName,
          duration: result.duration,
        });

        // Detect code in response and emit preview events for TUI
        const codeContent = this.extractCodeContent(result.code);
        if (codeContent) {
          this.emit(sessionId, { type: 'preview.started', sessionId, previewType: 'code' });
          this.emit(sessionId, { type: 'preview.content', sessionId, content: codeContent, previewType: 'code' });
          this.emit(sessionId, { type: 'preview.completed', sessionId, content: codeContent, previewType: 'code' });
        }

        // Record in conversation
        conversation['recordMessage']('assistant', `Generated code (${result.iterations} iterations, score: ${result.finalScore.toFixed(2)}):\n\n${result.code}`);
      }
      logBridge('generation.completed', {
        sessionId,
        model: result.model || modelName,
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
          model: result.model || modelName,
        }),
      });
    } finally {
      this.activeStreams.delete(sessionId);
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
        this.emit(sessionId, { type: 'preview.completed', sessionId, content: codeContent, previewType: 'code' });
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
    const maxSteps = Number(process.env.LIMINAL_TUI_AGENT_MAX_STEPS || 20);
    const agent = createLLMModeAgent(llm);
    const taskId = `studio-eng-${Date.now()}`;

    // Emit task lifecycle events
    this.emit(sessionId, { type: 'task.queued', sessionId, taskId, description: userText.slice(0, 120) });
    this.emit(sessionId, { type: 'activity.updated', sessionId, message: `Engineering task queued: ${userText.slice(0, 60)}` });

    const listener = (event: BusEvent) => {
      if (event.source !== 'LLMModeAgent') return;
      if (event.type === EventTypes.PROCESS_START || event.type === EventTypes.PROCESS_PROGRESS) {
        const message = event.data.message || event.data.stage || 'working';
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

      const session = await agent.executeTask({
        id: taskId,
        title: `Studio engineering: ${userText.slice(0, 60)}`,
        description: userText,
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
      this.emit(sessionId, { type: 'response.metadata', sessionId, model: modelName, duration });
      this.emit(sessionId, { type: 'task.completed', sessionId, taskId, success: session.status === 'success', durationMs: duration });

      this.emit(sessionId, {
        type: 'status.updated',
        sessionId,
        status: this.sessions.update(sessionId, {
          mode: 'chat',
          activeTask: `Engineering ${session.status}`,
          model: modelName,
        }),
      });

      logBridge('engineering.completed', {
        sessionId,
        taskId,
        status: session.status,
        steps: session.stepCount,
        tools: this.agentToolsUsed(session),
      });
    } finally {
      eventBus.offEvent(listener);
      this.activeStreams.delete(sessionId);
    }
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
    const duration = session.endTime
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : Date.now() - new Date(session.startTime).getTime();
    const toolLines = session.messages
      .filter((m) => m.toolCall)
      .map((m) => {
        // Find the tool result that corresponds to this specific tool call.
        // Tool results appear in session.messages after their respective assistant messages.
        const mIndex = session.messages.indexOf(m);
        const result = mIndex >= 0
          ? session.messages.slice(mIndex + 1).find((candidate) => candidate.role === 'tool' && candidate.toolResult)
          : undefined;
        return `- ${m.toolCall?.tool}: ${m.toolCall?.thought}${result?.toolResult ? ` (${result.toolResult.success ? 'ok' : 'failed'})` : ''}`;
      })
      .slice(-12);

    return [
      `# Meta-Harness Tool Run`,
      ``,
      `Status: ${session.status}`,
      `Task: ${session.task.title}`,
      `Steps: ${session.stepCount}`,
      `Duration: ${duration}ms`,
      `Tools used: ${this.agentToolsUsed(session).join(', ') || 'none'}`,
      ``,
      `## Tool trace`,
      toolLines.length > 0 ? toolLines.join('\n') : '- no tool calls recorded',
      ``,
      `## Notes`,
      session.status === 'success'
        ? 'The harness agent reported completion.'
        : 'The harness agent did not report success. Check .omx/logs/bubbletea-bridge.log and working tree diff before trusting changes.',
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
  publishEvent(sessionId: string, event: Omit<TuiBridgeEvent, 'sessionId'>): void {
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
}
