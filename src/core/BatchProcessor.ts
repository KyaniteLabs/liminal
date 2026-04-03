/**
 * @module BatchProcessor
 * Queue-based batch processor with concurrency control.
 * Inspired by Print-OS's batch_processor.py pattern.
 */

import { Status } from '../types/status.js';

/**
 * Represents a single job in the batch processing queue.
 *
 * @typeParam TInput  - The type of the job's input payload.
 * @typeParam TOutput - The type of the job's result on success.
 */
export interface BatchJob<TInput, TOutput> {
  /** Unique identifier for this job. */
  id: string;
  /** The input payload to be processed. */
  input: TInput;
  /** Priority value — higher values are processed first when the queue is drained. */
  priority: number;
  /** Current lifecycle status of the job. */
  status: Status.PENDING | Status.RUNNING | Status.COMPLETED | Status.FAILED;
  /** The successful result, populated once the job completes. */
  result?: TOutput;
  /** Error message, populated when the job fails after all retry attempts. */
  error?: string;
  /** Epoch timestamp (ms) when the job was submitted. */
  submittedAt: number;
  /** Epoch timestamp (ms) when the job reached a terminal state. */
  completedAt?: number;
}

/**
 * Configuration options for the {@link BatchProcessor}.
 */
export interface BatchProcessorConfig {
  /** Maximum number of jobs that may execute concurrently. */
  maxConcurrency: number;
  /** Number of retry attempts for a failed job before marking it as failed. */
  retryAttempts: number;
  /** Delay in milliseconds between retry attempts. */
  retryDelayMs: number;
}

/** Default configuration values used when no overrides are provided. */
const DEFAULT_CONFIG: BatchProcessorConfig = {
  maxConcurrency: 4,
  retryAttempts: 2,
  retryDelayMs: 500,
};

/**
 * A queue-based batch processor that respects a configurable concurrency limit.
 *
 * Jobs are submitted with an optional priority. When {@link BatchProcessor.process}
 * is called the queue is sorted by descending priority and jobs are dispatched up
 * to `maxConcurrency` at a time. Failed jobs are retried automatically up to the
 * configured `retryAttempts` before being marked as failed.
 *
 * @typeParam TInput  - The type of the input payload for each job.
 * @typeParam TOutput - The type of the result produced by each job.
 *
 * @example
 * ```ts
 * const bp = new BatchProcessor<string, number>(
 *   { maxConcurrency: 2 },
 *   async (url) => url.length,
 * );
 * bp.submit('https://example.com');
 * const results = await bp.process();
 * ```
 */
export class BatchProcessor<TInput, TOutput> {
  /** Internal job queue containing pending, running, completed, and failed jobs. */
  private queue: BatchJob<TInput, TOutput>[] = [];
  /** Number of jobs currently executing. */
  private activeCount = 0;
  /** Resolved configuration. */
  private readonly config: BatchProcessorConfig;
  /** The processing function applied to each job's input. */
  private processor?: (input: TInput) => Promise<TOutput>;
  /** Monotonic counter used to generate unique job IDs. */
  private idCounter = 0;

  /**
   * Create a new BatchProcessor.
   *
   * @param config    - Partial configuration overrides. Unspecified fields fall
   *                    back to the defaults (maxConcurrency=4, retryAttempts=2,
   *                    retryDelayMs=500).
   * @param processor - Optional processing function. Can also be set later via
   *                    {@link BatchProcessor.setProcessor}.
   */
  constructor(
    config?: Partial<BatchProcessorConfig>,
    processor?: (input: TInput) => Promise<TOutput>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.processor = processor;
  }

  /**
   * Set or replace the processing function used to transform inputs into outputs.
   *
   * @param fn - An async function that accepts a {@link TInput} and returns a
   *             {@link TOutput}.
   */
  setProcessor(fn: (input: TInput) => Promise<TOutput>): void {
    this.processor = fn;
  }

  /**
   * Submit a single job to the queue.
   *
   * @param input    - The input payload for the job.
   * @param priority - Optional priority (higher = processed sooner). Defaults to 0.
   * @returns The unique job ID assigned to the submitted job.
   * @throws {Error} If no processor function has been set.
   */
  submit(input: TInput, priority: number = 0): string {
    if (!this.processor) {
      throw new Error('No processor function set. Call setProcessor() first.');
    }
    const id = this.generateId();
    const job: BatchJob<TInput, TOutput> = {
      id,
      input,
      priority,
      status: Status.PENDING,
      submittedAt: Date.now(),
    };
    this.queue.push(job);
    return id;
  }

