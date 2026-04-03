/**
 * ThinkingAnalyzer - Analyzes generator thinking traces for harness learning
 *
 * This component bridges the gap between generator models and the harness.
 * When generators fail (or succeed with recovered code), the harness
 * analyzes their thinking to understand WHY and suggest fixes.
 */

import type { LLMResponse } from '../llm/LLMClient.js';
import { reasoningCapture, type DetectedPattern } from '../llm/ReasoningCapture.js';

export interface ThinkingAnalysis {
  model: string;
  domain: string;
  prompt: string;
  thinkingSummary: string;
  codeRecovered: boolean;
  originalCodeEmpty: boolean;
  detectedPatterns: DetectedPattern[];
  suggestedFix?: AdaptationSuggestion;
  learning: string; // What the harness learned from this thinking
}

export interface AdaptationSuggestion {
  type: 'prompt' | 'model_config' | 'validation' | 'routing';
  description: string;
  priority: 'high' | 'medium' | 'low';
  implementation?: string;
}

export class ThinkingAnalyzer {
  /**
   * Analyze thinking from a generation response
   * Called by harness when failures occur
   */
  analyze(response: LLMResponse, prompt: string, domain: string, model: string): ThinkingAnalysis {
    const thinking = response.thinking || '';
    
    // Capture reasoning trace
    const trace = reasoningCapture.capture({
      model,
      prompt,
      rawOutput: thinking,
      outcome: response.success ? 'success' : 'failure',
      duration: 0, // Not available at this level
      iteration: 1,
    });

    // Analyze thinking for specific patterns
    const detectedPatterns = trace.patterns || [];
    
    // Check for code-in-thinking pattern
    if (thinking && (!response.code || response.recoveredFromThinking)) {
      detectedPatterns.push({
        type: 'no_code_generation',
        confidence: 0.9,
        evidence: 'Model put code inside <think> tags instead of main output',
        position: 0,
      });
    }

    // Generate adaptation suggestion based on patterns
    const suggestedFix = this.generateSuggestion(
      detectedPatterns,
      response,
      domain,
      model
    );

    // Extract learning insight
    const learning = this.extractLearning(
      thinking,
      detectedPatterns,
      response.success
    );

    return {
      model,
      domain,
      prompt: prompt.slice(0, 200),
      thinkingSummary: this.summarizeThinking(thinking),
      codeRecovered: response.recoveredFromThinking || false,
      originalCodeEmpty: !response.code || response.code === '',
      detectedPatterns,
      suggestedFix,
      learning,
    };
  }

  /**
   * Generate adaptation suggestion based on detected patterns
   */
  private generateSuggestion(
    patterns: DetectedPattern[],
    response: LLMResponse,
    domain: string,
    model: string
  ): AdaptationSuggestion | undefined {
    // Pattern: Code in thinking tags (Minimax issue)
    if (response.recoveredFromThinking) {
      return {
        type: 'prompt',
        description: `Model ${model} outputs code inside <think> tags`,
        priority: 'high',
        implementation: `Add explicit instruction: "Output your code AFTER the thinking tags, not inside them. The code should be outside <think>...</think> blocks."`,
      };
    }

    // Pattern: No code generation
    const noCodePattern = patterns.find(p => p.type === 'no_code_generation');
    if (noCodePattern) {
      return {
        type: 'model_config',
        description: `Model ${model} not generating code for ${domain}`,
        priority: 'high',
        implementation: `Consider using a different model tier or adjusting temperature/prompt for ${model}`,
      };
    }

    // Pattern: Confusion
    const confusionPattern = patterns.find(p => p.type === 'confusion');
    if (confusionPattern) {
      return {
        type: 'prompt',
        description: `Model confused about ${domain} requirements`,
        priority: 'medium',
        implementation: `Add clearer domain-specific examples and constraints to the prompt`,
      };
    }

    // Pattern: Over-engineering
    const overEngPattern = patterns.find(p => p.type === 'over_engineering');
    if (overEngPattern) {
      return {
        type: 'validation',
        description: `Model over-engineering simple ${domain} tasks`,
        priority: 'medium',
        implementation: `Add validation rule: reject code with excessive architectural patterns`,
      };
    }

    // Pattern: Timeout precursor
    const timeoutPattern = patterns.find(p => p.type === 'timeout_precursor');
    if (timeoutPattern) {
      return {
        type: 'model_config',
        description: `Model ${model} taking too long to reason`,
        priority: 'high',
        implementation: `Reduce maxTokens or add explicit "be concise" instruction`,
      };
    }

    return undefined;
  }

  /**
   * Extract learning insight from thinking analysis
   */
  private extractLearning(
    _thinking: string,
    patterns: DetectedPattern[],
    success: boolean
  ): string {
    if (success && patterns.length === 0) {
      return 'Clean generation with clear reasoning';
    }

    if (patterns.some(p => p.type === 'no_code_generation')) {
      return 'Model needs explicit instruction on code placement';
    }

    if (patterns.some(p => p.type === 'confusion')) {
      return 'Model unclear on domain requirements - improve prompt specificity';
    }

    if (patterns.some(p => p.type === 'over_engineering')) {
      return 'Model overcomplicating - add simplicity constraints';
    }

    if (patterns.some(p => p.type === 'infinite_reconsideration')) {
      return 'Model stuck in analysis paralysis - add decisiveness instruction';
    }

    if (success) {
      return 'Generation succeeded despite some reasoning inefficiencies';
    }

    return 'Review thinking trace for specific failure mode';
  }

  /**
   * Create a summary of thinking content
   */
  private summarizeThinking(thinking: string): string {
    if (!thinking) return 'No thinking captured';
    
    // Extract first few sentences
    const sentences = thinking.split(/[.!?]+/).filter(s => s.trim());
    const firstFew = sentences.slice(0, 3).join('. ');
    
    if (thinking.length > 200) {
      return firstFew.substring(0, 200) + '...';
    }
    return firstFew;
  }

  /**
   * Get aggregate insights from multiple analyses
   */
  getAggregateInsights(analyses: ThinkingAnalysis[]): {
    commonPatterns: string[];
    modelIssues: Record<string, string[]>;
    recommendedAdaptations: AdaptationSuggestion[];
  } {
    const patternCounts: Record<string, number> = {};
    const modelIssues: Record<string, Set<string>> = {};
    const adaptations: Map<string, AdaptationSuggestion> = new Map();

    for (const analysis of analyses) {
      // Count patterns
      for (const pattern of analysis.detectedPatterns) {
        patternCounts[pattern.type] = (patternCounts[pattern.type] || 0) + 1;
      }

      // Track model issues
      if (!modelIssues[analysis.model]) {
        modelIssues[analysis.model] = new Set();
      }
      for (const pattern of analysis.detectedPatterns) {
        modelIssues[analysis.model].add(pattern.type);
      }

      // Collect unique adaptations
      if (analysis.suggestedFix) {
        const key = `${analysis.suggestedFix.type}:${analysis.suggestedFix.description}`;
        adaptations.set(key, analysis.suggestedFix);
      }
    }

    // Get most common patterns
    const commonPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    // Convert model issues sets to arrays
    const modelIssuesArray: Record<string, string[]> = {};
    for (const [model, issues] of Object.entries(modelIssues)) {
      modelIssuesArray[model] = Array.from(issues);
    }

    return {
      commonPatterns,
      modelIssues: modelIssuesArray,
      recommendedAdaptations: Array.from(adaptations.values()),
    };
  }
}

// Singleton instance
export const thinkingAnalyzer = new ThinkingAnalyzer();
