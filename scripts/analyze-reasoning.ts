#!/usr/bin/env tsx
/**
 * Reasoning Trace Analysis Tool
 * 
 * Analyzes captured reasoning traces to identify patterns,
 * generate insights, and suggest system improvements.
 * 
 * Usage:
 *   npx tsx scripts/analyze-reasoning.ts [options]
 *   
 * Options:
 *   --session <id>     Analyze specific session
 *   --pattern <type>   Filter by pattern type
 *   --recent <n>       Analyze last n traces
 *   --summary          Show summary statistics
 *   --export <file>    Export to JSON file
 */

import { ReasoningCapture, type ReasoningTrace, type ReasoningPatternType, REASONING_PATTERNS } from '../src/llm/ReasoningCapture.js';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const args = process.argv.slice(2);

interface AnalysisOptions {
  sessionId?: string;
  patternType?: ReasoningPatternType;
  recent?: number;
  summary?: boolean;
  exportFile?: string;
}

function parseArgs(): AnalysisOptions {
  const options: AnalysisOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--session':
        options.sessionId = args[++i];
        break;
      case '--pattern':
        options.patternType = args[++i] as ReasoningPatternType;
        break;
      case '--recent':
        options.recent = parseInt(args[++i], 10);
        break;
      case '--summary':
        options.summary = true;
        break;
      case '--export':
        options.exportFile = args[++i];
        break;
    }
  }
  
  return options;
}

function loadTraces(sessionId?: string): ReasoningTrace[] {
  const logDir = join(homedir(), '.liminal', 'reasoning');
  
  if (!require('fs').existsSync(logDir)) {
    return [];
  }

  const files = readdirSync(logDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  const traces: ReasoningTrace[] = [];
  
  for (const file of files) {
    try {
      const content = readFileSync(join(logDir, file), 'utf-8');
      const trace = JSON.parse(content) as ReasoningTrace;
      if (!sessionId || trace.sessionId === sessionId) {
        traces.push(trace);
      }
    } catch {
      // Skip invalid files
    }
  }

  return traces;
}

function analyzePatterns(traces: ReasoningTrace[]) {
  const patternCounts: Record<string, { count: number; avgDuration: number; successRate: number }> = {};
  
  for (const trace of traces) {
    for (const pattern of trace.patterns || []) {
      if (!patternCounts[pattern.type]) {
        patternCounts[pattern.type] = { count: 0, avgDuration: 0, successRate: 0 };
      }
      patternCounts[pattern.type].count++;
      patternCounts[pattern.type].avgDuration += trace.duration;
      if (trace.outcome === 'success') {
        patternCounts[pattern.type].successRate++;
      }
    }
  }

  // Calculate averages
  for (const type in patternCounts) {
    const count = patternCounts[type].count;
    patternCounts[type].avgDuration /= count;
    patternCounts[type].successRate /= count;
  }

  return patternCounts;
}

function generateInsights(traces: ReasoningTrace[]): string[] {
  const insights: string[] = [];
  
  // Quality insights
  const lowQualityTraces = traces.filter(t => (t.quality?.score || 0) < 0.3);
  if (lowQualityTraces.length > traces.length * 0.2) {
    insights.push(`⚠️  ${Math.round(lowQualityTraces.length / traces.length * 100)}% of traces have low reasoning quality (< 0.3)`);
  }

  // Timeout insights
  const timeoutTraces = traces.filter(t => t.outcome === 'timeout');
  if (timeoutTraces.length > 0) {
    const avgTimeoutDuration = timeoutTraces.reduce((sum, t) => sum + t.duration, 0) / timeoutTraces.length;
    insights.push(`⏱️  Average timeout duration: ${(avgTimeoutDuration / 1000).toFixed(1)}s`);
    
    // Check for infinite reconsideration in timeouts
    const reconsiderationTimeouts = timeoutTraces.filter(t => 
      t.patterns?.some(p => p.type === 'infinite_reconsideration')
    );
    if (reconsiderationTimeouts.length > timeoutTraces.length * 0.5) {
      insights.push(`🔄 ${Math.round(reconsiderationTimeouts.length / timeoutTraces.length * 100)}% of timeouts involve infinite reconsideration loops`);
    }
  }

  // Model-specific insights
  const modelGroups = new Map<string, ReasoningTrace[]>();
  for (const trace of traces) {
    if (!modelGroups.has(trace.model)) {
      modelGroups.set(trace.model, []);
    }
    modelGroups.get(trace.model)!.push(trace);
  }

  for (const [model, modelTraces] of modelGroups) {
    const successRate = modelTraces.filter(t => t.outcome === 'success').length / modelTraces.length;
    if (successRate < 0.5) {
      insights.push(`📉 Model "${model}" has low success rate: ${(successRate * 100).toFixed(0)}%`);
    }
  }

  // Pattern-based insights
  const patterns = analyzePatterns(traces);
  const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1].count - a[1].count);
  
  if (sortedPatterns.length > 0) {
    const [topPattern, topStats] = sortedPatterns[0];
    insights.push(`🔍 Most common pattern: "${topPattern}" (${topStats.count} occurrences)`);
    
    if (topStats.successRate < 0.3) {
      insights.push(`⚠️  Pattern "${topPattern}" has low success rate (${(topStats.successRate * 100).toFixed(0)}%)`);
    }
  }

  return insights;
}

