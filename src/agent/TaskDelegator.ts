/**
 * TaskDelegator — Phase 11 Increment 2
 *
 * Bridges StudioAgent engineering intents to the task execution pipeline.
 * For Increment 2, delegates to the existing LLMModeAgent (self-improvement path).
 * Future increments will wire directly to ConveyorRunner.
 *
 * Design: accepts a factory function for the actual execution agent.
 * The bridge provides the factory, keeping TaskDelegator testable and decoupled.
 */

import type { EngineeringResult } from './StudioAgent.js';

/** Function that executes a task description and returns a session result */
export type TaskExecutor = (description: string, signal?: AbortSignal) => Promise<TaskExecutorResult>;

/** Result from a task executor */
export interface TaskExecutorResult {
  content: string;
  success: boolean;
  steps?: number;
  toolsUsed?: string[];
  model?: string;
}

/** Options for controlling task delegation */
export interface TaskDelegatorOptions {
  /** Maximum steps the task executor may take (default: 20) */
  maxSteps?: number;
}

/**
 * TaskDelegator translates engineering intents into structured task execution.
 *
 * It wraps the execution result with a task reference for provenance tracking,
 * and provides a clean interface that StudioAgent can delegate to.
 */
export class TaskDelegator {
  private taskCounter = 0;

  constructor(
    private executor: TaskExecutor,
    _options?: TaskDelegatorOptions,
  ) {}

  /**
   * Execute an engineering task.
   *
   * Creates a task reference, delegates to the executor,
   * and returns a structured EngineeringResult.
   */
  async execute(description: string, signal?: AbortSignal): Promise<EngineeringResult> {
    const taskId = this.nextTaskId();

    const result = await this.executor(description, signal);

    return {
      content: result.content,
      taskRefs: [taskId],
      model: result.model,
    };
  }

  private nextTaskId(): string {
    this.taskCounter++;
    return `T-${Date.now()}-${this.taskCounter}`;
  }
}
