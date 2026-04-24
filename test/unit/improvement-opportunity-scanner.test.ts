import { describe, expect, it } from 'vitest';
import {
  buildLaunchRiskRegister,
  buildMlFeatureValueMatrix,
  scanGreenSystemOpportunities,
  scoreImprovementProposal,
  type ImprovementOpportunityEvidence,
} from '../../src/improvement/OpportunityScanner.js';

describe('OpportunityScanner', () => {
  it('creates evidence-backed improvement proposals on a fully green system', () => {
    const evidence: ImprovementOpportunityEvidence = {
      gates: [
        { name: 'build', status: 'pass', command: 'pnpm build' },
        { name: 'fast tests', status: 'pass', command: 'pnpm test:ci:fast' },
      ],
      lintWarnings: 93,
      skippedTests: 7,
      staleProofArtifacts: ['.omx/proof/launch-readiness-scorecard-2026-04-19.md'],
      duplicatedLaunchPaths: ['liminal studio still launches Bubble Tea instead of GUI'],
      previewMetrics: { timeToFirstActivityMs: 1250, timeToFirstArtifactMs: 18000, timeToPreviewMs: 42000 },
      providerMetrics: { averageLatencyMs: 16000, averagePromptBytes: 92000 },
      docsDrift: ['README overclaims closed-loop launch readiness'],
      guiSmoke: { status: 'missing', command: 'pnpm run proof:studio-smoke' },
      releaseReceipts: [],
      integrationHellSignals: ['duplicate CLI improve command path'],
      mlFeatures: buildMlFeatureValueMatrix([
        { id: 'taste-learning', proofCommand: 'pnpm test -- TasteModelRuntime', baseline: 'no preference signal', enabled: 'preference replay', metric: 'choice agreement', status: 'experimental' },
      ]),
    };

    const report = scanGreenSystemOpportunities(evidence);

    expect(report.runType).toBe('improve');
    expect(report.summary).toContain('fully green');
    expect(report.proposals.length).toBeGreaterThanOrEqual(5);
    expect(report.proposals[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      category: expect.any(String),
      expectedVerification: expect.any(Array),
      leverage: expect.any(Number),
      roi: expect.any(Number),
      score: expect.any(Number),
    }));
    expect(report.proposals[0].leverage).toBeGreaterThanOrEqual(report.proposals[1].leverage);
    expect(report.proposals.some((proposal) => proposal.category === 'performance optimization')).toBe(true);
    expect(report.proposals.some((proposal) => proposal.category === 'integration cleanup')).toBe(true);
    expect(report.proposals.some((proposal) => proposal.id === 'harden-gui-smoke-gate')).toBe(true);
    expect(report.proposals.some((proposal) => proposal.id === 'harden-release-receipts')).toBe(true);
    expect(report.proposals.every((proposal) => proposal.measurableTarget.length > 0)).toBe(true);
  });

  it('lists explicit launch risks sorted by leverage and ROI', () => {
    const report = scanGreenSystemOpportunities({
      gates: [
        { name: 'build', status: 'pass', command: 'pnpm build' },
        { name: 'lint', status: 'pass', command: 'pnpm lint' },
      ],
      skippedTests: 3,
      lintWarnings: 93,
      guiSmoke: { status: 'missing', command: 'pnpm run proof:studio-smoke' },
      releaseReceipts: [],
      packageLock: { status: 'changed', detail: 'gui/package-lock.json changed during GUI dependency install' },
      processCleanup: { status: 'manual', command: 'ps -axo pid,ppid,command | rg studio' },
      integrationHellSignals: ['CLI had duplicate improve command handling'],
      mlFeatures: buildMlFeatureValueMatrix(),
    });

    const risks = buildLaunchRiskRegister(report);

    expect(risks.length).toBeGreaterThanOrEqual(8);
    expect(risks[0].leverage).toBeGreaterThanOrEqual(risks[1].leverage);
    expect(risks.map((risk) => risk.id)).toEqual(expect.arrayContaining([
      'harden-skipped-tests',
      'improve-ml-value-gates',
      'harden-warning-budget',
      'harden-gui-smoke-gate',
      'harden-release-receipts',
      'harden-package-lock-review',
      'harden-process-cleanup',
      'harden-integration-coupling',
    ]));
  });

  it('scores proposals from impact, confidence, effort, risk, reversibility, and verification clarity', () => {
    const score = scoreImprovementProposal({
      impact: 5,
      confidence: 4,
      effort: 2,
      risk: 1,
      reversibility: 5,
      verificationClarity: 5,
    });

    expect(score).toBeGreaterThan(80);
  });

  it('labels unproven ML features as hidden or experimental instead of marketable', () => {
    const matrix = buildMlFeatureValueMatrix([
      { id: 'taste-learning', proofCommand: 'pnpm test -- TasteModelRuntime', baseline: 'none', enabled: 'taste replay', metric: 'agreement', status: 'experimental' },
      { id: 'emergence-garden', proofCommand: '', baseline: 'manual runs', enabled: 'garden cycle', metric: '', status: 'unproven' },
    ]);

    expect(matrix.find((feature) => feature.id === 'taste-learning')?.launchLabel).toBe('experimental');
    expect(matrix.find((feature) => feature.id === 'emergence-garden')?.launchLabel).toBe('hidden');
  });
});
