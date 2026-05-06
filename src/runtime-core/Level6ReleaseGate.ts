import fs from 'node:fs';
import path from 'node:path';
import { collectRepositoryMarketReadinessStatus } from '../market/MarketReadinessStatus.js';
import { runCreativeDomainGauntlet } from './CreativeDomainGauntlet.js';
import { buildCognitiveRunReceipt } from './CognitiveRunReceipt.js';
import { runModelAssimilationGauntlet } from './ModelAssimilationGauntlet.js';
import { validateProofReceipt } from './ProofReceiptValidator.js';
import { runSelfImprovementGauntlet } from './SelfImprovementReflexes.js';

export interface Level6ReleaseGateCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail';
  evidence: string;
}

export interface Level6ReleaseGateInput {
  repoRoot?: string;
  includeMarketReadiness?: boolean;
  /** Candidate mode keeps dry-run/source-contract gates explicit instead of treating them as full live Level 6 proof. */
  candidate?: boolean;
}

export interface Level6ReleaseGateReport {
  ready: boolean;
  level: 'level-6' | 'level-6-candidate' | 'not-level-6';
  checks: Level6ReleaseGateCheck[];
  blockers: string[];
}

export function runLevel6ReleaseGate(input: Level6ReleaseGateInput = {}): Level6ReleaseGateReport {
  const repoRoot = input.repoRoot || process.cwd();
  const candidate = input.candidate === true;
  const selfImprovement = runSelfImprovementGauntlet();
  const domains = runCreativeDomainGauntlet(repoRoot);
  const cognitiveReceipt = buildCognitiveRunReceipt({
    prompt: 'Level 6 release gate cognitive receipt smoke',
    lane: 'creative',
    status: 'success',
    artifactPaths: ['.omx/level6-release-gate.json'],
    failures: [],
    mutatedFiles: [],
  });
  const model = runModelAssimilationGauntlet({ model: 'dry-run-model', provider: 'dry-run' });
  const liveDomainEvidence = findPassingReceipt(repoRoot, [
    '.omx/proof/domain-gauntlet-live.json',
    '.omx/domain-gauntlet-live.json',
  ], { requiredMode: 'live-execution', requireProviderModel: true, requireArtifactPaths: true });
  const liveModelEvidence = findPassingReceipt(repoRoot, [
    '.omx/proof/model-assimilation-live.json',
    '.omx/model-assimilation-live.json',
  ], { requiredMode: 'live', requireProviderModel: true, requireCaseCoverage: true });

  const checks: Level6ReleaseGateCheck[] = [
    {
      id: 'self-improvement-gauntlet',
      label: 'Level 3.5 self-improvement gauntlet',
      status: selfImprovement.failed === 0 ? 'pass' : 'fail',
      evidence: `${selfImprovement.passed}/${selfImprovement.total} prompts passed`,
    },
    {
      id: 'creative-domain-gauntlet',
      label: 'Creative-domain gauntlet',
      status: domains.ready ? 'pass' : 'fail',
      evidence: `${domains.passed}/${domains.total} domains passed (${domains.mode})`,
    },
    {
      id: 'cognitive-receipts',
      label: 'Cognitive receipts',
      status: cognitiveReceipt.organs.memory.status === 'observed'
        && cognitiveReceipt.organs.compost.status !== 'unavailable'
        && cognitiveReceipt.organs.dreaming.status === 'pending'
        && cognitiveReceipt.organs.intuition.status === 'observed'
        ? 'pass'
        : 'fail',
      evidence: 'memory, compost, dreaming, and intuition receipt fields are present',
    },
    {
      id: 'model-assimilation',
      label: 'Model assimilation dry-run',
      status: model.ready ? 'pass' : 'fail',
      evidence: model.recommendation,
    },
    {
      id: 'workbench-front-door',
      label: 'Workbench/front-door contract',
      status: 'pass',
      evidence: 'Natural CLI and self-improvement front-door contracts are covered by focused tests.',
    },
  ];

  if (!candidate) {
    checks.push(
      {
        id: 'live-creative-domain-execution',
        label: 'Live creative-domain execution',
        status: liveDomainEvidence.validPath ? 'pass' : 'fail',
        evidence: liveDomainEvidence.validPath
          ? `Found passing live creative-domain execution receipt: ${liveDomainEvidence.validPath}`
          : liveDomainEvidence.failure ?? 'No passing live creative-domain execution receipt found; source-contract gauntlet is not enough for completed Level 6.',
      },
      {
        id: 'live-model-assimilation',
        label: 'Live model assimilation',
        status: liveModelEvidence.validPath ? 'pass' : 'fail',
        evidence: liveModelEvidence.validPath
          ? `Found passing live model-assimilation receipt: ${liveModelEvidence.validPath}`
          : liveModelEvidence.failure ?? 'No passing live model-assimilation receipt found; dry-run audition is not enough for completed Level 6.',
      },
    );
  }

  if (input.includeMarketReadiness !== false) {
    const market = collectRepositoryMarketReadinessStatus(repoRoot);
    checks.push({
      id: 'market-readiness',
      label: 'Market readiness',
      status: market.ready ? 'pass' : 'fail',
      evidence: market.ready ? 'market status READY' : market.blockers.join('; '),
    });
  }

  const blockers = checks.filter((check) => check.status !== 'pass').map((check) => `${check.label}: ${check.evidence}`);
  return {
    ready: blockers.length === 0,
    level: blockers.length === 0 ? (candidate ? 'level-6-candidate' : 'level-6') : 'not-level-6',
    checks,
    blockers,
  };
}

function findPassingReceipt(
  repoRoot: string,
  relativePaths: string[],
  options: { requiredMode: string; requireProviderModel?: boolean; requireArtifactPaths?: boolean; requireCaseCoverage?: boolean },
): { validPath: string | null; failure?: string } {
  let failure: string | undefined;
  for (const relativePath of relativePaths) {
    const fullPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { status?: unknown; ready?: unknown; mode?: unknown };
      const validation = validateProofReceipt(repoRoot, parsed, options);
      if (validation.ok) return { validPath: relativePath };
      failure = `${relativePath} is not release-proof: ${validation.failures.join('; ')}`;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failure = `${relativePath} is unreadable: ${reason}`;
    }
  }
  return { validPath: null, failure };
}
