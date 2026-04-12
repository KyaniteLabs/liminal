#!/usr/bin/env tsx
/**
 * Build Comprehensive Campaign Dashboard with Full Telemetry
 *
 * Merges ALL data sources:
 * 1. 4 campaign JSONL files (324 runs)
 * 2. dogfood-campaign/results.json (thinking metrics: thinking_chars, tokens, structural checks)
 * 3. 24 reasoning.txt files (raw thinking traces with pattern analysis)
 * 4. 19 persisted thinking traces (insights, actionItems, quality scores)
 *
 * Output: A single comprehensive HTML dashboard with 30+ visualizations.
 *
 * Usage: tsx scripts/dogfood/build-comprehensive-dashboard.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Config ───

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii', 'tone'];
const DOMAIN_LABELS: Record<string, string> = {
  p5: 'p5.js', glsl: 'GLSL', three: 'Three.js', strudel: 'Strudel',
  hydra: 'Hydra', remotion: 'Revideo', html: 'HTML', ascii: 'ASCII', tone: 'Tone.js',
};

const CAMPAIGN_DIRS = [
  'dogfood-campaign-local-2026-04-04T07-59-30',
  'dogfood-campaign-ollama-2026-04-04T07-47-00',
  'dogfood-campaign-2026-04-04T07-21-29',
  'dogfood-campaign-2026-04-04T07-57-51',
];

// ─── Types ───

interface CampaignRun {
  model: string;
  round: number;
  domain: string;
  success: boolean;
  duration: number;
  codeLength: number;
  code?: string;
  error?: string;
  thinkingSource?: string;
  timestamp: string;
  reasoning?: string;
}

interface ThinkingMetrics {
  thinking_chars: number;
  content_chars: number;
  code_chars: number;
  tokens: number;
  elapsed_s: number;
  score: number;
  has_setup?: boolean;
  has_draw?: boolean;
  has_canvas?: boolean;
}

interface ThinkingTrace {
  model: string;
  domain: string;
  outcome: string;
  thinking: string;
  code: string;
  insights: string[];
  actionItems: string[];
}

interface ReasoningAnalysis {
  charCount: number;
  lineCount: number;
  hasReconsideration: boolean;
  reconsiderationCount: number;
  hasConfusion: boolean;
  confusionCount: number;
  hasOverEngineering: boolean;
  planningSteps: number;
  designDecisions: number;
  selfCorrections: number;
  confidenceScore: number; // 0-1, higher = more confident
  patterns: string[];
}

// ─── Data Loading ───

function loadJSONL(dir: string): CampaignRun[] {
  const path = join(dir, 'results.jsonl');
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

function loadThinkingMetrics(): Map<string, ThinkingMetrics> {
  const map = new Map<string, ThinkingMetrics>();
  const path = 'dogfood-campaign/results.json';
  if (!existsSync(path)) return map;
  const data: ThinkingMetrics[] = JSON.parse(readFileSync(path, 'utf-8'));
  for (const entry of data) {
    const key = `${(entry as any).model}|${(entry as any).domain}`;
    map.set(key, entry);
  }
  return map;
}

function loadReasoningFiles(): Map<string, string> {
  const map = new Map<string, string>();
  const base = 'dogfood-campaign';
  if (!existsSync(base)) return map;
  const dirs = readdirSync(base, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const rPath = join(base, d.name, 'reasoning.txt');
    if (existsSync(rPath)) {
      map.set(d.name, readFileSync(rPath, 'utf-8'));
    }
  }
  return map;
}

function loadThinkingTraces(): ThinkingTrace[] {
  const traces: ThinkingTrace[] = [];
  const jsonlPath = join(
    process.env.HOME || '/Users/simongonzalezdecruz',
    '.liminal/thinking-traces/generator/2026-04-03.jsonl',
  );
  if (!existsSync(jsonlPath)) return traces;
  const content = readFileSync(jsonlPath, 'utf-8');
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const t = JSON.parse(line);
      traces.push({
        model: t.model,
        domain: t.domain,
        outcome: t.outcome,
        thinking: t.thinking || '',
        code: t.code || '',
        insights: t.insights || [],
        actionItems: t.actionItems || [],
      });
    } catch { /* skip malformed */ }
  }
  return traces;
}

