/**
 * Observation Layer - Telemetry Collection
 * 
 * Collects execution traces, metrics, and events for guardrail evaluation.
 * Implements the "Golden Signals" pattern: latency, errors, traffic, saturation.
 */

import { writeFile } from 'fs/promises';
import { ExecutionTrace, TelemetryConfig, ResourceUsage } from '../core/types.js';

export interface TelemetryEvent {
  timestamp: number;
  taskId: string;
  type: 'start' | 'step' | 'guardrail' | 'remediation' | 'completion' | 'error';
  data: Record<string, unknown>;
}

export interface ExecutionMetrics {
  /** Task identifier */
  taskId: string;
  
  /** Total execution time in ms */
  totalDurationMs: number;
  
  /** Number of guardrails evaluated */
  guardrailsEvaluated: number;
  
  /** Number of violations detected */
  violationsDetected: number;
  
  /** Number of auto-remediations attempted */
  remediationsAttempted: number;
  
  /** Number of successful remediations */
  remediationsSuccessful: number;
  
  /** Number of escalations */
  escalations: number;
  
  /** Resource usage summary */
  resources: ResourceUsage;
  
  /** Success/failure status */
  success: boolean;
  
  /** Error details (if failed) */
  error?: {
    type: string;
    message: string;
  };
}

/**
 * Telemetry collector for guardrail observability
 */
export class TelemetryCollector {
  private events: TelemetryEvent[] = [];
  private traces: Map<string, ExecutionTrace> = new Map();
  private metrics: Map<string, ExecutionMetrics> = new Map();
  private config: TelemetryConfig;
  
  constructor(config: TelemetryConfig) {
    this.config = {
      ...config,
    };
  }
  
