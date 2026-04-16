/**
 * StudioAgent — Phase 11
 *
 * The foreground conversational agent the user chats with in the TUI.
 * Creative-first personality: an artist who also codes.
 *
 * Design principle: StudioAgent does NOT import TuiBridgeService,
 * ConveyorRunner, or RalphLoop directly. It accepts delegate functions
 * in its constructor. Wiring happens at the composition root.
 * This prevents horizontal integration hell between increments.
 */

import type {
  IntentClassification,
  StudioResponse,
  StudioAgentConfig,
  DelegationDecision,
} from './types.js';
import { IntentRouter } from './IntentRouter.js';
import { ModeAwareRouter } from './ProductMode.js';
import type { ModeConfig } from './ProductMode.js';
import { ResponseComposer } from './ResponseComposer.js';

// ── Delegate Types ──
// These are the boundaries. Each increment provides its own implementations.

/** Function that runs a creative generation (RalphLoop) */
export type CreativeDelegate = (prompt: string, signal?: AbortSignal) => Promise<CreativeResult>;

/** Function that runs an engineering task (ConveyorRunner) */
export type EngineeringDelegate = (description: string, signal?: AbortSignal) => Promise<EngineeringResult>;

/** Function that streams a direct chat response */
export type ChatDelegate = (systemPrompt: string, userMessage: string, signal?: AbortSignal) => AsyncGenerator<string>;

/** Result from a creative delegation */
export interface CreativeResult {
  content: string;
  artifactRefs: string[];
  model?: string;
}

/** Result from an engineering delegation */
export interface EngineeringResult {
  content: string;
  taskRefs: string[];
  model?: string;
}

// ── System Prompt ──

export const STUDIO_SYSTEM_PROMPT = `You are Liminal Studio — a creative guide and artistic collaborator.

You lead with creative sensibility. Even when discussing code, you frame it as craft.
You see generative art as a conversation between intention and emergence.

Your capabilities:
- Generate creative code (p5.js, Strudel, shaders, audio-reactive visuals)
- Remix and evolve existing artworks
- Improve the tools and code that power the creative system
- Explain creative choices, aesthetic reasoning, and technical tradeoffs

When the user asks for art, help them find their vision before generating.
When they ask for fixes, explain the craft behind the change.
When they're unsure, offer creative directions rather than just technical options.

Be concise but evocative. Show, don't tell. Let the code speak.`;

// ── Agent ──

export class StudioAgent {
  private readonly router: IntentRouter | ModeAwareRouter;
  private readonly composer: ResponseComposer;
  private readonly config: StudioAgentConfig;
  private readonly chatDelegate?: ChatDelegate;
  private readonly creativeDelegate?: CreativeDelegate;
  private readonly engineeringDelegate?: EngineeringDelegate;
  private turnCounter = 0;

  constructor(deps: {
    chatDelegate?: ChatDelegate;
    creativeDelegate?: CreativeDelegate;
    engineeringDelegate?: EngineeringDelegate;
    config?: StudioAgentConfig;
    /** Returns the active mode config for routing bias. Called on every classify(). */
    getActiveMode?: () => ModeConfig | undefined;
  }) {
    this.chatDelegate = deps.chatDelegate;
    this.creativeDelegate = deps.creativeDelegate;
    this.engineeringDelegate = deps.engineeringDelegate;
    this.config = deps.config ?? {};
    const baseRouter = new IntentRouter();
    this.router = deps.getActiveMode
      ? new ModeAwareRouter(baseRouter, deps.getActiveMode)
      : baseRouter;
    this.composer = new ResponseComposer();
  }

  /**
   * Get the system prompt for the studio role.
   */
  get systemPrompt(): string {
    return this.config.systemPrompt ?? STUDIO_SYSTEM_PROMPT;
  }

  /**
   * Classify input intent without executing.
   * Useful for the TUI to show intent badges before execution.
   */
  classify(input: string): IntentClassification {
    return this.router.classify(input);
  }