  /**
   * Submit multiple jobs at once, all sharing the same priority.
   *
   * @param inputs   - An array of input payloads.
   * @param priority - Optional priority applied to every job. Defaults to 0.
   * @returns An array of job IDs, one per input, in the same order.
   * @throws {Error} If no processor function has been set.
   */
  submitMany(inputs: TInput[], priority: number = 0): string[] {
    return inputs.map((input) => this.submit(input, priority));
  }

  /**
   * Process all pending jobs, respecting the configured concurrency limit.
   *
   * The queue is sorted by descending priority before processing begins.
   * Jobs that fail are retried up to `retryAttempts` times with a delay of
   * `retryDelayMs` between attempts. Once all retries are exhausted the job
   * is marked as `failed` and its `error` field is populated.
   *
   * @returns A promise that resolves with the full list of jobs once every
   *          pending job has reached a terminal state (`completed` or `failed`).
   * @throws {Error} If no processor function has been set.
   */
  async process(): Promise<BatchJob<TInput, TOutput>[]> {
    if (!this.processor) {
      throw new Error('No processor function set. Call setProcessor() first.');
    }

    const pending = this.queue.filter((job) => job.status === Status.PENDING);

    // Sort by descending priority so higher-priority jobs run first.
    pending.sort((a, b) => b.priority - a.priority);

    const processor = this.processor;
    const maxRetries = this.config.retryAttempts;
    const retryDelay = this.config.retryDelayMs;

    const runJob = async (job: BatchJob<TInput, TOutput>): Promise<void> => {
      let lastError: string | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const currentJob = job;
          currentJob.status = Status.RUNNING;
          this.activeCount++;
          const result = await processor(currentJob.input);
          this.activeCount--;

          currentJob.status = Status.COMPLETED;
          currentJob.result = result;
          currentJob.completedAt = Date.now();
          return;
        } catch (err) {
          this.activeCount--;
          lastError = err instanceof Error ? err.message : String(err);

          if (attempt < maxRetries) {
            await this.delay(retryDelay);
          }
        }
      }

      // All retries exhausted — mark as failed.
      job.status = Status.FAILED;
      job.error = lastError ?? 'Unknown error';
      job.completedAt = Date.now();
    };

    // Dispatch jobs respecting the concurrency cap.
    const executing: Promise<void>[] = [];

    for (const job of pending) {
      // If we've hit the concurrency limit, wait for at least one slot.
      if (this.activeCount >= this.config.maxConcurrency) {
        await Promise.race(executing);
      }

      const promise = runJob(job);
      executing.push(promise);

      // Remove settled promises to avoid unbounded growth.
      void promise.finally(() => {
        const idx = executing.indexOf(promise);
        if (idx !== -1) {
          void executing.splice(idx, 1);
        }
      });
    }

    // Wait for any remaining in-flight jobs to finish.
    await Promise.all(executing);

    return [...this.queue];
  }

  /**
   * Look up a job by its ID.
   *
   * @param jobId - The ID returned by {@link BatchProcessor.submit} or
   *                {@link BatchProcessor.submitMany}.
   * @returns The matching job, or `undefined` if no job with that ID exists.
   */
  getStatus(jobId: string): BatchJob<TInput, TOutput> | undefined {
    return this.queue.find((job) => job.id === jobId);
  }

  /**
   * Return all jobs that have completed successfully.
   *
   * @returns An array of jobs whose status is `Status.COMPLETED`.
   */
  getResults(): Array<BatchJob<TInput, TOutput>> {
    return this.queue.filter((job) => job.status === Status.COMPLETED);
  }

  /**
   * Remove completed and failed jobs from the internal queue.
   *
   * Pending and running jobs are retained so that an in-flight
   * {@link BatchProcessor.process} call is not disrupted.
   */
  clear(): void {
    this.queue = this.queue.filter(
      (job) => job.status === Status.PENDING || job.status === Status.RUNNING,
    );
  }

  /**
   * The number of jobs currently waiting to be processed.
   */
  get pendingCount(): number {
    return this.queue.filter((job) => job.status === Status.PENDING).length;
  }

  /**
   * The number of jobs currently executing.
   */
  get activeJobCount(): number {
    return this.activeCount;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique job ID.
   *
   * @returns A string of the form `job_<counter>`.
   */
  private generateId(): string {
    this.idCounter += 1;
    return `job_${this.idCounter}`;
  }

  /**
   * Return a promise that resolves after the specified delay.
   *
   * @param ms - Delay in milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
