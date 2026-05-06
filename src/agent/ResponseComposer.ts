/**
 * ResponseComposer — Phase 11
 *
 * Formats StudioAgent responses with structured metadata.
 * Wraps raw LLM output with provenance information: artifact refs,
 * task refs, score summaries, and timing.
 *
 * This is the boundary between "agent logic" and "TUI display".
 * The TUI receives StudioResponse objects and renders them.
 */

import type {
  IntentType,
  StudioResponse,
  ResponseMetadata,
  DelegationDecision,
  ExecutionProvenance,
} from './types.js';

// ── Composer ──

export class ResponseComposer {
  /**
   * Compose a structured response from raw LLM output and delegation context.
   */
  compose(
    content: string,
    turnId: string,
    intent: IntentType,
    delegation: DelegationDecision,
    durationMs: number,
    opts?: {
      artifactRefs?: string[];
      taskRefs?: string[];
      model?: string;
      executor?: ExecutionProvenance;
    },
  ): StudioResponse {
    const metadata: ResponseMetadata = {
      turnId,
      intent,
      delegatedTo: delegation.target,
      artifactRefs: opts?.artifactRefs ?? [],
      taskRefs: opts?.taskRefs ?? [],
      durationMs,
      model: opts?.model,
      executor: opts?.executor,
    };

    return {
      content,
      metadata,
    };
  }

  /**
   * Format a direct conversational response.
   */
  directResponse(
    content: string,
    turnId: string,
    durationMs: number,
    model?: string,
  ): StudioResponse {
    return this.compose(content, turnId, 'direct', {
      target: 'llm-chat',
      params: {},
      reason: 'Direct conversational response',
    }, durationMs, { model });
  }

  /**
   * Format a creative generation response.
   */
  creativeResponse(
    content: string,
    turnId: string,
    durationMs: number,
    artifactRefs: string[],
    model?: string,
  ): StudioResponse {
    return this.compose(content, turnId, 'creative', {
      target: 'ralph-loop',
      params: {},
      reason: 'Creative generation via RalphLoop',
    }, durationMs, { artifactRefs, model });
  }

  /**
   * Format an engineering delegation response.
   */
  engineeringResponse(
    content: string,
    turnId: string,
    durationMs: number,
    taskRefs: string[],
    model?: string,
    executor: ExecutionProvenance = 'external-engineering-delegate',
  ): StudioResponse {
    return this.compose(content, turnId, 'engineering', {
      target: 'engineering-delegate',
      params: {},
      reason: 'Engineering task via injected engineering delegate',
    }, durationMs, { taskRefs, model, executor });
  }

  /**
   * Format a hybrid response (creative + engineering verification).
   */
  hybridResponse(
    content: string,
    turnId: string,
    durationMs: number,
    artifactRefs: string[],
    taskRefs: string[],
    model?: string,
  ): StudioResponse {
    return this.compose(content, turnId, 'hybrid', {
      target: 'ralph-loop',
      params: { verify: true },
      reason: 'Hybrid: creative generation with engineering verification',
    }, durationMs, { artifactRefs, taskRefs, model });
  }
}