  /**
   * Process a user input turn.
   *
   * 1. Classify intent
   * 2. Decide delegation target
   * 3. Execute via the appropriate delegate
   * 4. Compose a structured response
   */
  async processInput(input: string, signal?: AbortSignal): Promise<StudioResponse> {
    const startTime = Date.now();
    const turnId = this.nextTurnId();

    // Step 1: Classify
    const classification = this.router.classify(input);

    // Step 2: Decide delegation
    const delegation = this.decideDelegation(classification, input);

    // Step 3: Execute
    let response: StudioResponse;

    switch (delegation.target) {
      case 'llm-chat':
        response = await this.executeDirect(input, turnId, startTime, signal);
        break;
      case 'ralph-loop':
        response = await this.executeCreative(input, turnId, startTime, signal);
        break;
      case 'conveyor':
        response = await this.executeEngineering(input, turnId, startTime, signal);
        break;
      default:
        response = await this.executeDirect(input, turnId, startTime, signal);
    }

    return response;
  }

  /**
   * Decide where to delegate based on classification and available delegates.
   */
  private decideDelegation(
    classification: IntentClassification,
    input: string,
  ): DelegationDecision {
    const { intent } = classification;

    // If no creative delegate is available, fall back to direct chat
    if (intent === 'creative' && !this.creativeDelegate) {
      return {
        target: 'llm-chat',
        params: {},
        reason: 'Creative intent but no creative delegate available, falling back to direct chat',
      };
    }

    // If no engineering delegate is available, fall back to direct chat
    if (intent === 'engineering' && !this.engineeringDelegate) {
      return {
        target: 'llm-chat',
        params: {},
        reason: 'Engineering intent but no engineering delegate available, falling back to direct chat',
      };
    }

    switch (intent) {
      case 'direct':
        return {
          target: 'llm-chat',
          params: {},
          reason: 'Direct conversational response',
        };
      case 'creative':
        return {
          target: 'ralph-loop',
          params: { prompt: input },
          reason: 'Creative generation via RalphLoop',
        };
      case 'engineering':
        return {
          target: 'conveyor',
          params: { description: input },
          reason: 'Engineering task via ConveyorRunner',
        };
      case 'hybrid':
        return {
          target: 'ralph-loop',
          params: { prompt: input, verify: true },
          reason: 'Hybrid: creative generation with engineering verification',
        };
    }
  }

  /**
   * Execute a direct conversational response.
   */
  private async executeDirect(
    input: string,
    turnId: string,
    startTime: number,
    signal?: AbortSignal,
  ): Promise<StudioResponse> {
    if (!this.chatDelegate) {
      return this.composer.directResponse(
        'I\'m not connected to an LLM yet. Please configure a studio provider.',
        turnId,
        Date.now() - startTime,
      );
    }

    const chunks: string[] = [];
    for await (const chunk of this.chatDelegate(this.systemPrompt, input, signal)) {
      chunks.push(chunk);
    }

    const content = chunks.join('');
    return this.composer.directResponse(content, turnId, Date.now() - startTime);
  }

  /**
   * Execute a creative generation.
   */
  private async executeCreative(
    input: string,
    turnId: string,
    startTime: number,
    signal?: AbortSignal,
  ): Promise<StudioResponse> {
    if (!this.creativeDelegate) {
      return this.composer.creativeResponse(
        'Creative generation is not yet connected.',
        turnId,
        Date.now() - startTime,
        [],
      );
    }

    const result = await this.creativeDelegate(input, signal);
    return this.composer.creativeResponse(
      result.content,
      turnId,
      Date.now() - startTime,
      result.artifactRefs,
      result.model,
    );
  }

  /**
   * Execute an engineering task.
   */
  private async executeEngineering(
    input: string,
    turnId: string,
    startTime: number,
    signal?: AbortSignal,
  ): Promise<StudioResponse> {
    if (!this.engineeringDelegate) {
      return this.composer.engineeringResponse(
        'Engineering delegation is not yet connected.',
        turnId,
        Date.now() - startTime,
        [],
      );
    }

    const result = await this.engineeringDelegate(input, signal);
    return this.composer.engineeringResponse(
      result.content,
      turnId,
      Date.now() - startTime,
      result.taskRefs,
      result.model,
    );
  }

  private nextTurnId(): string {
    this.turnCounter++;
    return `turn-${Date.now()}-${this.turnCounter}`;
  }
}
