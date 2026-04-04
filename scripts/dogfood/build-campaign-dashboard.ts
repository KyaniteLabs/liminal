#!/usr/bin/env tsx
/**
 * Build Campaign Dashboard HTML
 *
 * Reads dogfood-combined-report.json, enriches with domain-level data,
 * and injects into the HTML template to produce a self-contained dashboard.
 *
 * Usage: tsx scripts/build-campaign-dashboard.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Read the combined report
const report = JSON.parse(readFileSync('dogfood-combined-report.json', 'utf-8'));

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii', 'tone'];

// Build enriched domain summary from model data
const domainSummary: Record<string, { totalRuns: number; successes: number; successRate: number; avgDuration: number; bestModel: string; worstModel: string }> = {};

for (const domain of DOMAINS) {
  let totalRuns = 0, successes = 0, totalDuration = 0;
  let bestRate = -1, worstRate = 2, bestModel = '', worstModel = '';
  for (const model of report.models) {
    const dr = model.domainResults[domain];
    if (dr) {
      const runs = dr.ok + dr.fail;
      totalRuns += runs;
      successes += dr.ok;
      totalDuration += dr.avgDuration * runs;
      const rate = runs > 0 ? dr.ok / runs : 0;
      if (rate > bestRate) { bestRate = rate; bestModel = model.model; }
      if (rate < worstRate) { worstRate = rate; worstModel = model.model; }
    }
  }
  domainSummary[domain] = {
    totalRuns,
    successes,
    successRate: totalRuns > 0 ? successes / totalRuns : 0,
    avgDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
    bestModel,
    worstModel,
  };
}

const dashboardData = {
  generatedAt: report.generatedAt,
  campaignsAnalyzed: report.campaignsAnalyzed ?? report.campaignsAnalyzed,
  totalRuns: report.totalRuns,
  totalSuccesses: report.totalSuccesses,
  overallSuccessRate: report.overallSuccessRate,
  models: report.models.map((m: any) => ({
    model: m.model,
    source: m.source,
    totalRuns: m.totalRuns,
    successes: m.successes,
    failures: m.failures,
    successRate: m.successRate,
    avgDuration: m.avgDuration,
    avgCodeLength: m.avgCodeLength,
    domainResults: m.domainResults,
    errorBreakdown: m.errorBreakdown,
  })),
  domainSummary,
};

// Read the HTML template
const template = readFileSync('scripts/campaign-dashboard.html', 'utf-8');

// Inject the data
const html = template.replace('{/* DATA_INJECTION */}', JSON.stringify(dashboardData));

// Write the output
writeFileSync('dogfood-campaign-dashboard.html', html);
console.log(`Dashboard written to dogfood-campaign-dashboard.html (${(html.length / 1024).toFixed(0)} KB)`);
console.log(`  ${report.models.length} models | ${report.totalRuns} runs | ${(report.overallSuccessRate * 100).toFixed(1)}% overall`);
