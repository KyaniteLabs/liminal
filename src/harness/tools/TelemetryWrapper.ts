/**
 * TelemetryWrapper - Wraps tool execution with telemetry capture
 *
 * Wraps all tool calls to capture:
 * - Tool name and parameters
 * - Execution duration and outcome
 * - Reasoning context (if available)
 * - Error categorization
 */

import { ToolTelemetry, toolTelemetry } from './ToolTelemetry.js';
import type { Tool, ToolResult } from './types.js';

export interface ToolContext {
  reasoning?: string;
  reasoningTraceId?: string;
  taskId?: string;
  iteration?: number;
  retryCount?: number;
}

export class TelemetryWrapper {
  private telemetry: ToolTelemetry;
  private context: ToolContext = {};

  constructor(telemetry?: ToolTelemetry) {
    this.telemetry = telemetry || toolTelemetry;
  }

  /**
   * Set context for upcoming tool calls
   */
  setContext(context: ToolContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Wrap a tool with telemetry
   */
  wrap<T>(tool: Tool, params: unknown): Promise<ToolResult<T>> {
    const startTime = Date.now();

    return tool.execute(params).then(result => {
      const duration = Date.now() - startTime;

      // Log the tool call
      this.telemetry.log({
        tool: tool.name,
        params,
        result,
        duration,
        reasoning: this.context.reasoning,
        reasoningTraceId: this.context.reasoningTraceId,
        taskId: this.context.taskId,
        iteration: this.context.iteration,
        retryCount: this.context.retryCount,
      });

      return result as ToolResult<T>;
    });
  }

  /**
   * Execute with automatic retry on failure
   */
  async wrapWithRetry<T>(
    tool: Tool,
    params: unknown,
    maxRetries: number = 3
  ): Promise<ToolResult<T>> {
    let lastError: ToolResult<T> | undefined;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      const result = await this.wrap<T>(tool, params);

      if (result.success) {
        return result;
      }

      lastError = result;
      retryCount++;

      // Update context for retry
      this.setContext({ retryCount });

      // Exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return lastError!;
  }

  /**
   * Get telemetry analysis
   */
  getAnalysis() {
    return this.telemetry.analyze();
  }

  /**
   * Get all calls for current session
   */
  getSessionCalls() {
    return this.telemetry.getSessionCalls();
  }
}

// Singleton instance
export const telemetryWrapper = new TelemetryWrapper();
