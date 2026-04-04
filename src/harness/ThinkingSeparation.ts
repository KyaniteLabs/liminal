/**
 * Thinking Separation - Keep generator and harness thinking separate
 * 
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * - Generator thinking = "How do I create this code?" (creative, domain-specific)
 * - Harness thinking = "How do I fix this system?" (meta, architectural)
 * 
 * These must NEVER mix. They serve different purposes and mine different insights.
 */

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type ThinkingSource = 'generator' | 'harness' | 'user';

export interface SeparatedThinking {
  id: string;
  timestamp: string;
  source: ThinkingSource;
  model: string;
  domain?: string;
  context: 'generation' | 'adaptation' | 'diagnosis' | 'improvement';
  thinking: string;
  code?: string;
  outcome?: 'success' | 'failure' | 'partial';
  insights?: string[];  // Extracted insights from mining
  actionItems?: string[];  // Things to do based on this thinking
}

/**
 * ThinkingMiner - Extracts actionable insights from thinking traces
 */
export class ThinkingMiner {
  /**
   * Mine generator thinking for code patterns
   */
  mineGeneratorThinking(thinking: string): {
    insights: string[];
    actionItems: string[];
    patterns: string[];
  } {
    const insights: string[] = [];
    const actionItems: string[] = [];
    const patterns: string[] = [];

    // Look for confusion patterns
    if (/confused|unclear|not sure|don't know/i.test(thinking)) {
      insights.push('Model confusion detected - prompt may be ambiguous');
      actionItems.push('Add clearer examples to prompt');
      patterns.push('confusion');
    }

    // Look for over-engineering
    if (/optimization|performance|efficiency|scaling/i.test(thinking)) {
      insights.push('Model over-engineering for simple task');
      actionItems.push('Add "keep it simple" constraint');
      patterns.push('over_engineering');
    }

    // Look for wrong domain
    if (/three\.js|webgl|shader/i.test(thinking) && !thinking.includes('p5')) {
      insights.push('Model thinking about wrong technology');
      actionItems.push('Clarify domain requirements');
      patterns.push('wrong_domain_thoughts');
    }

    // Look for code-in-thinking
    if (/<think>.*```.*<\/think>/s.test(thinking)) {
      insights.push('Model putting code in thinking tags');
      actionItems.push('Add "output code after thinking" instruction');
      patterns.push('code_in_thinking');
    }

    // Look for uncertainty
    if (/maybe|perhaps|could|might|possibly/i.test(thinking)) {
      insights.push('Model uncertain - lacks confidence');
      actionItems.push('Add "be confident" instruction');
      patterns.push('uncertainty');
    }

    // Look for infinite loops
    if (/reconsider|on second thought|actually|wait/i.test(thinking)) {
      const matches = thinking.match(/(reconsider|on second thought|actually)/gi);
      if (matches && matches.length > 2) {
        insights.push('Model stuck in analysis paralysis');
        actionItems.push('Add "be decisive" instruction');
        patterns.push('infinite_reconsideration');
      }
    }

    return { insights, actionItems, patterns };
  }

  /**
   * Mine harness thinking for system improvements
   */
  mineHarnessThinking(thinking: string): {
    insights: string[];
    actionItems: string[];
    systemChanges: string[];
  } {
    const insights: string[] = [];
    const actionItems: string[] = [];
    const systemChanges: string[] = [];

    // Look for architectural insights
    if (/architecture|refactor|restructure/i.test(thinking)) {
      insights.push('Harness identified architectural issue');
      systemChanges.push('Consider architectural change');
    }

    // Look for pattern recognition
    if (/pattern|always|every time|consistently/i.test(thinking)) {
      insights.push('Harness detected recurring pattern');
      actionItems.push('Create automated fix for pattern');
    }

    // Look for tool suggestions
    if (/need a tool|should add|missing tool/i.test(thinking)) {
      const toolMatch = thinking.match(/tool\s+(?:for|to)?\s+(\w+)/i);
      if (toolMatch) {
        insights.push(`Harness suggests new tool: ${toolMatch[1]}`);
        actionItems.push(`Create ${toolMatch[1]} tool`);
      }
    }

    // Look for prompt engineering insights
    if (/prompt|instruction|tell the model/i.test(thinking)) {
      insights.push('Harness identified prompt issue');
      actionItems.push('Update prompt template');
    }

    // Look for validation gaps
    if (/validation|check|verify|test/i.test(thinking)) {
      insights.push('Harness identified validation gap');
      actionItems.push('Add validation step');
    }

    return { insights, actionItems, systemChanges };
  }
}

/**
 * ThinkingRepository - Stores thinking separately by source
 */
export class ThinkingRepository {
  private baseDir: string;
  private miner: ThinkingMiner;

  constructor() {
    this.baseDir = join(homedir(), '.liminal', 'thinking-traces');
    this.miner = new ThinkingMiner();
    this.ensureDirs();
  }

  private ensureDirs(): void {
    const sources: ThinkingSource[] = ['generator', 'harness', 'user'];
    for (const source of sources) {
      const dir = join(this.baseDir, source);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Store generator thinking
   */
  storeGeneratorThinking(params: {
    model: string;
    domain: string;
    thinking: string;
    code?: string;
    outcome?: 'success' | 'failure' | 'partial';
    prompt?: string;
  }): SeparatedThinking {
    const mined = this.miner.mineGeneratorThinking(params.thinking);

    const entry: SeparatedThinking = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      source: 'generator',
      model: params.model,
      domain: params.domain,
      context: 'generation',
      thinking: params.thinking,
      code: params.code,
      outcome: params.outcome,
      insights: mined.insights,
      actionItems: mined.actionItems,
    };

    this.saveEntry(entry);
    return entry;
  }

  /**
   * Store harness thinking
   */
  storeHarnessThinking(params: {
    model: string;
    thinking: string;
    context: 'adaptation' | 'diagnosis' | 'improvement';
    failureId?: string;
  }): SeparatedThinking {
    const mined = this.miner.mineHarnessThinking(params.thinking);

    const entry: SeparatedThinking = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      source: 'harness',
      model: params.model,
      context: params.context,
      thinking: params.thinking,
      insights: mined.insights,
      actionItems: mined.actionItems,
    };

    this.saveEntry(entry);
    return entry;
  }

  /**
   * Save entry to appropriate directory
   */
  private saveEntry(entry: SeparatedThinking): void {
    const dir = join(this.baseDir, entry.source);
    const filename = `${entry.id}.json`;
    const filepath = join(dir, filename);

    writeFileSync(filepath, JSON.stringify(entry, null, 2));

    // Also append to daily log for easy analysis
    const logFile = join(dir, `${entry.timestamp.slice(0, 10)}.jsonl`);
    const logLine = JSON.stringify(entry) + '\n';
    writeFileSync(logFile, logLine, { flag: 'a' });
  }

  /**
   * Get recent insights by source
   * Reads JSON files from the thinking-traces directory and returns
   * the N most recent insights sorted by timestamp.
   */
  getRecentInsights(source: ThinkingSource, limit: number = 10): {
    insight: string;
    actionItem: string;
    timestamp: string;
  }[] {
    const dir = join(this.baseDir, source);
    if (!existsSync(dir)) {
      return [];
    }

    const results: { insight: string; actionItem: string; timestamp: string }[] = [];

    try {
      const files = readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = readFileSync(join(dir, file), 'utf-8');
          const entry: SeparatedThinking = JSON.parse(raw);
          const insights = entry.insights || [];
          const actionItems = entry.actionItems || [];
          for (let i = 0; i < insights.length; i++) {
            results.push({
              insight: insights[i],
              actionItem: actionItems[i] || '',
              timestamp: entry.timestamp,
            });
          }
        } catch {
          // Skip malformed files
        }
      }
    } catch {
      // Directory read failed
      return [];
    }

    // Sort by timestamp descending, then take the N most recent
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results.slice(0, limit);
  }

  /**
   * Get actionable items from all thinking sources.
   * Scans generator/ and harness/ thinking traces for action items
   * and returns a Map of source to array of action items.
   */
  getActionableItems(): Map<ThinkingSource, string[]> {
    const items = new Map<ThinkingSource, string[]>();
    const sources: ThinkingSource[] = ['generator', 'harness'];

    for (const source of sources) {
      const collected: string[] = [];
      const dir = join(this.baseDir, source);

      if (!existsSync(dir)) {
        items.set(source, collected);
        continue;
      }

      try {
        const files = readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const raw = readFileSync(join(dir, file), 'utf-8');
            const entry: SeparatedThinking = JSON.parse(raw);
            if (entry.actionItems && entry.actionItems.length > 0) {
              collected.push(...entry.actionItems);
            }
          } catch {
            // Skip malformed files
          }
        }
      } catch {
        // Directory read failed
      }

      items.set(source, collected);
    }

    return items;
  }
}

// Singleton instances
export const thinkingMiner = new ThinkingMiner();
export const thinkingRepository = new ThinkingRepository();