// ─── Reasoning Analysis ───

function analyzeReasoning(text: string): ReasoningAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      charCount: 0, lineCount: 0, hasReconsideration: false, reconsiderationCount: 0,
      hasConfusion: false, confusionCount: 0, hasOverEngineering: false,
      planningSteps: 0, designDecisions: 0, selfCorrections: 0,
      confidenceScore: 0.5, patterns: [],
    };
  }

  const lines = text.split('\n').filter(l => l.trim());
  const lower = text.toLowerCase();

  // Pattern detection
  const reconsiderationPatterns = [
    /wait[,\.]/i, /actually[,\.]/i, /no[,\.]/i, /instead/i, /let me reconsider/i,
    /on second thought/i, /better approach/i, /scratch that/i, /i was wrong/i,
    /but actually/i, /correction/i, /rethinking/i,
  ];
  const confusionPatterns = [
    /i('?m| am) (not )?sure/i, /confused/i, /unclear/i, /ambiguous/i,
    /what does/i, /i don'?t know/i, /uncertain/i, /might be wrong/i,
    /not certain/i, /hard to tell/i, /could be/i,
  ];
  const overEngineeringPatterns = [
    /we could also/i, /alternatively/i, /another approach/i,
    /we can add/i, /let'?s also/i, /might want to/i, /optionally/i,
    /we should also/i, /could additionally/i,
  ];

  const reconsiderationCount = reconsiderationPatterns.reduce(
    (c, p) => c + (lower.match(p) || []).length, 0,
  );
  const confusionCount = confusionPatterns.reduce(
    (c, p) => c + (lower.match(p) || []).length, 0,
  );
  const overEngineeringCount = overEngineeringPatterns.reduce(
    (c, p) => c + (lower.match(p) || []).length, 0,
  );

  // Structure analysis
  const planningSteps = (lower.match(/^[\s]*(\d+[\.\)]|step|first|then|next|finally)/gm) || []).length;
  const designDecisions = (lower.match(/(let'?s|we'?ll|we will|use|choose|go with|opt for)/g) || []).length;
  const selfCorrections = reconsiderationCount + (lower.match(/(fix|correct|adjust|change.*to)/g) || []).length;

  // Confidence score: fewer confusion/reconsideration patterns = higher confidence
  const totalNegative = confusionCount + reconsiderationCount * 0.5;
  const charFactor = Math.min(text.length / 2000, 2); // normalize by length
  const confidenceScore = Math.max(0, Math.min(1, 1 - (totalNegative / (charFactor * 10 + 1))));

  const patterns: string[] = [];
  if (reconsiderationCount > 2) patterns.push('frequent_reconsideration');
  if (confusionCount > 2) patterns.push('confusion');
  if (overEngineeringCount > 3) patterns.push('over_engineering');
  if (planningSteps > 8) patterns.push('detailed_planning');
  if (selfCorrections > 3) patterns.push('self_correcting');
  if (text.length > 10000) patterns.push('verbose_thinking');
  if (text.length > 0 && text.length < 500) patterns.push('minimal_thinking');
  if (designDecisions > 10) patterns.push('many_design_decisions');

  return {
    charCount: text.length,
    lineCount: lines.length,
    hasReconsideration: reconsiderationCount > 0,
    reconsiderationCount,
    hasConfusion: confusionCount > 0,
    confusionCount,
    hasOverEngineering: overEngineeringCount > 3,
    planningSteps,
    designDecisions,
    selfCorrections,
    confidenceScore,
    patterns,
  };
}

// ─── Main ───