function printSummary(traces: ReasoningTrace[]) {
  console.log('\n📊 REASONING TRACE ANALYSIS\n');
  console.log('=' .repeat(60));
  
  console.log(`\nTotal Traces: ${traces.length}`);
  
  // Outcome breakdown
  const outcomes = new Map<string, number>();
  for (const trace of traces) {
    outcomes.set(trace.outcome, (outcomes.get(trace.outcome) || 0) + 1);
  }
  
  console.log('\nOutcomes:');
  for (const [outcome, count] of outcomes) {
    const pct = (count / traces.length * 100).toFixed(1);
    console.log(`  ${outcome}: ${count} (${pct}%)`);
  }

  // Quality metrics
  const avgQuality = traces.reduce((sum, t) => sum + (t.quality?.score || 0), 0) / traces.length;
  const avgEfficiency = traces.reduce((sum, t) => sum + (t.quality?.efficiency || 0), 0) / traces.length;
  const avgFocus = traces.reduce((sum, t) => sum + (t.quality?.focus || 0), 0) / traces.length;
  
  console.log('\nQuality Metrics:');
  console.log(`  Average quality score: ${avgQuality.toFixed(3)}`);
  console.log(`  Average efficiency: ${avgEfficiency.toFixed(3)}`);
  console.log(`  Average focus: ${avgFocus.toFixed(3)}`);

  // Duration stats
  const durations = traces.map(t => t.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);
  
  console.log('\nDuration:');
  console.log(`  Average: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log(`  Min: ${(minDuration / 1000).toFixed(1)}s`);
  console.log(`  Max: ${(maxDuration / 1000).toFixed(1)}s`);

  // Pattern analysis
  const patterns = analyzePatterns(traces);
  
  console.log('\nPattern Analysis:');
  const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1].count - a[1].count);
  
  for (const [pattern, stats] of sortedPatterns.slice(0, 5)) {
    console.log(`  ${pattern}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Avg duration: ${(stats.avgDuration / 1000).toFixed(1)}s`);
    console.log(`    Success rate: ${(stats.successRate * 100).toFixed(0)}%`);
  }

  // Insights
  const insights = generateInsights(traces);
  
  if (insights.length > 0) {
    console.log('\n💡 Insights:');
    for (const insight of insights) {
      console.log(`  ${insight}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

function printTraces(traces: ReasoningTrace[], patternType?: ReasoningPatternType) {
  const filteredTraces = patternType 
    ? traces.filter(t => t.patterns?.some(p => p.type === patternType))
    : traces;

  console.log(`\nShowing ${filteredTraces.length} traces${patternType ? ` with pattern "${patternType}"` : ''}:\n`);

  for (const trace of filteredTraces.slice(0, 10)) {
    console.log(`Trace: ${trace.id}`);
    console.log(`  Model: ${trace.model}`);
    console.log(`  Prompt: "${trace.prompt.substring(0, 60)}..."`);
    console.log(`  Outcome: ${trace.outcome}`);
    console.log(`  Duration: ${(trace.duration / 1000).toFixed(1)}s`);
    console.log(`  Quality: ${trace.quality?.score.toFixed(3) || 'N/A'}`);
    
    if (trace.patterns && trace.patterns.length > 0) {
      console.log(`  Patterns: ${trace.patterns.map(p => p.type).join(', ')}`);
    }
    
    console.log();
  }
}

async function main() {
  const options = parseArgs();
  
  console.log('🔍 Loading reasoning traces...');
  const traces = loadTraces(options.sessionId);
  
  if (traces.length === 0) {
    console.log('No reasoning traces found.');
    process.exit(0);
  }

  // Apply recent filter
  const filteredTraces = options.recent 
    ? traces.slice(0, options.recent)
    : traces;

  console.log(`Loaded ${filteredTraces.length} traces`);

  // Print summary
  if (options.summary) {
    printSummary(filteredTraces);
  }

  // Print traces
  printTraces(filteredTraces, options.patternType);

  // Export if requested
  if (options.exportFile) {
    writeFileSync(options.exportFile, JSON.stringify(filteredTraces, null, 2));
    console.log(`\n💾 Exported to ${options.exportFile}`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
