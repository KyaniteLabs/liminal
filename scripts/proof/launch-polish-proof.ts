#!/usr/bin/env tsx
/**
 * Launch polish proof — issue #457.
 *
 * Orchestrates a full creative-session proof bundle that a new user can
 * follow from prompt to shareable artifact. Runs existing proof scripts,
 * collects their receipts, and assembles a single bundle with:
 *   - documented command sequence
 *   - generated artifacts and previews
 *   - cognitive loop receipts
 *   - provider/model truth
 *   - honest caveats
 *
 * Modes:
 *   --mode=deterministic  (default) — runs offline/deterministic checks only
 *   --mode=live           — includes live provider smoke + Studio gauntlet
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { collectRepositoryMarketReadinessStatus, formatMarketReadinessStatus } from '../../src/market/MarketReadinessStatus.js';

type ProofMode = 'deterministic' | 'live';

interface ProofCheckResult {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'skip';
  evidence: string;
  durationMs: number;
  receiptPath?: string;
}

interface LaunchProofBundle {
  contract: 'liminal-launch-polish-proof-v1';
  generatedAt: string;
  mode: ProofMode;
  git: { head: string; branch: string; clean: boolean };
  commandSequence: string[];
  checks: ProofCheckResult[];
  passed: boolean;
  blockers: string[];
  caveats: string[];
  followUpIssues: string[];
}

// --- args ---
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};
const mode: ProofMode = getArg('mode') === 'live' ? 'live' : 'deterministic';
const outRoot = getArg('out') || path.join('.omx', 'proof', 'launch-polish');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outRoot, stamp);

// --- helpers ---
function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runCommand(command: string, timeoutMs = 300_000): { ok: boolean; stdout: string; stderr: string; durationMs: number } {
  const started = Date.now();
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LIMINAL_LLM_PROVIDER: process.env.LIMINAL_LLM_PROVIDER || 'glm' },
    });
    return { ok: true, stdout: result.trim(), stderr: '', durationMs: Date.now() - started };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      ok: false,
      stdout: (err.stdout || '').trim().slice(-4000),
      stderr: (err.stderr || '').trim().slice(-4000),
      durationMs: Date.now() - started,
    };
  }
}

function gitInfo(): { head: string; branch: string; clean: boolean } {
  const head = runCommand('git rev-parse HEAD');
  const branch = runCommand('git rev-parse --abbrev-ref HEAD');
  const status = runCommand('git status --porcelain');
  return {
    head: head.stdout,
    branch: branch.stdout,
    clean: status.stdout.trim().length === 0,
  };
}

// --- documented command sequence ---
const commandSequence: string[] = [
  'pnpm install && pnpm build',
  'export LIMINAL_LLM_PROVIDER=glm   # or your provider',
  'liminal "a luminous blue-green particle garden"',
  'pnpm gui                           # Studio: chat + same-screen preview + revision',
  'pnpm tui                           # Operator TUI: diagnostics, receipts, review actions',
  'pnpm proof:cognitive-loop          # Cognitive loop receipts',
  'pnpm proof:live-provider-smoke     # Provider/model truth',
  'pnpm proof:user-surfaces           # User surface E2E',
  'pnpm proof:launch-polish           # This full proof bundle',
  'liminal market status              # Market readiness verdict',
];

// --- checks ---
function checkBuild(): ProofCheckResult {
  const started = Date.now();
  const r = runCommand('pnpm build', 120_000);
  return {
    id: 'build',
    label: 'TypeScript build',
    status: r.ok ? 'pass' : 'fail',
    evidence: r.ok ? 'Build succeeded' : `Build failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
  };
}

function checkTypecheck(): ProofCheckResult {
  const started = Date.now();
  const r = runCommand('pnpm typecheck', 120_000);
  return {
    id: 'typecheck',
    label: 'TypeScript type check',
    status: r.ok ? 'pass' : 'fail',
    evidence: r.ok ? 'No type errors' : `Type errors: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
  };
}

function checkCognitiveLoop(): ProofCheckResult {
  const started = Date.now();
  const receiptDir = path.join(outDir, 'cognitive-loop');
  const r = runCommand(
    `pnpm exec tsx scripts/proof/cognitive-loop-proof.ts --out=${receiptDir}`,
    60_000,
  );
  const receiptPath = path.join(receiptDir, stamp, 'report.json');
  const hasReceipt = fs.existsSync(receiptPath);
  return {
    id: 'cognitive-loop',
    label: 'Cognitive loop receipts',
    status: r.ok && hasReceipt ? 'pass' : 'fail',
    evidence: r.ok
      ? hasReceipt
        ? `Cognitive loop proof passed; report at ${receiptPath}`
        : 'Proof script exited 0 but report.json not found'
      : `Cognitive loop proof failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
    receiptPath: hasReceipt ? receiptPath : undefined,
  };
}

function checkUserSurfaces(): ProofCheckResult {
  const started = Date.now();
  const r = runCommand('pnpm exec tsx scripts/proof/user-surfaces-e2e.ts', 60_000);
  const receiptPath = path.join('.omx', 'proof', 'user-surfaces-e2e.json');
  const hasReceipt = fs.existsSync(receiptPath);
  return {
    id: 'user-surfaces',
    label: 'User surface E2E (bridge + preview)',
    status: r.ok && hasReceipt ? 'pass' : 'fail',
    evidence: r.ok
      ? hasReceipt
        ? 'User surface proof passed; receipt captured'
        : 'Proof script exited 0 but receipt not found'
      : `User surface proof failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
    receiptPath: hasReceipt ? receiptPath : undefined,
  };
}

function checkMarketReadiness(): ProofCheckResult {
  const started = Date.now();
  const status = collectRepositoryMarketReadinessStatus(process.cwd());
  const formatted = formatMarketReadinessStatus(status);
  const receiptPath = path.join(outDir, 'market-readiness.txt');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(receiptPath, formatted, 'utf8');
  return {
    id: 'market-readiness',
    label: 'Market readiness',
    status: status.ready ? 'pass' : 'fail',
    evidence: status.ready
      ? 'Market readiness: READY'
      : `Market readiness: NOT READY — ${status.blockers.join('; ')}`,
    durationMs: Date.now() - started,
    receiptPath,
  };
}

function checkVisualPreviewContract(): ProofCheckResult {
  const started = Date.now();
  const r = runCommand('pnpm exec tsx scripts/proof/visual-output-preview-contract.ts', 30_000);
  return {
    id: 'visual-preview-contract',
    label: 'Visual output preview contract',
    status: r.ok ? 'pass' : 'fail',
    evidence: r.ok
      ? 'Preview contract checks passed'
      : `Preview contract failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
  };
}

function checkLiveProviderSmoke(): ProofCheckResult {
  const started = Date.now();
  const r = runCommand('pnpm exec tsx scripts/proof/live-provider-smoke.ts', 180_000);
  const receiptPath = path.join('.omx', 'proof', 'live-provider-smoke.json');
  const hasReceipt = fs.existsSync(receiptPath);
  let model = 'unknown';
  let provider = 'unknown';
  if (hasReceipt) {
    try {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as { model?: string; provider?: string };
      model = receipt.model || 'unknown';
      provider = receipt.provider || 'unknown';
    } catch { /* keep defaults */ }
  }
  return {
    id: 'live-provider-smoke',
    label: 'Live provider/model truth',
    status: r.ok && hasReceipt ? 'pass' : 'fail',
    evidence: r.ok && hasReceipt
      ? `Provider ${provider}, model ${model}: live smoke passed`
      : `Live provider smoke failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
    receiptPath: hasReceipt ? receiptPath : undefined,
  };
}

function checkStudioGauntlet(): ProofCheckResult {
  const started = Date.now();
  const gauntletOut = path.join(outDir, 'studio-gauntlet');
  const r = runCommand(
    `LIMINAL_GAUNTLET_RUN_ONCE=1 LIMINAL_GAUNTLET_RUNROOT=${gauntletOut} node scripts/proof/studio-launch-gauntlet.mjs`,
    600_000,
  );
  const summaryPath = path.join(gauntletOut, 'summary.json');
  const hasSummary = fs.existsSync(summaryPath);
  return {
    id: 'studio-gauntlet',
    label: 'Studio launch gauntlet (single cycle)',
    status: r.ok && hasSummary ? 'pass' : 'fail',
    evidence: r.ok && hasSummary
      ? 'Studio gauntlet single cycle passed'
      : `Studio gauntlet failed: ${r.stderr.slice(-500)}`,
    durationMs: Date.now() - started,
    receiptPath: hasSummary ? summaryPath : undefined,
  };
}

// --- honest caveats ---
const caveats = [
  'The cognitive loop proof runs in deterministic mode by default; use --mode=live to include real provider write-back.',
  'The Studio gauntlet requires a running LLM provider and headless Chromium; it is skipped in deterministic mode.',
  'Microphone preview smoke uses Playwright fake media; physical microphone path requires manual browser testing.',
  'CI slow browser/e2e jobs are skipped by workflow configuration; focused local browser smoke covers user-facing paths.',
  'Native Revideo rendered video/still capture is follow-up work; code artifacts are generated but not rendered to MP4/PNG.',
  'Public launch recording/post asset is a human/content step, not a code-readiness blocker.',
];

// --- follow-up issue titles ---
const followUpIssues = [
  'Native Revideo rendered video/still capture for public demos',
  'Public launch recording and blog post asset',
  'CI slow browser/e2e job re-enablement after flake reduction',
  'Physical microphone integration test beyond Playwright fake media',
];

// --- main ---
async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Launch polish proof starting (mode=${mode})`);
  console.log(`Output: ${outDir}`);

  const git = gitInfo();
  const checks: ProofCheckResult[] = [];

  // Always-run checks
  console.log('  [1/7] Build...');
  checks.push(checkBuild());
  console.log(`  → ${checks[checks.length - 1].status}`);

  console.log('  [2/7] Typecheck...');
  checks.push(checkTypecheck());
  console.log(`  → ${checks[checks.length - 1].status}`);

  console.log('  [3/7] Cognitive loop proof...');
  checks.push(checkCognitiveLoop());
  console.log(`  → ${checks[checks.length - 1].status}`);

  console.log('  [4/7] User surface E2E...');
  checks.push(checkUserSurfaces());
  console.log(`  → ${checks[checks.length - 1].status}`);

  console.log('  [5/7] Market readiness...');
  checks.push(checkMarketReadiness());
  console.log(`  → ${checks[checks.length - 1].status}`);

  console.log('  [6/7] Visual preview contract...');
  checks.push(checkVisualPreviewContract());
  console.log(`  → ${checks[checks.length - 1].status}`);

  // Live-only checks
  if (mode === 'live') {
    console.log('  [7/7] Live provider smoke...');
    checks.push(checkLiveProviderSmoke());
    console.log(`  → ${checks[checks.length - 1].status}`);

    console.log('  [8/8] Studio launch gauntlet...');
    checks.push(checkStudioGauntlet());
    console.log(`  → ${checks[checks.length - 1].status}`);
  } else {
    checks.push({
      id: 'live-provider-smoke',
      label: 'Live provider/model truth',
      status: 'skip',
      evidence: 'Skipped in deterministic mode; use --mode=live to include',
      durationMs: 0,
    });
    checks.push({
      id: 'studio-gauntlet',
      label: 'Studio launch gauntlet',
      status: 'skip',
      evidence: 'Skipped in deterministic mode; use --mode=live to include',
      durationMs: 0,
    });
  }

  const blockers = checks
    .filter((c) => c.status === 'fail')
    .map((c) => `${c.label}: ${c.evidence}`);

  const passed = blockers.length === 0;

  const bundle: LaunchProofBundle = {
    contract: 'liminal-launch-polish-proof-v1',
    generatedAt: new Date().toISOString(),
    mode,
    git,
    commandSequence,
    checks,
    passed,
    blockers,
    caveats,
    followUpIssues,
  };

  // Write JSON bundle
  const bundlePath = path.join(outDir, 'proof-bundle.json');
  writeJson(bundlePath, bundle);

  // Write human-readable report
  const mdLines = [
    '# Launch Polish Proof — Full Creative Session',
    '',
    `Generated: ${bundle.generatedAt}`,
    `Mode: ${mode}`,
    `Git: ${git.head.slice(0, 12)} on ${git.branch} (${git.clean ? 'clean' : 'dirty'})`,
    `Verdict: **${passed ? 'PASS' : 'FAIL'}**`,
    '',
    '## Documented Command Sequence',
    '',
    'A new user can follow these commands to go from clone to shareable proof:',
    '',
    ...commandSequence.map((cmd, i) => `${i + 1}. \`${cmd}\``),
    '',
    '## Proof Checks',
    '',
    '| # | Check | Status | Duration |',
    '| --- | --- | --- | --- |',
    ...checks.map((c, i) => `| ${i + 1} | ${c.label} | ${c.status === 'pass' ? 'PASS' : c.status === 'skip' ? 'SKIP' : 'FAIL'} | ${(c.durationMs / 1000).toFixed(1)}s |`),
    '',
    '### Evidence',
    '',
    ...checks.map((c) => [`#### ${c.label}`, '', `- Status: ${c.status}`, `- Evidence: ${c.evidence}`, c.receiptPath ? `- Receipt: \`${c.receiptPath}\`` : '', '']).flat(),
    '',
    '## Blockers',
    '',
    ...(blockers.length > 0 ? blockers.map((b) => `- ${b}`) : ['None']),
    '',
    '## Honest Caveats',
    '',
    ...caveats.map((c) => `- ${c}`),
    '',
    '## Follow-up Issues',
    '',
    ...followUpIssues.map((title) => `- ${title}`),
    '',
    '## Proof Bundle',
    '',
    `Full JSON bundle: \`${bundlePath}\``,
  ];
  const mdPath = path.join(outDir, 'report.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

  console.log('');
  console.log(`Launch polish proof: ${passed ? 'PASS' : 'FAIL'}`);
  console.log(`Report: ${mdPath}`);
  console.log(`Bundle: ${bundlePath}`);
  if (blockers.length > 0) {
    console.log('Blockers:');
    blockers.forEach((b) => console.log(`  - ${b}`));
  }
  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
