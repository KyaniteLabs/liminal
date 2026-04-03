/**
 * ModelBehaviorPatterns - Tracks emergent patterns in model behavior
 *
 * This module detects patterns that emerge from analyzing many generations
 * across time, providing insights into model capabilities and quirks.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type BehaviorPatternType =
  | 'code_in_thinking'        // Model puts code in <think> tags
  | 'empty_output'            // Model returns empty code
  | 'truncated_code'          // Model cuts off mid-function
  | 'wrong_domain'            // Model generates wrong domain
  | 'over_confident'          // Model claims success but code fails
  | 'under_confident'         // Model apologizes excessively
  | 'format_confusion'        // Model confused about output format
  | 'excessive_comments'      // Model adds too many comments
  | 'missing_imports'         // Model forgets required imports
  | 'syntax_errors';          // Consistent syntax mistakes

export interface BehaviorPattern {
  id: string;
  type: BehaviorPatternType;
  model: string;
  domain?: string;
  firstSeen: string;
  lastSeen: string;
  frequency: number;          // How often it occurs (0-1)
  confidence: number;         // Confidence this is a real pattern
  examples: PatternExample[];
  suggestedFix?: string;
  autoAdaptation?: AdaptationRule;
}

export interface PatternExample {
  timestamp: string;
  prompt: string;
  thinking?: string;
  code?: string;
  outcome: 'success' | 'failure';
  error?: string;
}

export interface AdaptationRule {
  type: 'prompt_prefix' | 'prompt_suffix' | 'system_msg' | 'temperature' | 'model_switch';
  value: string;
  condition?: string;
}

export interface PatternStats {
  totalPatterns: number;
  byModel: Record<string, number>;
  byType: Record<BehaviorPatternType, number>;
  recentTrends: Trend[];
}

export interface Trend {
  patternType: BehaviorPatternType;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;  // per day
}

/**
 * ModelBehaviorPatterns - Emergent pattern detection
 */
export class ModelBehaviorPatterns {
  private dataDir: string;
  private patterns: Map<string, BehaviorPattern> = new Map();
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  constructor() {
    this.dataDir = join(homedir(), '.liminal', 'emergent-patterns');
    this.loadPatterns();
  }

  /**
   * Record an observation for pattern detection
   */
  recordObservation(params: {
    model: string;
    domain: string;
    prompt: string;
    thinking?: string;
    code?: string;
    outcome: 'success' | 'failure';
    error?: string;
    recoveredFromThinking?: boolean;
  }): void {
    // Detect specific patterns
    const detectedTypes = this.detectTypes(params);

    for (const type of detectedTypes) {
      this.updatePattern(type, params);
    }

    // Save after each observation
    this.savePatterns();
  }

  /**
   * Detect which pattern types apply to this observation
   */
  private detectTypes(params: {
    thinking?: string;
    code?: string;
    outcome: 'success' | 'failure';
    error?: string;
    recoveredFromThinking?: boolean;
  }): BehaviorPatternType[] {
    const types: BehaviorPatternType[] = [];

    // Code in thinking
    if (params.recoveredFromThinking || 
        (params.thinking && (!params.code || params.code === ''))) {
      types.push('code_in_thinking');
    }

    // Empty output
    if (!params.code || params.code.trim() === '') {
      types.push('empty_output');
    }

    // Truncated code
    if (params.code && 
        (params.code.match(/\{[^}]*$/) || // Unclosed brace
         params.code.match(/\([^)]*$/) ||  // Unclosed paren
         params.code.match(/\[[^\]]*$/))) { // Unclosed bracket
      types.push('truncated_code');
    }

    // Format confusion (error mentions format)
    if (params.error?.toLowerCase().includes('format') ||
        params.error?.toLowerCase().includes('structure')) {
      types.push('format_confusion');
    }

    // Syntax errors
    if (params.error?.toLowerCase().includes('syntax') ||
        params.error?.toLowerCase().includes('parse')) {
      types.push('syntax_errors');
    }

    // Missing imports
    if (params.error?.toLowerCase().includes('import') ||
        params.error?.toLowerCase().includes('require') ||
        params.error?.toLowerCase().includes('module')) {
      types.push('missing_imports');
    }

    return types;
  }

  /**
   * Update or create a pattern
   */
  private updatePattern(
    type: BehaviorPatternType,
    params: {
      model: string;
      domain: string;
      prompt: string;
      thinking?: string;
      code?: string;
      outcome: 'success' | 'failure';
      error?: string;
    }
  ): void {
    const key = `${type}:${params.model}:${params.domain}`;
    const now = new Date().toISOString();

    let pattern = this.patterns.get(key);
    if (!pattern) {
      pattern = {
        id: key,
        type,
        model: params.model,
        domain: params.domain,
        firstSeen: now,
        lastSeen: now,
        frequency: 0,
        confidence: 0,
        examples: [],
      };
      this.patterns.set(key, pattern);
    }

    // Update stats
    pattern.lastSeen = now;
    pattern.frequency = Math.min(1, pattern.frequency + 0.1);
    pattern.confidence = Math.min(1, pattern.confidence + 0.05);

    // Add example (limit to 5)
    pattern.examples.push({
      timestamp: now,
      prompt: params.prompt.slice(0, 200),
      thinking: params.thinking?.slice(0, 500),
      code: params.code?.slice(0, 300),
      outcome: params.outcome,
      error: params.error,
    });
    if (pattern.examples.length > 5) {
      pattern.examples.shift();
    }

    // Generate suggested fix based on pattern type
    pattern.suggestedFix = this.generateFix(type, params.model);

    // Generate auto-adaptation if confidence is high enough
    if (pattern.confidence >= this.CONFIDENCE_THRESHOLD && !pattern.autoAdaptation) {
      pattern.autoAdaptation = this.generateAdaptation(type, params.model);
    }
  }

