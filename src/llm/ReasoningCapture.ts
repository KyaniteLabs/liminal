/**
 * ReasoningCapture - Structured extraction and storage of LLM reasoning traces
 *
 * Captures <thinking>, <thinking>, and similar reasoning tags from LLM outputs
 * for telemetry, pattern analysis, and system improvement.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ReasoningTrace {
  id: string;
  timestamp: string;
  sessionId: string;
  model: string;
  prompt: string;
  rawReasoning: string;
  cleanedReasoning: string;
  code: string;
  outcome: 'success' | 'failure' | 'timeout' | 'aborted';
  error?: string;
  duration: number;
  iteration: number;
  patterns?: DetectedPattern[];
  quality?: ReasoningQuality;
}

export interface DetectedPattern {
  type: ReasoningPatternType;
  confidence: number;
  evidence: string;
  position: number; // Character position in reasoning
}

export type ReasoningPatternType =
  | 'infinite_reconsideration'
  | 'confusion'
  | 'over_engineering'
  | 'hallucination'
  | 'timeout_precursor'
  | 'premature_optimization'
  | 'circular_reasoning'
  | 'excessive_alternatives'
  | 'no_code_generation'
  | 'code_in_thinking'  // NEW: Model put code in thinking tags (Minimax pattern)

export interface ReasoningQuality {
  score: number; // 0-1
  efficiency: number; // Ratio of useful content to total length
  focus: number; // How well it stays on task
  actionability: number; // Leads to actual code
}

export interface ReasoningStats {
  totalTraces: number;
  patternsByType: Record<ReasoningPatternType, number>;
  avgQuality: number;
  avgDuration: number;
  successRate: number;
}

// Patterns for detecting reasoning issues
const REASONING_PATTERNS: Array<{
  type: ReasoningPatternType;
  regex: RegExp;
  confidence: number;
  description: string;
}> = [
  {
    type: 'infinite_reconsideration',
    regex: /(?:actually|let me reconsider|on second thought|wait,?|hmm|maybe|or perhaps|alternatively)[,.]?.*(?:actually|let me reconsider|on second thought|wait,?|hmm|maybe|or perhaps|alternatively)/gi,
    confidence: 0.8,
    description: 'Multiple reconsideration statements indicate circular thinking',
  },
  {
    type: 'confusion',
    regex: /(?:i['']?m not sure|confused|unclear|don['']?t know|uncertain|puzzled|what\?|huh\?)/gi,
    confidence: 0.7,
    description: 'Explicit confusion statements',
  },
  {
    type: 'over_engineering',
    regex: /(?:spatial hash|object pooling|factory pattern|builder pattern|singleton|dependency injection|microservices|distributed|scalability|enterprise)/gi,
    confidence: 0.75,
    description: 'Overly complex architectural patterns for simple tasks',
  },
  {
    type: 'hallucination',
    regex: /(?:Tone\.Reverberator|gl_FragCoord|iResolution|THREE\.[A-Z][a-z]+[A-Z]|createOscillator\(\)|AudioContext\(\))/gi,
    confidence: 0.6,
    description: 'Mentions of APIs that may not exist',
  },
  {
    type: 'timeout_precursor',
    regex: /(?:let me think|thinking|considering|pondering|evaluating|assessing).{100,}/is,
    confidence: 0.5,
    description: 'Long reasoning without code generation',
  },
  {
    type: 'premature_optimization',
    regex: /(?:performance|optimize|efficiency|speed|fast|memory|garbage collection|cache|lazy loading)/gi,
    confidence: 0.6,
    description: 'Optimization concerns before basic implementation',
  },
  {
    type: 'circular_reasoning',
    regex: /(?:back to|returning to|as i said|as mentioned|like i said)/gi,
    confidence: 0.65,
    description: 'Returning to previously discussed points',
  },
  {
    type: 'excessive_alternatives',
    regex: /(?:or|alternatively|instead|could also|might also|another way).{0,50}(?:or|alternatively|instead|could also|might also|another way).{0,50}(?:or|alternatively|instead|could also|might also|another way)/gi,
    confidence: 0.7,
    description: 'Too many alternative approaches considered',
  },
  {
    type: 'no_code_generation',
    regex: /^(?!.*\b(function|const|let|var|class|if|for|while|import|export|return)\b).*$/s,
    confidence: 0.9,
    description: 'Reasoning contains no code keywords',
  },
  {
    type: 'code_in_thinking',
    regex: /<think>[\s\S]*?(function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)[\s\S]*?<\/think>/i,
    confidence: 0.85,
    description: 'Model put code inside <think> tags instead of main output',
  },
];

export class ReasoningCapture {
  private logDir: string;
  private sessionId: string;

  constructor(sessionId?: string) {
    this.logDir = join(homedir(), '.liminal', 'reasoning');
    this.sessionId = sessionId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Extract reasoning traces from LLM output
   */
  extractReasoning(output: string): { reasoning: string; code: string } {
    // Pattern to match reasoning tags
    const reasoningPatterns = [
      /<thinking>([\s\S]*?)<\/thinking>/gi,
      /<thinking>([\s\S]*?)<\/thinking>/gi,
      /<reasoning>([\s\S]*?)<\/reasoning>/gi,
      /<analysis>([\s\S]*?)<\/analysis>/gi,
    ];

    let reasoning = '';
    let cleanedOutput = output;

    for (const pattern of reasoningPatterns) {
      const matches = output.matchAll(pattern);
      for (const match of matches) {
        reasoning += match[1] + '\n';
        cleanedOutput = cleanedOutput.replace(match[0], '');
      }
    }

    return {
      reasoning: reasoning.trim(),
      code: cleanedOutput.trim(),
    };
  }

  /**
   * Detect patterns in reasoning
   */
  detectPatterns(reasoning: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const pattern of REASONING_PATTERNS) {
      const matches = reasoning.matchAll(pattern.regex);
      for (const match of matches) {
        patterns.push({
          type: pattern.type,
          confidence: pattern.confidence,
          evidence: match[0].substring(0, 100), // First 100 chars as evidence
          position: match.index || 0,
        });
      }
    }

    // Remove duplicates by position
    const uniquePatterns = new Map<number, DetectedPattern>();
    for (const p of patterns) {
      if (!uniquePatterns.has(p.position)) {
        uniquePatterns.set(p.position, p);
      }
    }

    return Array.from(uniquePatterns.values()).sort((a, b) => a.position - b.position);
  }

  /**
   * Calculate reasoning quality metrics
   */
  calculateQuality(reasoning: string, code: string): ReasoningQuality {
    const hasCode = code.length > 50;
    const reasoningLength = reasoning.length;
    
    // Efficiency: ratio of reasoning to code (lower is better)
    const efficiency = hasCode 
      ? Math.min(code.length / (reasoningLength + code.length), 1)
      : 0;

    // Focus: check for off-topic indicators
    const offTopicIndicators = (reasoning.match(/(?:unrelated|off topic|by the way|incidentally|speaking of)/gi) || []).length;
    const focus = Math.max(0, 1 - offTopicIndicators * 0.2);

    // Actionability: does it lead to code?
    const actionability = hasCode ? 1 : 0;

    // Overall score
    const score = (efficiency * 0.4 + focus * 0.3 + actionability * 0.3);

    return {
      score,
      efficiency,
      focus,
      actionability,
    };
  }

  /**
   * Capture and store a reasoning trace
   */
  capture(params: {
    model: string;
    prompt: string;
    rawOutput: string;
    outcome: 'success' | 'failure' | 'timeout' | 'aborted';
    error?: string;
    duration: number;
    iteration: number;
  }): ReasoningTrace {
    const { reasoning, code } = this.extractReasoning(params.rawOutput);
    
    const trace: ReasoningTrace = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      model: params.model,
      prompt: params.prompt,
      rawReasoning: reasoning,
      cleanedReasoning: this.cleanReasoning(reasoning),
      code,
      outcome: params.outcome,
      error: params.error,
      duration: params.duration,
      iteration: params.iteration,
    };

    // Analyze patterns and quality
    trace.patterns = this.detectPatterns(reasoning);
    trace.quality = this.calculateQuality(reasoning, code);

    // Save to file
    this.saveTrace(trace);

    return trace;
  }

  /**
   * Clean reasoning text for storage
   */
  private cleanReasoning(reasoning: string): string {
    return reasoning
      .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .substring(0, 10000); // Limit to 10KB
  }

  /**
   * Save trace to file
   */
  private saveTrace(trace: ReasoningTrace): void {
    const filename = `${trace.id}.json`;
    const filepath = join(this.logDir, filename);
    writeFileSync(filepath, JSON.stringify(trace, null, 2));
  }

  /**
   * Get all traces for this session
   */
  getSessionTraces(): ReasoningTrace[] {
    if (!existsSync(this.logDir)) return [];

    const files = readdirSync(this.logDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    return files
      .map(f => {
        try {
          const content = readFileSync(join(this.logDir, f), 'utf-8');
          return JSON.parse(content) as ReasoningTrace;
        } catch {
          return null;
        }
      })
      .filter((t): t is ReasoningTrace => t !== null && t.sessionId === this.sessionId);
  }

  /**
   * Get statistics for session traces
   */
  getSessionStats(): ReasoningStats {
    const traces = this.getSessionTraces();
    
    const patternsByType: Record<ReasoningPatternType, number> = {
      infinite_reconsideration: 0,
      confusion: 0,
      over_engineering: 0,
      hallucination: 0,
      timeout_precursor: 0,
      premature_optimization: 0,
      circular_reasoning: 0,
      excessive_alternatives: 0,
      no_code_generation: 0,
      code_in_thinking: 0,
    };

    let totalQuality = 0;
    let totalDuration = 0;
    let successCount = 0;

    for (const trace of traces) {
      for (const pattern of trace.patterns || []) {
        patternsByType[pattern.type]++;
      }
      totalQuality += trace.quality?.score || 0;
      totalDuration += trace.duration;
      if (trace.outcome === 'success') successCount++;
    }

    return {
      totalTraces: traces.length,
      patternsByType,
      avgQuality: traces.length > 0 ? totalQuality / traces.length : 0,
      avgDuration: traces.length > 0 ? totalDuration / traces.length : 0,
      successRate: traces.length > 0 ? successCount / traces.length : 0,
    };
  }

  /**
   * Get traces with specific pattern
   */
  getTracesWithPattern(patternType: ReasoningPatternType): ReasoningTrace[] {
    return this.getSessionTraces().filter(t =>
      t.patterns?.some(p => p.type === patternType)
    );
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Singleton instance for default usage
export const reasoningCapture = new ReasoningCapture();