function main() {
  console.log('Loading data sources...');

  // 1. Load campaign runs
  const allRuns: CampaignRun[] = [];
  for (const dir of CAMPAIGN_DIRS) {
    if (existsSync(dir)) {
      const runs = loadJSONL(dir);
      console.log(`  ${dir}: ${runs.length} runs`);
      allRuns.push(...runs);
    }
  }
  console.log(`  Total runs: ${allRuns.length}`);

  // 2. Load thinking metrics from original campaign
  const thinkingMetrics = loadThinkingMetrics();
  console.log(`  Thinking metrics: ${thinkingMetrics.size} model-domain entries`);

  // 3. Load reasoning files
  const reasoningFiles = loadReasoningFiles();
  console.log(`  Reasoning files: ${reasoningFiles.size}`);

  // 4. Load thinking traces with insights
  const thinkingTraces = loadThinkingTraces();
  console.log(`  Thinking traces: ${thinkingTraces.length}`);

  // ── Aggregate model-level data ──

  const modelMap = new Map<string, {
    model: string;
    source: string;
    runs: CampaignRun[];
  }>();

  for (const run of allRuns) {
    if (!modelMap.has(run.model)) {
      const source = run.thinkingSource === 'local' ? 'ollama-local' :
                     run.thinkingSource === 'ollama-cloud' ? 'ollama-cloud' : 'cloud-api';
      modelMap.set(run.model, { model: run.model, source, runs: [] });
    }
    modelMap.get(run.model)!.runs.push(run);
  }

  const models = [...modelMap.values()].map(m => {
    const runs = m.runs;
    const successes = runs.filter(r => r.success).length;
    const failures = runs.length - successes;
    const successRate = runs.length > 0 ? successes / runs.length : 0;
    const avgDuration = runs.length > 0
      ? runs.reduce((s, r) => s + r.duration, 0) / runs.length
      : 0;
    const successfulRuns = runs.filter(r => r.success);
    const avgCodeLength = successfulRuns.length > 0
      ? successfulRuns.reduce((s, r) => s + r.codeLength, 0) / successfulRuns.length
      : 0;

    // Domain results
    const domainResults: Record<string, { ok: number; fail: number; avgDuration: number; avgCodeLength: number }> = {};
    for (const domain of DOMAINS) {
      const dr = runs.filter(r => r.domain === domain);
      if (dr.length > 0) {
        const ok = dr.filter(r => r.success).length;
        const fail = dr.length - ok;
        domainResults[domain] = {
          ok,
          fail,
          avgDuration: dr.reduce((s, r) => s + r.duration, 0) / dr.length,
          avgCodeLength: dr.filter(r => r.success).length > 0
            ? dr.filter(r => r.success).reduce((s, r) => s + r.codeLength, 0) / dr.filter(r => r.success).length
            : 0,
        };
      }
    }

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    for (const r of runs.filter(r => !r.success)) {
      const err = (r.error || 'Unknown error').slice(0, 80);
      errorBreakdown[err] = (errorBreakdown[err] || 0) + 1;
    }

    return {
      model: m.model,
      source: m.source,
      totalRuns: runs.length,
      successes,
      failures,
      successRate,
      avgDuration,
      avgCodeLength,
      domainResults,
      errorBreakdown,
    };
  }).sort((a, b) => b.successRate - a.successRate);

  // ── Thinking metrics enrichment (from dogfood-campaign/results.json) ──

  const thinkingData: {
    model: string;
    domain: string;
    thinking_chars: number;
    content_chars: number;
    code_chars: number;
    tokens: number;
    elapsed_s: number;
    score: number;
    thinking_ratio: number; // thinking_chars / (thinking_chars + content_chars)
  }[] = [];

  for (const [key, metrics] of thinkingMetrics) {
    const [model, domain] = key.split('|');
    thinkingData.push({
      model,
      domain,
      thinking_chars: metrics.thinking_chars,
      content_chars: metrics.content_chars,
      code_chars: metrics.code_chars,
      tokens: metrics.tokens,
      elapsed_s: metrics.elapsed_s,
      score: metrics.score,
      thinking_ratio: metrics.thinking_chars + metrics.content_chars > 0
        ? metrics.thinking_chars / (metrics.thinking_chars + metrics.content_chars)
        : 0,
    });
  }

  // ── Reasoning analysis (from reasoning.txt files) ──

  const reasoningAnalyses: {
    dirName: string;
    model: string;
    domain: string;
    analysis: ReasoningAnalysis;
  }[] = [];

  for (const [dirName, text] of reasoningFiles) {
    // Parse model and domain from directory name
    const parts = dirName.split('-');
    let model = '';
    let domain = '';
    if (dirName.startsWith('minimax')) { model = 'MiniMax-M2.7'; domain = parts.slice(2).join(''); }
    else if (dirName.startsWith('deepseek')) { model = 'deepseek-v3.2:cloud'; domain = parts.slice(3).join(''); }
    else if (dirName.startsWith('gemma426ba4bit')) { model = 'gemma4:26b-a4bit'; domain = parts.slice(1).join(''); }
    else if (dirName.startsWith('gemma4')) { model = 'gemma4'; domain = parts.slice(1).join(''); }
    else if (dirName.startsWith('lfm2512binstruct')) { model = 'lfm2.5-thinking:1.2b'; domain = parts.slice(1).join(''); }
    else if (dirName.startsWith('qwen352b')) { model = 'qwen3.5:2b'; domain = parts.slice(1).join(''); }
    else if (dirName.startsWith('qwen35-2b')) { model = 'qwen3.5:2b-alt'; domain = parts.slice(2).join(''); }
    else if (dirName.startsWith('qwen35')) { model = 'qwen3.5:cloud'; domain = parts.slice(1).join(''); }
    else { model = dirName; domain = 'unknown'; }

    reasoningAnalyses.push({
      dirName,
      model,
      domain,
      analysis: analyzeReasoning(text),
    });
  }

  // ── Thinking trace insights ──

  const traceInsights: {
    byModel: Record<string, { count: number; avgThinkingLen: number; avgCodeLen: number; insightCounts: Record<string, number>; actionItemCounts: Record<string, number> }>;
    allInsights: Record<string, number>;
    allActionItems: Record<string, number>;
  } = {
    byModel: {},
    allInsights: {},
    allActionItems: {},
  };

  for (const trace of thinkingTraces) {
    const m = trace.model;
    if (!traceInsights.byModel[m]) {
      traceInsights.byModel[m] = { count: 0, avgThinkingLen: 0, avgCodeLen: 0, insightCounts: {}, actionItemCounts: {} };
    }
    const md = traceInsights.byModel[m];
    md.count++;
    md.avgThinkingLen += trace.thinking.length;
    md.avgCodeLen += trace.code.length;

    for (const ins of trace.insights) {
      md.insightCounts[ins] = (md.insightCounts[ins] || 0) + 1;
      traceInsights.allInsights[ins] = (traceInsights.allInsights[ins] || 0) + 1;
    }
    for (const ai of trace.actionItems) {
      md.actionItemCounts[ai] = (md.actionItemCounts[ai] || 0) + 1;
      traceInsights.allActionItems[ai] = (traceInsights.allActionItems[ai] || 0) + 1;
    }
  }

  // Finalize averages
  for (const md of Object.values(traceInsights.byModel)) {
    md.avgThinkingLen = md.count > 0 ? md.avgThinkingLen / md.count : 0;
    md.avgCodeLen = md.count > 0 ? md.avgCodeLen / md.count : 0;
  }

  // ── Duration analysis ──

  const durationByModel: Record<string, { avg: number; min: number; max: number; p50: number; p95: number; stddev: number }> = {};
  for (const [modelName, data] of modelMap) {
    const durations = data.runs.map(r => r.duration).sort((a, b) => a - b);
    if (durations.length === 0) continue;
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    const variance = durations.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / durations.length;
    durationByModel[modelName] = {
      avg,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      stddev: Math.sqrt(variance),
    };
  }

  // ── Domain-level aggregates ──

  const domainSummary: Record<string, {
    totalRuns: number;
    successes: number;
    successRate: number;
    avgDuration: number;
    avgCodeLength: number;
    bestModel: string;
    worstModel: string;
    errorTypes: Record<string, number>;
  }> = {};

  for (const domain of DOMAINS) {
    const domainRuns = allRuns.filter(r => r.domain === domain);
    const successes = domainRuns.filter(r => r.success).length;
    const successfulRuns = domainRuns.filter(r => r.success);

    let bestRate = -1, worstRate = 2, bestModel = '', worstModel = '';
    for (const m of modelMap.values()) {
      const dr = m.runs.filter(r => r.domain === domain);
      if (dr.length > 0) {
        const rate = dr.filter(r => r.success).length / dr.length;
        if (rate > bestRate) { bestRate = rate; bestModel = m.model; }
        if (rate < worstRate) { worstRate = rate; worstModel = m.model; }
      }
    }

    const errorTypes: Record<string, number> = {};
    for (const r of domainRuns.filter(r => !r.success)) {
      const err = (r.error || 'Unknown').slice(0, 60);
      errorTypes[err] = (errorTypes[err] || 0) + 1;
    }

    domainSummary[domain] = {
      totalRuns: domainRuns.length,
      successes,
      successRate: domainRuns.length > 0 ? successes / domainRuns.length : 0,
      avgDuration: domainRuns.length > 0 ? domainRuns.reduce((s, r) => s + r.duration, 0) / domainRuns.length : 0,
      avgCodeLength: successfulRuns.length > 0 ? successfulRuns.reduce((s, r) => s + r.codeLength, 0) / successfulRuns.length : 0,
      bestModel,
      worstModel,
      errorTypes,
    };
  }

  // ── Round consistency (does model degrade/improve across rounds?) ──

  const roundConsistency: Record<string, { round1: number; round2: number; round3: number; variance: number }> = {};
  for (const m of modelMap.values()) {
    const byRound = [1, 2, 3].map(r => {
      const rr = m.runs.filter(run => run.round === r);
      return rr.length > 0 ? rr.filter(run => run.success).length / rr.length : 0;
    });
    const avg = byRound.reduce((s, r) => s + r, 0) / 3;
    const variance = byRound.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / 3;
    roundConsistency[m.model] = {
      round1: byRound[0],
      round2: byRound[1],
      round3: byRound[2],
      variance,
    };
  }

  // ── Build final data object ──

  const dashboardData = {
    generatedAt: new Date().toISOString(),
    totalRuns: allRuns.length,
    totalSuccesses: allRuns.filter(r => r.success).length,
    overallSuccessRate: allRuns.length > 0 ? allRuns.filter(r => r.success).length / allRuns.length : 0,
    models,
    domainSummary,
    // New telemetry sections
    thinkingMetrics: thinkingData,
    reasoningAnalyses,
    traceInsights,
    durationAnalysis: durationByModel,
    roundConsistency,
    rawData: {
      thinkingTracesCount: thinkingTraces.length,
      reasoningFilesCount: reasoningFiles.size,
      thinkingMetricsCount: thinkingMetrics.size,
    },
  };

  // ── Inject into HTML template ──

  const templatePath = 'artifacts/campaign-dashboard.html';
  if (!existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }
  const template = readFileSync(templatePath, 'utf-8');

  const html = template.replace('{/* DATA_INJECTION */}', JSON.stringify(dashboardData));
  const outPath = 'dogfood-campaign-dashboard.html';
  writeFileSync(outPath, html);

  console.log(`\nDashboard written to ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);
  console.log(`  ${models.length} models | ${allRuns.length} runs | ${(dashboardData.overallSuccessRate * 100).toFixed(1)}% overall`);
  console.log(`  ${thinkingData.length} thinking metrics | ${reasoningAnalyses.length} reasoning analyses | ${thinkingTraces.length} trace insights`);
}

main();
