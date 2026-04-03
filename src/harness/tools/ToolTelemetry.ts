/**
 * ToolTelemetry - Capture and analyze tool call patterns
 *
 * Links tool calls to reasoning context for comprehensive telemetry.
 * Helps diagnose which tools are used when, why, and with what success.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ToolResult } from './types.js';

export interface ToolCallRecord {
  id: string;
  timestamp: string;
  sessionId: string;
  taskId?: string;
  
  // Tool details
  tool: string;
  params: unknown;
  result: ToolResult;
  duration: number;
  
  // Context
  reasoning?: string;
  reasoningTraceId?: string;
  iteration?: number;
  
  // Outcome analysis
  success: boolean;
  retryCount: number;
  errorCategory?: string;
  
  // Sequence info
  callOrder: number;
  previousTool?: string;
  nextTool?: string;
}

export interface ToolUsageStats {
  tool: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
  retryRate: number;
  commonErrors: Array<{ error: string; count: number }>;
  commonParams: Array<{ param: string; values: unknown[] }>;
}

export interface ToolSequence {
  sequence: string[];
  count: number;
  avgSuccessRate: number;
  taskTypes: string[];
}

export interface ToolTelemetryAnalysis {
  totalCalls: number;
  uniqueTools: number;
  overallSuccessRate: number;
  avgDuration: number;
  toolStats: ToolUsageStats[];
  commonSequences: ToolSequence[];
  insights: string[];
}

export class ToolTelemetry {
  private logDir: string;
  private sessionId: string;
  private callOrder: number = 0;
  private lastTool?: string;

  constructor(sessionId?: string) {
    this.logDir = join(homedir(), '.liminal', 'tool-telemetry');
    this.sessionId = sessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log a tool call with full context
   */
  log(params: {
    tool: string;
    params: unknown;
    result: ToolResult;
    duration: number;
    reasoning?: string;
    reasoningTraceId?: string;
    taskId?: string;
    iteration?: number;
    retryCount?: number;
  }): ToolCallRecord {
    this.callOrder++;

    const record: ToolCallRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      taskId: params.taskId,
      tool: params.tool,
      params: this.sanitizeParams(params.params),
      result: params.result,
      duration: params.duration,
      reasoning: params.reasoning,
      reasoningTraceId: params.reasoningTraceId,
      iteration: params.iteration,
      success: params.result.success,
      retryCount: params.retryCount || 0,
      errorCategory: params.result.error ? this.categorizeError(params.result.error) : undefined,
      callOrder: this.callOrder,
      previousTool: this.lastTool,
    };

    this.lastTool = params.tool;

    // Save to file
    const filename = `${record.id}.json`;
    const filepath = join(this.logDir, filename);
    writeFileSync(filepath, JSON.stringify(record, null, 2));

    return record;
  }

  /**
   * Sanitize params to remove sensitive data
   */
  private sanitizeParams(params: unknown): unknown {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      // Truncate long strings (like file contents)
      if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '... [truncated]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Categorize errors for pattern analysis
   */
  private categorizeError(error: string): string {
    const errorPatterns = [
      { pattern: /not found|ENOENT|no such file/i, category: 'file_not_found' },
      { pattern: /permission|access denied|EACCES/i, category: 'permission_error' },
      { pattern: /syntax|parse|unexpected token/i, category: 'syntax_error' },
      { pattern: /timeout|ETIMEDOUT|timed out/i, category: 'timeout' },
      { pattern: /rate limit|too many requests/i, category: 'rate_limited' },
      { pattern: /validation|invalid|malformed/i, category: 'validation_error' },
      { pattern: /build|compilation|tsc failed/i, category: 'build_error' },
      { pattern: /test|assertion|expect/i, category: 'test_failure' },
    ];

    for (const { pattern, category } of errorPatterns) {
      if (pattern.test(error)) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Load all tool calls for this session
   */
  getSessionCalls(): ToolCallRecord[] {
    if (!existsSync(this.logDir)) return [];

    const files = readdirSync(this.logDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    return files
      .map(f => {
        try {
          const content = readFileSync(join(this.logDir, f), 'utf-8');
          return JSON.parse(content) as ToolCallRecord;
        } catch {
          return null;
        }
      })
      .filter((c): c is ToolCallRecord => c !== null && c.sessionId === this.sessionId)
      .sort((a, b) => a.callOrder - b.callOrder);
  }

  /**
   * Analyze tool usage patterns
   */
  analyze(): ToolTelemetryAnalysis {
    const calls = this.getSessionCalls();
    
    if (calls.length === 0) {
      return {
        totalCalls: 0,
        uniqueTools: 0,
        overallSuccessRate: 0,
        avgDuration: 0,
        toolStats: [],
        commonSequences: [],
        insights: ['No tool calls recorded'],
      };
    }

    // Tool-specific stats
    const toolGroups = new Map<string, ToolCallRecord[]>();
    for (const call of calls) {
      if (!toolGroups.has(call.tool)) {
        toolGroups.set(call.tool, []);
      }
      toolGroups.get(call.tool)!.push(call);
    }

    const toolStats: ToolUsageStats[] = [];
    for (const [tool, toolCalls] of toolGroups) {
      const successCount = toolCalls.filter(c => c.success).length;
      const totalDuration = toolCalls.reduce((sum, c) => sum + c.duration, 0);
      const retryCount = toolCalls.reduce((sum, c) => sum + c.retryCount, 0);

      // Collect common errors
      const errorCounts = new Map<string, number>();
      for (const call of toolCalls) {
        if (call.errorCategory) {
          errorCounts.set(call.errorCategory, (errorCounts.get(call.errorCategory) || 0) + 1);
        }
      }
      const commonErrors = Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      toolStats.push({
        tool,
        totalCalls: toolCalls.length,
        successCount,
        failureCount: toolCalls.length - successCount,
        avgDuration: totalDuration / toolCalls.length,
        retryRate: retryCount / toolCalls.length,
        commonErrors,
        commonParams: [], // Could analyze param patterns here
      });
    }

    // Sequence analysis
    const sequences = this.analyzeSequences(calls);

    // Overall stats
    const totalDuration = calls.reduce((sum, c) => sum + c.duration, 0);
    const successCount = calls.filter(c => c.success).length;

    // Generate insights
    const insights = this.generateInsights(toolStats, sequences);

    return {
      totalCalls: calls.length,
      uniqueTools: toolGroups.size,
      overallSuccessRate: successCount / calls.length,
      avgDuration: totalDuration / calls.length,
      toolStats: toolStats.sort((a, b) => b.totalCalls - a.totalCalls),
      commonSequences: sequences,
      insights,
    };
  }

  /**
   * Analyze common tool sequences
   */
  private analyzeSequences(calls: ToolCallRecord[]): ToolSequence[] {
    const sequences: Map<string, ToolSequence> = new Map();

    // Find sequences of 2-3 tools
    for (let i = 0; i < calls.length - 1; i++) {
      // 2-tool sequences
      const seq2 = `${calls[i].tool} → ${calls[i + 1].tool}`;
      if (!sequences.has(seq2)) {
        sequences.set(seq2, { sequence: [calls[i].tool, calls[i + 1].tool], count: 0, avgSuccessRate: 0, taskTypes: [] });
      }
      sequences.get(seq2)!.count++;

      // 3-tool sequences
      if (i < calls.length - 2) {
        const seq3 = `${calls[i].tool} → ${calls[i + 1].tool} → ${calls[i + 2].tool}`;
        if (!sequences.has(seq3)) {
          sequences.set(seq3, { sequence: [calls[i].tool, calls[i + 1].tool, calls[i + 2].tool], count: 0, avgSuccessRate: 0, taskTypes: [] });
        }
        sequences.get(seq3)!.count++;
      }
    }

    return Array.from(sequences.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Generate insights from analysis
   */
  private generateInsights(toolStats: ToolUsageStats[], sequences: ToolSequence[]): string[] {
    const insights: string[] = [];

    // High failure rate tools
    const problematicTools = toolStats.filter(t => t.failureCount / t.totalCalls > 0.3);
    for (const tool of problematicTools) {
      insights.push(`⚠️ Tool "${tool.tool}" has high failure rate (${(tool.failureCount / tool.totalCalls * 100).toFixed(0)}%)`);
    }

    // Slow tools
    const slowTools = toolStats.filter(t => t.avgDuration > 10000);
    for (const tool of slowTools) {
      insights.push(`⏱️ Tool "${tool.tool}" is slow (avg ${(tool.avgDuration / 1000).toFixed(1)}s)`);
    }

    // High retry rate
    const retryTools = toolStats.filter(t => t.retryRate > 0.2);
    for (const tool of retryTools) {
      insights.push(`🔄 Tool "${tool.tool}" has high retry rate (${(tool.retryRate * 100).toFixed(0)}%)`);
    }

    // Common sequences
    if (sequences.length > 0) {
      insights.push(`🔁 Most common sequence: ${sequences[0].sequence.join(' → ')} (${sequences[0].count} times)`);
    }

    // Error patterns
    for (const tool of toolStats) {
      if (tool.commonErrors.length > 0) {
        insights.push(`❌ Tool "${tool.tool}" commonly fails with: ${tool.commonErrors[0].error}`);
      }
    }

    return insights;
  }

  /**
   * Get calls with reasoning context
   */
  getCallsWithReasoning(): ToolCallRecord[] {
    return this.getSessionCalls().filter(c => c.reasoning || c.reasoningTraceId);
  }

  /**
   * Correlate tool calls with reasoning patterns
   */
  correlateWithReasoning(reasoningPatterns: string[]): ToolCallRecord[] {
    return this.getSessionCalls().filter(c => {
      if (!c.reasoning) return false;
      return reasoningPatterns.some(pattern => c.reasoning!.includes(pattern));
    });
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance
export const toolTelemetry = new ToolTelemetry();
