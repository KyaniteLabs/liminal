#!/usr/bin/env tsx
/**
 * Combined Campaign Report Generator
 *
 * Reads report.json from all campaign directories and produces
 * a unified cross-campaign analysis with model comparison.
 *
 * Usage: tsx scripts/campaign-combined-report.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface RunResult {
  model?: string;
  round: number;
  domain: string;
  success: boolean;
  duration: number;
  codeLength: number;
  error?: string;
  // Reasoning telemetry
  reasoning?: string;
  thinking?: string;
  thinkingSource?: string;
  reasoningQuality?: number;
  recoveredFromThinking?: boolean;
  detectedPatterns?: string[];
  timestamp: string;
}

interface ModelStats {
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  byDomain: Record<string, { success: boolean; duration: number; codeLength: number; error?: string }[]>;
}

interface OllamaReport {
  models: string[];
  timestamp: string;
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  resultsByModel: Record<string, ModelStats>;
  results: RunResult[];
}

interface MiniMaxReport {
  model: string;
  timestamp: string;
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  resultsByDomain: Record<string, { success: number; failure: number; avgDuration: number; avgCodeLength: number }>;
  results: RunResult[];
}

interface CombinedModelResult {
  model: string;
  source: string; // 'minimax-cloud' | 'ollama-cloud' | 'ollama-local'
  totalRuns: number;
  successes: number;
  failures: number;
  successRate: number;
  avgDuration: number;
  avgCodeLength: number;
  domainResults: Record<string, { ok: number; fail: number; avgDuration: number }>;
  errorBreakdown: Record<string, number>;
  // Reasoning telemetry
  reasoningTelemetry: {
    runsWithThinking: number;
    avgThinkingLength: number;
    avgReasoningQuality: number;
    recoveryRate: number;
    topPatterns: { pattern: string; count: number }[];
    thinkingSources: Record<string, number>;
  };
}

interface CombinedReport {
  generatedAt: string;
  campaignsAnalyzed: number;
  totalRuns: number;
  totalSuccesses: number;
  overallSuccessRate: number;
  models: CombinedModelResult[];
  domainSummary: Record<string, { totalRuns: number; successRate: number; bestModel: string; worstModel: string }>;
}

const CAMPAIGN_DIRS = [
  { path: 'dogfood-campaign-2026-04-04T07-21-29', type: 'minimax-cloud' },
  { path: 'dogfood-campaign-ollama-2026-04-04T07-47-00', type: 'ollama-cloud' },
  { path: 'dogfood-campaign-local-2026-04-04T07-59-30', type: 'ollama-local' },
];

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii', 'tone'];

function loadJSONL(path: string): RunResult[] {
  try {
    const content = readFileSync(path, 'utf-8');
    return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

function analyzeModel(name: string, source: string, results: RunResult[]): CombinedModelResult {
  const ok = results.filter(r => r.success);
  const fail = results.filter(r => !r.success);

  const domainResults: CombinedModelResult['domainResults'] = {};
  for (const domain of DOMAINS) {
    const dr = results.filter(r => r.domain === domain);
    const dok = dr.filter(r => r.success);
    domainResults[domain] = {
      ok: dok.length,
      fail: dr.length - dok.length,
      avgDuration: dr.length > 0 ? dr.reduce((s, r) => s + r.duration, 0) / dr.length : 0,
    };
  }

  const errorBreakdown: Record<string, number> = {};
  for (const r of fail) {
    const err = r.error || 'unknown';
    const key = err.slice(0, 60);
    errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
  }

  // Reasoning telemetry
  const withThinking = results.filter(r => r.thinking || r.reasoning);
  const patternCounts: Record<string, number> = {};
  for (const r of results) {
    for (const p of r.detectedPatterns || []) {
      patternCounts[p] = (patternCounts[p] || 0) + 1;
    }
  }
  const thinkingSources: Record<string, number> = {};
  for (const r of results) {
    const src = r.thinkingSource || 'none';
    thinkingSources[src] = (thinkingSources[src] || 0) + 1;
  }

  const reasoningTelemetry: CombinedModelResult['reasoningTelemetry'] = {
    runsWithThinking: withThinking.length,
    avgThinkingLength: withThinking.length > 0
      ? withThinking.reduce((s, r) => s + (r.thinking || r.reasoning || '').length, 0) / withThinking.length
      : 0,
    avgReasoningQuality: results.filter(r => r.reasoningQuality != null).length > 0
      ? results.filter(r => r.reasoningQuality != null).reduce((s, r) => s + (r.reasoningQuality || 0), 0) / results.filter(r => r.reasoningQuality != null).length
      : 0,
    recoveryRate: results.filter(r => r.recoveredFromThinking).length / Math.max(results.length, 1),
    topPatterns: Object.entries(patternCounts)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    thinkingSources,
  };

  return {
    model: name,
    source,
    totalRuns: results.length,
    successes: ok.length,
    failures: fail.length,
    successRate: results.length > 0 ? ok.length / results.length : 0,
    avgDuration: results.length > 0 ? results.reduce((s, r) => s + r.duration, 0) / results.length : 0,
    avgCodeLength: ok.length > 0 ? ok.reduce((s, r) => s + r.codeLength, 0) / ok.length : 0,
    domainResults,
    errorBreakdown,
    reasoningTelemetry,
  };
}

function main() {
  const allModelResults: Map<string, { source: string; results: RunResult[] }> = new Map();

  let campaignsAnalyzed = 0;

  for (const { path, type } of CAMPAIGN_DIRS) {
    const reportPath = join(path, 'report.json');
    const jsonlPath = join(path, 'results.jsonl');

    try {
      // Try report.json first
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));

      if (report.results) {
        for (const r of report.results) {
          const model = r.model || report.model || 'unknown';
          if (!allModelResults.has(model)) {
            allModelResults.set(model, { source: type, results: [] });
          }
          allModelResults.get(model)!.results.push(r);
        }
      } else if (report.resultsByDomain) {
        const model = report.model;
        const results = loadJSONL(jsonlPath);
        if (!allModelResults.has(model)) {
          allModelResults.set(model, { source: type, results: [] });
        }
        allModelResults.get(model)!.results.push(...results);
      }
      campaignsAnalyzed++;
    } catch {
      // Fall back to JSONL-only (e.g. campaign still running, no report.json yet)
      const results = loadJSONL(jsonlPath);
      if (results.length > 0) {
        console.log(`  (JSONL fallback for ${path}: ${results.length} runs)`);
        for (const r of results) {
          const model = r.model || 'unknown';
          if (!allModelResults.has(model)) {
            allModelResults.set(model, { source: type, results: [] });
          }
          allModelResults.get(model)!.results.push(r);
        }
        campaignsAnalyzed++;
      }
    }
  }

  // Build per-model analysis
  const models: CombinedModelResult[] = [];
  for (const [name, { source, results }] of allModelResults) {
    models.push(analyzeModel(name, source, results));
  }

  // Sort by success rate descending
  models.sort((a, b) => b.successRate - a.successRate);

  // Domain summary
  const domainSummary: CombinedReport['domainSummary'] = {};
  for (const domain of DOMAINS) {
    const domainModels = models.filter(m => m.domainResults[domain]);
    const totalRuns = domainModels.reduce((s, m) => s + m.domainResults[domain].ok + m.domainResults[domain].fail, 0);
    const totalOk = domainModels.reduce((s, m) => s + m.domainResults[domain].ok, 0);

    const bestRate = domainModels
      .filter(m => m.domainResults[domain].ok + m.domainResults[domain].fail > 0)
      .map(m => ({ name: m.model, rate: m.domainResults[domain].ok / (m.domainResults[domain].ok + m.domainResults[domain].fail) }))
      .sort((a, b) => b.rate - a.rate);

    domainSummary[domain] = {
      totalRuns,
      successRate: totalRuns > 0 ? totalOk / totalRuns : 0,
      bestModel: bestRate[0]?.name || 'N/A',
      worstModel: bestRate[bestRate.length - 1]?.name || 'N/A',
    };
  }

  const totalRuns = models.reduce((s, m) => s + m.totalRuns, 0);
  const totalSuccesses = models.reduce((s, m) => s + m.successes, 0);

  const report: CombinedReport = {
    generatedAt: new Date().toISOString(),
    campaignsAnalyzed,
    totalRuns,
    totalSuccesses,
    overallSuccessRate: totalRuns > 0 ? totalSuccesses / totalRuns : 0,
    models,
    domainSummary,
  };

  writeFileSync('dogfood-combined-report.json', JSON.stringify(report, null, 2));

  // ── Print summary ──
  console.log(`\n╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  COMBINED CAMPAIGN REPORT`);
  console.log(`║  ${campaignsAnalyzed} campaigns | ${models.length} models | ${totalRuns} total runs`);
  console.log(`║  Overall: ${totalSuccesses}/${totalRuns} (${(report.overallSuccessRate * 100).toFixed(1)}%)`);
  console.log(`╠══════════════════════════════════════════════════════════════════════╣`);
  console.log(`║`);
  console.log(`║  MODEL RANKINGS (by success rate):`);
  console.log(`║`);

  for (const m of models) {
    const bar = '█'.repeat(Math.round(m.successRate * 20));
    const barEmpty = '░'.repeat(20 - Math.round(m.successRate * 20));
    console.log(`║  ${m.model.padEnd(28)} ${bar}${barEmpty} ${m.successes}/${m.totalRuns} (${(m.successRate * 100).toFixed(0)}%)`);
    console.log(`║    avg ${(m.avgDuration / 1000).toFixed(1)}s | avg code ${Math.round(m.avgCodeLength)} chars | source: ${m.source}`);
  }

  console.log(`║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════╣`);
  console.log(`║`);
  console.log(`║  DOMAIN ANALYSIS:`);
  console.log(`║`);

  for (const domain of DOMAINS) {
    const d = domainSummary[domain];
    const bar = '█'.repeat(Math.round(d.successRate * 20));
    const barEmpty = '░'.repeat(20 - Math.round(d.successRate * 20));
    console.log(`║  ${domain.padEnd(10)} ${bar}${barEmpty} ${(d.successRate * 100).toFixed(0)}% (${d.totalRuns} runs)`);
    console.log(`║    Best: ${d.bestModel} | Worst: ${d.worstModel}`);
  }

  console.log(`║`);
  console.log(`╠══════════════════════════════════════════════════════════════════════╣`);
  console.log(`║`);
  console.log(`║  ERROR PATTERNS:`);
  console.log(`║`);

  const allErrors: Record<string, number> = {};
  for (const m of models) {
    for (const [err, count] of Object.entries(m.errorBreakdown)) {
      allErrors[err] = (allErrors[err] || 0) + count;
    }
  }
  const sortedErrors = Object.entries(allErrors).sort((a, b) => b[1] - a[1]);
  for (const [err, count] of sortedErrors.slice(0, 8)) {
    console.log(`║  ${count}× ${err}`);
  }

  console.log(`║`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
  console.log(`\nOutput: dogfood-combined-report.json`);
}

main();