  /**
   * Generate a suggested fix for a pattern
   */
  private generateFix(type: BehaviorPatternType, model: string): string {
    const fixes: Record<BehaviorPatternType, string> = {
      code_in_thinking: `Add explicit instruction: "Output code AFTER thinking tags, not inside <think>...</think> blocks"`,
      empty_output: `Check model temperature and maxTokens. Consider model tier adjustment.`,
      truncated_code: `Increase maxTokens for ${model} or add "complete all functions" instruction.`,
      wrong_domain: `Add domain-specific examples to prompt and validate domain detection.`,
      over_confident: `Add runtime validation to verify generated code actually works.`,
      under_confident: `Add "be confident" instruction and reduce safety-focused prompting.`,
      format_confusion: `Add explicit format requirements with examples in prompt.`,
      excessive_comments: `Add "minimal comments, focus on code" instruction.`,
      missing_imports: `Add required imports list to prompt template.`,
      syntax_errors: `Add syntax validation step and retry with error feedback.`,
    };
    return fixes[type] || 'Review pattern examples for specific fix.';
  }

  /**
   * Generate automatic adaptation rule
   */
  private generateAdaptation(type: BehaviorPatternType, model: string): AdaptationRule {
    switch (type) {
      case 'code_in_thinking':
        return {
          type: 'prompt_suffix',
          value: '\n\nIMPORTANT: Output your code AFTER any thinking/notes. Do NOT put code inside <think> tags.',
          condition: `model === '${model}'`,
        };
      case 'truncated_code':
        return {
          type: 'temperature',
          value: '0.3',
          condition: `model === '${model}'`,
        };
      case 'format_confusion':
        return {
          type: 'system_msg',
          value: 'You must output ONLY the requested code format. No explanations, no markdown, just code.',
          condition: `model === '${model}'`,
        };
      default:
        return {
          type: 'prompt_prefix',
          value: '[Be precise and complete] ',
          condition: `model === '${model}'`,
        };
    }
  }

  /**
   * Get all patterns for a model
   */
  getPatternsForModel(model: string): BehaviorPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.model === model)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get patterns ready for auto-adaptation
   */
  getAdaptationReadyPatterns(): BehaviorPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.confidence >= this.CONFIDENCE_THRESHOLD && p.autoAdaptation)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get pattern statistics
   */
  getStats(): PatternStats {
    const byModel: Record<string, number> = {};
    const byType: Record<BehaviorPatternType, number> = {
      code_in_thinking: 0,
      empty_output: 0,
      truncated_code: 0,
      wrong_domain: 0,
      over_confident: 0,
      under_confident: 0,
      format_confusion: 0,
      excessive_comments: 0,
      missing_imports: 0,
      syntax_errors: 0,
    };

    for (const pattern of this.patterns.values()) {
      byModel[pattern.model] = (byModel[pattern.model] || 0) + 1;
      byType[pattern.type] = (byType[pattern.type] || 0) + 1;
    }

    return {
      totalPatterns: this.patterns.size,
      byModel,
      byType,
      recentTrends: this.calculateTrends(),
    };
  }

  /**
   * Calculate recent trends
   */
  private calculateTrends(): Trend[] {
    // Simple trend calculation based on last 7 days
    const trends: Trend[] = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const typeCounts: Record<string, { recent: number; older: number }> = {};

    for (const pattern of this.patterns.values()) {
      const lastSeen = new Date(pattern.lastSeen).getTime();
      const daysAgo = (now - lastSeen) / oneDay;

      if (!typeCounts[pattern.type]) {
        typeCounts[pattern.type] = { recent: 0, older: 0 };
      }

      if (daysAgo < 7) {
        typeCounts[pattern.type].recent++;
      } else if (daysAgo < 14) {
        typeCounts[pattern.type].older++;
      }
    }

    for (const [type, counts] of Object.entries(typeCounts)) {
      if (counts.older === 0) {
        trends.push({
          patternType: type as BehaviorPatternType,
          direction: 'increasing',
          changeRate: counts.recent,
        });
      } else {
        const change = (counts.recent - counts.older) / counts.older;
        trends.push({
          patternType: type as BehaviorPatternType,
          direction: change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable',
          changeRate: change,
        });
      }
    }

    return trends.sort((a, b) => Math.abs(b.changeRate) - Math.abs(a.changeRate));
  }

  /**
   * Save patterns to disk
   */
  private savePatterns(): void {
    try {
      if (!existsSync(this.dataDir)) {
        mkdirSync(this.dataDir, { recursive: true });
      }

      const data = {
        patterns: Array.from(this.patterns.values()),
        savedAt: new Date().toISOString(),
      };

      writeFileSync(
        join(this.dataDir, 'patterns.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (err) {
      console.warn('[ModelBehaviorPatterns] Failed to save:', err);
    }
  }

  /**
   * Load patterns from disk
   */
  private loadPatterns(): void {
    try {
      const filepath = join(this.dataDir, 'patterns.json');
      if (!existsSync(filepath)) return;

      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      for (const pattern of data.patterns || []) {
        this.patterns.set(pattern.id, pattern);
      }
    } catch (err) {
      console.warn('[ModelBehaviorPatterns] Failed to load:', err);
    }
  }

  /**
   * Clear all patterns (for testing)
   */
  clear(): void {
    this.patterns.clear();
    this.savePatterns();
  }
}

// Singleton instance
export const modelBehaviorPatterns = new ModelBehaviorPatterns();
