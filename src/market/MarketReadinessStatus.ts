import fs from 'node:fs';
import path from 'node:path';
import { validateProofReceipt } from '../runtime-core/ProofReceiptValidator.js';

export type MarketReadinessCheckStatus = 'pass' | 'fail' | 'unknown';

export interface MarketReadinessCheck {
  id: string;
  label: string;
  status: MarketReadinessCheckStatus;
  evidence: string;
}

export interface MarketReadinessStatus {
  ready: boolean;
  verdict: 'ready' | 'not-ready';
  checks: MarketReadinessCheck[];
  blockers: string[];
}

export function buildMarketReadinessStatus(input: { checks: MarketReadinessCheck[] }): MarketReadinessStatus {
  const blockers = input.checks
    .filter((check) => check.status !== 'pass')
    .map((check) => `${check.label}: ${check.evidence}`);
  const ready = blockers.length === 0;
  return {
    ready,
    verdict: ready ? 'ready' : 'not-ready',
    checks: input.checks,
    blockers,
  };
}

export function collectRepositoryMarketReadinessStatus(repoRoot = process.cwd()): MarketReadinessStatus {
  const bin = read(path.join(repoRoot, 'bin', 'liminal'));
  const telemetry = read(path.join(repoRoot, 'gui', 'src', 'gui', 'workbenchTelemetry.ts'));
  const app = read(path.join(repoRoot, 'gui', 'src', 'App.tsx'));
  const cliReceipt = read(path.join(repoRoot, 'src', 'cli', 'CognitiveReceiptReporter.ts'));
  const wrappers = read(path.join(repoRoot, 'src', 'core', 'wrappers', 'GenericWrapper.ts'));
  const level6Gate = read(path.join(repoRoot, 'src', 'runtime-core', 'Level6ReleaseGate.ts'));
  const packageJson = read(path.join(repoRoot, 'package.json'));

  const checks: MarketReadinessCheck[] = [
    sourceCheck('natural-cli', 'Natural CLI front door', bin, ['inferNaturalLanguagePrompt', 'liminal "natural language prompt"']),
    sourceCheck('creative-wrappers', 'Creative domain wrapper breadth', wrappers, ['strudel-editor', 'wrapRevideo', 'Hydra', 'Tone']),
    sourceCheck('studio-cognition', 'Studio learning receipts', `${telemetry}\n${app}`, ['latestCognitiveReceipt', 'What Liminal learned', 'liminal-cognitive-receipt']),
    sourceCheck('cli-cognition', 'CLI learning receipts', `${bin}\n${cliReceipt}`, ['writeCliCognitiveReceipt', 'What Liminal learned']),
    sourceCheck('studio-smoke-script', 'Studio smoke script', packageJson, ['proof:studio-smoke']),
    sourceCheck('level6-gate', 'Level 6 release gate', `${bin}\n${level6Gate}`, ['release gate', 'runLevel6ReleaseGate', 'self-improvement-gauntlet', 'creative-domain-gauntlet']),
    liveProviderSmokeCheck(repoRoot),
  ];

  return buildMarketReadinessStatus({ checks });
}

export function formatMarketReadinessStatus(status: MarketReadinessStatus): string {
  const lines = [
    `Market readiness: ${status.ready ? 'READY' : 'NOT READY'}`,
    '',
    'Checks:',
    ...status.checks.map((check) => `- ${check.label}: ${check.status} — ${check.evidence}`),
  ];

  if (status.blockers.length > 0) {
    lines.push('', 'Blocking gaps:', ...status.blockers.map((blocker) => `- ${blocker}`));
  }

  return lines.join('\n');
}

function sourceCheck(id: string, label: string, source: string, needles: string[]): MarketReadinessCheck {
  const missing = needles.filter((needle) => !source.includes(needle));
  return {
    id,
    label,
    status: missing.length === 0 ? 'pass' : 'fail',
    evidence: missing.length === 0 ? `Found ${needles.join(', ')}` : `Missing ${missing.join(', ')}`,
  };
}

function liveProviderSmokeCheck(repoRoot: string): MarketReadinessCheck {
  const candidates = [
    path.join(repoRoot, '.omx', 'proof', 'live-provider-smoke.json'),
    path.join(repoRoot, '.omx', 'proof', 'market-readiness-live-smoke.json'),
  ];
  const found = candidates.find((filePath) => fs.existsSync(filePath));
  if (!found) {
    return {
      id: 'live-provider-smoke',
      label: 'Live provider smoke',
      status: 'fail',
      evidence: 'No current live provider smoke receipt found',
    };
  }

  try {
    const receipt = JSON.parse(fs.readFileSync(found, 'utf8')) as { status?: unknown; generatedAt?: unknown; provider?: unknown; model?: unknown };
    if (receipt.status === 'pass') {
      const validation = validateProofReceipt(repoRoot, receipt, {
        requireProviderModel: true,
        requireArtifactPaths: true,
      });
      if (!validation.ok) {
        return {
          id: 'live-provider-smoke',
          label: 'Live provider smoke',
          status: 'fail',
          evidence: `Live provider smoke receipt is not release-proof: ${validation.failures.join('; ')}`,
        };
      }
      const generatedAt = typeof receipt.generatedAt === 'string' ? ` (${receipt.generatedAt})` : '';
      const provider = typeof receipt.provider === 'string' && typeof receipt.model === 'string'
        ? ` via ${receipt.provider}/${receipt.model}`
        : '';
      return {
        id: 'live-provider-smoke',
        label: 'Live provider smoke',
        status: 'pass',
        evidence: `Found passing ${path.relative(repoRoot, found)}${provider}${generatedAt}`,
      };
    }
    return {
      id: 'live-provider-smoke',
      label: 'Live provider smoke',
      status: 'fail',
      evidence: `Live provider smoke receipt status ${String(receipt.status ?? 'unknown')}`,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      id: 'live-provider-smoke',
      label: 'Live provider smoke',
      status: 'fail',
      evidence: `Live provider smoke receipt is unreadable: ${reason}`,
    };
  }
}

function read(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}