  /**
   * Record task start event
   */
  recordTaskStart(taskId: string, context: Record<string, unknown>): void {
    if (!this.shouldRecord()) return;
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'start',
      data: context,
    });
    
    // Initialize trace
    this.traces.set(taskId, { steps: [] });
    
    // Initialize metrics
    this.metrics.set(taskId, {
      taskId,
      totalDurationMs: 0,
      guardrailsEvaluated: 0,
      violationsDetected: 0,
      remediationsAttempted: 0,
      remediationsSuccessful: 0,
      escalations: 0,
      resources: {
        tokensUsed: 0,
        tokensLimit: 0,
        memoryUsedMB: 0,
        memoryLimitMB: 0,
        timeElapsedMs: 0,
        timeLimitMs: 0,
        apiCalls: 0,
        apiCallLimit: 0,
      },
      success: true,
    });
  }
  
  /**
   * Record execution step
   */
  recordStep(taskId: string, action: string, details: Record<string, unknown>): void {
    if (!this.shouldRecord()) return;
    
    const trace = this.traces.get(taskId);
    if (trace) {
      trace.steps.push({
        timestamp: Date.now(),
        action,
        details,
      });
    }
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'step',
      data: { action, ...details },
    });
  }
  
  /**
   * Record guardrail evaluation
   */
  recordGuardrailEvaluation(
    taskId: string,
    guardrailId: string,
    passed: boolean,
    details?: Record<string, unknown>
  ): void {
    if (!this.shouldRecord()) return;
    
    const metrics = this.metrics.get(taskId);
    if (metrics) {
      metrics.guardrailsEvaluated++;
      if (!passed) {
        metrics.violationsDetected++;
      }
    }
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'guardrail',
      data: {
        guardrailId,
        passed,
        ...details,
      },
    });
  }
  
  /**
   * Record remediation attempt
   */
  recordRemediation(
    taskId: string,
    guardrailId: string,
    success: boolean,
    details?: Record<string, unknown>
  ): void {
    if (!this.shouldRecord()) return;
    
    const metrics = this.metrics.get(taskId);
    if (metrics) {
      metrics.remediationsAttempted++;
      if (success) {
        metrics.remediationsSuccessful++;
      }
    }
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'remediation',
      data: {
        guardrailId,
        success,
        ...details,
      },
    });
  }
  
  /**
   * Record task completion
   */
  recordTaskCompletion(
    taskId: string,
    success: boolean,
    durationMs: number,
    error?: Error
  ): void {
    if (!this.shouldRecord()) return;
    
    const metrics = this.metrics.get(taskId);
    if (metrics) {
      metrics.totalDurationMs = durationMs;
      metrics.success = success;
      if (error) {
        metrics.error = {
          type: error.constructor.name,
          message: error.message,
        };
      }
    }
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'completion',
      data: {
        success,
        durationMs,
        error: error?.message,
      },
    });
    
    // Persist if file storage configured
    if (this.config.storage === 'file' && this.config.logPath) {
      void this.persistToFile(taskId);
    }
  }
  
  /**
   * Record escalation
   */
  recordEscalation(taskId: string, guardrailId: string, reason: string): void {
    if (!this.shouldRecord()) return;
    
    const metrics = this.metrics.get(taskId);
    if (metrics) {
      metrics.escalations++;
    }
    
    this.events.push({
      timestamp: Date.now(),
      taskId,
      type: 'error',
      data: {
        guardrailId,
        reason,
        escalated: true,
      },
    });
  }
  
  /**
   * Get execution trace for a task
   */
  getTrace(taskId: string): ExecutionTrace | undefined {
    return this.traces.get(taskId);
  }
  
  /**
   * Get metrics for a task
   */
  getMetrics(taskId: string): ExecutionMetrics | undefined {
    return this.metrics.get(taskId);
  }
  
  /**
   * Get all events for a task
   */
  getEvents(taskId: string): TelemetryEvent[] {
    return this.events.filter(e => e.taskId === taskId);
  }
  
  /**
   * Get summary statistics
   */
  getSummary(): {
    totalTasks: number;
    totalViolations: number;
    totalRemediations: number;
    totalEscalations: number;
    successRate: number;
    avgDurationMs: number;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const totalTasks = allMetrics.length;
    
    if (totalTasks === 0) {
      return {
        totalTasks: 0,
        totalViolations: 0,
        totalRemediations: 0,
        totalEscalations: 0,
        successRate: 0,
        avgDurationMs: 0,
      };
    }
    
    const successfulTasks = allMetrics.filter(m => m.success).length;
    const totalViolations = allMetrics.reduce((sum, m) => sum + m.violationsDetected, 0);
    const totalRemediations = allMetrics.reduce((sum, m) => sum + m.remediationsSuccessful, 0);
    const totalEscalations = allMetrics.reduce((sum, m) => sum + m.escalations, 0);
    const totalDuration = allMetrics.reduce((sum, m) => sum + m.totalDurationMs, 0);
    
    return {
      totalTasks,
      totalViolations,
      totalRemediations,
      totalEscalations,
      successRate: successfulTasks / totalTasks,
      avgDurationMs: totalDuration / totalTasks,
    };
  }
  
  /**
   * Clear all collected data
   */
  clear(): void {
    this.events = [];
    this.traces.clear();
    this.metrics.clear();
  }
  
  /**
   * Check if we should record this event based on sampling
   */
  private shouldRecord(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.sampleRate >= 1.0) return true;
    return Math.random() < this.config.sampleRate;
  }
  
  /**
   * Persist telemetry to file
   */
  private async persistToFile(taskId: string): Promise<void> {
    if (!this.config.logPath) return;
    
    const trace = this.traces.get(taskId);
    const metrics = this.metrics.get(taskId);
    const events = this.getEvents(taskId);
    
    const data = {
      taskId,
      timestamp: Date.now(),
      trace,
      metrics,
      events,
    };
    
    const filename = `${this.config.logPath}/${taskId}.json`;
    try {
      await writeFile(filename, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to persist telemetry: ${error}`);
    }
  }
}

// Global telemetry instance
let globalTelemetry: TelemetryCollector | null = null;

export function initializeTelemetry(config: TelemetryConfig): TelemetryCollector {
  globalTelemetry = new TelemetryCollector(config);
  return globalTelemetry;
}

export function getTelemetry(): TelemetryCollector | null {
  return globalTelemetry;
}
