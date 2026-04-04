#!/usr/bin/env tsx
/**
 * Automated Dogfood Report Generator
 *
 * Reads dogfood-report.json and ~/.liminal/failures/ to generate
 * a comprehensive Markdown report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface DogfoodResult {
  domain: string;
  model: string;
  success: boolean;
  code: string;
  outputPath: string;
  error?: string;
  duration: number;
}

interface DogfoodReport {
  timestamp: string;
  total: number;
  success: number;
  failed: number;
  results: DogfoodResult[];
}

interface FailureRecord {
  model: string;
  domain: string;
  prompt: string;
  code: string;
  error: string;
  errorType?: string;
  validationErrors?: string[];
  thinking?: string;
  duration: number;
  id: string;
  timestamp: string;
  sessionId: string;
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function loadReport(): DogfoodReport {
  const reportPath = path.join(PROJECT_ROOT, 'dogfood-report.json');
  const fallbackPath = path.join(PROJECT_ROOT, 'dogfood-temp', 'sample-report.json');

  if (fs.existsSync(reportPath)) {
    const raw = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(raw) as DogfoodReport;
  }

  if (fs.existsSync(fallbackPath)) {
    console.log(`⚠️  dogfood-report.json not found. Using fallback: ${fallbackPath}`);
    const raw = fs.readFileSync(fallbackPath, 'utf-8');
    return JSON.parse(raw) as DogfoodReport;
  }

  throw new Error(
    'No dogfood-report.json found and no fallback available at dogfood-temp/sample-report.json'
  );
}

function loadRecentFailures(): FailureRecord[] {
  const failuresDir = path.join(os.homedir(), '.liminal', 'failures');
  if (!fs.existsSync(failuresDir)) {
    return [];
  }

  const files = fs.readdirSync(failuresDir).filter(f => f.endsWith('.json'));
  // Sort by filename (timestamp prefix) descending and take the most recent 500
  files.sort((a, b) => b.localeCompare(a));
  const recentFiles = files.slice(0, 500);

  const failures: FailureRecord[] = [];
  for (const file of recentFiles) {
    try {
      const raw = fs.readFileSync(path.join(failuresDir, file), 'utf-8');
      failures.push(JSON.parse(raw) as FailureRecord);
    } catch {
      // ignore malformed files
    }
  }
  return failures;
}

function buildDomainBreakdown(report: DogfoodReport): string {
  const byDomain = new Map<string, { success: number; failed: number }>();
  for (const r of report.results) {
    const cur = byDomain.get(r.domain) || { success: 0, failed: 0 };
    if (r.success) {
      cur.success++;
    } else {
      cur.failed++;
    }
    byDomain.set(r.domain, cur);
  }

  const rows: string[] = [];
  for (const [domain, stats] of byDomain) {
    const total = stats.success + stats.failed;
    const rate = total > 0 ? ((stats.success / total) * 100).toFixed(1) : '0.0';
    rows.push(`| ${domain} | ${stats.success} | ${stats.failed} | ${rate}% |`);
  }

  return [
    '### Section 2: Domain Breakdown',
    '',
    '| Domain | Success | Failed | Rate % |',
    '|--------|---------|--------|--------|',
    ...rows,
    '',
  ].join('\n');
}

function buildModelBreakdown(report: DogfoodReport): string {
  const byModel = new Map<string, { success: number; failed: number }>();
  for (const r of report.results) {
    const cur = byModel.get(r.model) || { success: 0, failed: 0 };
    if (r.success) {
      cur.success++;
    } else {
      cur.failed++;
    }
    byModel.set(r.model, cur);
  }

  const rows: string[] = [];
  for (const [model, stats] of byModel) {
    const total = stats.success + stats.failed;
    const rate = total > 0 ? ((stats.success / total) * 100).toFixed(1) : '0.0';
    rows.push(`| ${model} | ${stats.success} | ${stats.failed} | ${rate}% |`);
  }

  return [
    '### Section 3: Model Breakdown',
    '',
    '| Model | Success | Failed | Rate % |',
    '|-------|---------|--------|--------|',
    ...rows,
    '',
  ].join('\n');
}

function buildFailurePatterns(failures: FailureRecord[]): string {
  const groups = new Map<string, number>();
  for (const f of failures) {
    const key = (f.error || 'Unknown error').slice(0, 50);
    groups.set(key, (groups.get(key) || 0) + 1);
  }

  const sorted = Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const rows = sorted.map(([pattern, count], idx) => {
    return `${idx + 1}. **\`${pattern.replace(/`/g, '\\`')}\`** — ${count} occurrence${count === 1 ? '' : 's'}`;
  });

  return [
    '### Section 4: Top Failure Patterns',
    '',
    ...(rows.length > 0 ? rows : ['No failure patterns detected.']),
    '',
  ].join('\n');
}

function buildRecommendations(report: DogfoodReport, failures: FailureRecord[]): string {
  const recs: string[] = [];
  const rate = report.total > 0 ? (report.success / report.total) * 100 : 0;

  if (rate < 50) {
    recs.push('- **Critical:** investigate provider config and validation');
  }

  const byDomain = new Map<string, { success: number; failed: number }>();
  for (const r of report.results) {
    const cur = byDomain.get(r.domain) || { success: 0, failed: 0 };
    if (r.success) cur.success++;
    else cur.failed++;
    byDomain.set(r.domain, cur);
  }

  for (const [domain, stats] of byDomain) {
    const total = stats.success + stats.failed;
    if (total > 0 && stats.success === 0) {
      recs.push(`- **Focus on ${domain} generator** — 0% success rate`);
    }
  }

  if (failures.length > 1000) {
    recs.push('- **Pattern detection is highly active** — over 1000 recent failures logged');
  }

  return [
    '### Section 5: Recommendations',
    '',
    ...(recs.length > 0 ? recs : ['- No critical recommendations at this time.']),
    '',
  ].join('\n');
}

function generateReport(): void {
  const report = loadReport();
  const failures = loadRecentFailures();

  const successRate = report.total > 0 ? ((report.success / report.total) * 100).toFixed(1) : '0.0';
  const lastRun = report.timestamp || new Date().toISOString();

  const lines: string[] = [
    '# Dogfood Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '### Section 1: Executive Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Total tests | ${report.total} |`,
    `| Success count | ${report.success} |`,
    `| Failed count | ${report.failed} |`,
    `| Success rate | ${successRate}% |`,
    `| Last run | ${lastRun} |`,
    '',
    buildDomainBreakdown(report),
    buildModelBreakdown(report),
    buildFailurePatterns(failures),
    buildRecommendations(report, failures),
  ];

  const outputFile = path.join(PROJECT_ROOT, `dogfood-report-${formatDate(new Date())}.md`);
  fs.writeFileSync(outputFile, lines.join('\n'), 'utf-8');
  console.log(`✅ Report written to: ${outputFile}`);
}

generateReport();
