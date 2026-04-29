import fs from 'node:fs';
import path from 'node:path';

export type SelfHealingRunType = 'repair' | 'harden' | 'improve';
export type OpportunityCategory =
  | 'performance optimization'
  | 'UX improvement'
  | 'reliability hardening'
  | 'test coverage improvement'
  | 'documentation truth fix'
  | 'code deletion/simplification'
  | 'ML value improvement'
  | 'integration cleanup';
export type LaunchLabel = 'proven' | 'experimental' | 'hidden';

export interface GateEvidence {
  name: string;
  status: 'pass' | 'fail' | 'unknown';
  command: string;
  detail?: string;
}

export interface ImprovementOpportunityEvidence {
  gates: GateEvidence[];
  lintWarnings?: number;
  skippedTests?: number;
  staleProofArtifacts?: string[];
  duplicatedLaunchPaths?: string[];
  previewMetrics?: { timeToFirstActivityMs?: number; timeToFirstArtifactMs?: number; timeToPreviewMs?: number };
  providerMetrics?: { averageLatencyMs?: number; averagePromptBytes?: number };
  docsDrift?: string[];
  guiSmoke?: { status: 'pass' | 'fail' | 'missing'; command: string; detail?: string };
  releaseReceipts?: string[];
  packageLock?: { status: 'reviewed' | 'changed' | 'unknown'; detail: string };
  processCleanup?: { status: 'automated' | 'manual' | 'unknown'; command?: string };
  integrationHellSignals?: string[];
  mlFeatures?: MlFeatureValue[];
}

export interface MlFeatureInput {
  id: string;
  proofCommand?: string;
  baseline: string;
  enabled: string;
  metric?: string;
  status?: 'proven' | 'experimental' | 'unproven';
}

export interface MlFeatureValue {
  id: string;
  proofCommand: string;
  baseline: string;
  enabled: string;
  metric: string;
  launchLabel: LaunchLabel;
}

export interface ProposalScoreInput {
  impact: number;
  confidence: number;
  effort: number;
  risk: number;
  reversibility: number;
  verificationClarity: number;
}

export interface ImprovementProposal extends ProposalScoreInput {
  id: string;
  title: string;
  category: OpportunityCategory;
  evidence: string[];
  measurableTarget: string;
  expectedVerification: string[];
  leverage: number;
  roi: number;
  score: number;
}

export interface ImprovementOpportunityReport {
  runType: SelfHealingRunType;
  summary: string;
  gatesGreen: boolean;
  proposals: ImprovementProposal[];
  mlFeatures: MlFeatureValue[];
}

export interface LaunchRisk extends ImprovementProposal {
  status: 'open' | 'mitigated';
}

const DEFAULT_ML_FEATURES: MlFeatureInput[] = [
  { id: 'taste-learning', proofCommand: 'pnpm test -- TasteModelRuntime PreferenceDatasetBuilder', baseline: 'creative ranking without preference replay', enabled: 'preference replay and taste alignment', metric: 'agreement beats baseline', status: 'experimental' },
  { id: 'emergence-garden', proofCommand: 'pnpm test -- Phase16AutonomousGardener EmergenceAutonomy', baseline: 'manual gallery curation', enabled: 'garden cycles and archive recombination', metric: 'novelty and archive-health lift', status: 'experimental' },
  { id: 'compost', proofCommand: 'pnpm test -- CompostMill', baseline: 'discarded fragments', enabled: 'fragment digestion and soup replay', metric: 'reused fragments producing valid outputs', status: 'experimental' },
  { id: 'routing', proofCommand: 'pnpm test -- ModelRouter RoutingData', baseline: 'single provider path', enabled: 'role/domain-aware routing', metric: 'successful route selection with provider labels', status: 'proven' },
  { id: 'aesthetic-guardrails', proofCommand: 'pnpm test -- GuardrailSystem CreativeEvaluator', baseline: 'validator-only generation', enabled: 'aesthetic scoring and guardrails', metric: 'quality gate catches low-score outputs', status: 'experimental' },
  { id: 'failure-pattern-detection', proofCommand: 'pnpm test -- FailureLogger PatternDetector', baseline: 'one-off failure logs', enabled: 'clustered failure patterns', metric: 'recurring patterns produce repair advice', status: 'proven' },
  { id: 'prompt-enhancement', proofCommand: 'pnpm test -- prompt-enhancer prompt-validation', baseline: 'raw prompt', enabled: 'domain-aware prompt enhancement', metric: 'validated prompt contract output', status: 'experimental' },
];

export function buildMlFeatureValueMatrix(features: MlFeatureInput[] = DEFAULT_ML_FEATURES): MlFeatureValue[] {
  return features.map((feature) => {
    const hasProof = Boolean(feature.proofCommand?.trim() && feature.metric?.trim());
    const launchLabel: LaunchLabel = feature.status === 'proven' && hasProof
      ? 'proven'
      : feature.status === 'experimental' && hasProof
        ? 'experimental'
        : 'hidden';
    return {
      id: feature.id,
      proofCommand: feature.proofCommand || '',
      baseline: feature.baseline,
      enabled: feature.enabled,
      metric: feature.metric || '',
      launchLabel,
    };
  });
}

export function scoreImprovementProposal(input: ProposalScoreInput): number {
  const positive = input.impact * 0.32 + input.confidence * 0.22 + input.reversibility * 0.16 + input.verificationClarity * 0.2;
  const penalty = input.effort * 0.06 + input.risk * 0.04;
  return Math.max(0, Math.min(100, Math.round(((positive - penalty) / 4.34) * 100)));
}

export function scanGreenSystemOpportunities(evidence: ImprovementOpportunityEvidence): ImprovementOpportunityReport {
  const gatesGreen = evidence.gates.length > 0 && evidence.gates.every((gate) => gate.status === 'pass');
  const failingGate = evidence.gates.find((gate) => gate.status === 'fail');
  const proposals: ImprovementProposal[] = [];
  const mlFeatures = evidence.mlFeatures ?? buildMlFeatureValueMatrix();

  if (failingGate) {
    proposals.push(makeProposal({
      id: `repair-${slug(failingGate.name)}`,
      title: `Repair failing ${failingGate.name} gate`,
      category: 'reliability hardening',
      evidence: [`${failingGate.command}: ${failingGate.detail || 'failed'}`],
      measurableTarget: `${failingGate.command} passes`,
      expectedVerification: [failingGate.command],
      impact: 5,
      confidence: 5,
      effort: 3,
      risk: 2,
      reversibility: 4,
      verificationClarity: 5,
    }));
  }

  addIf(proposals, evidence.duplicatedLaunchPaths?.length, {
    id: 'improve-canonical-launch-path',
    title: 'Collapse duplicate launch semantics',
    category: 'integration cleanup',
    evidence: evidence.duplicatedLaunchPaths ?? [],
    measurableTarget: 'One documented GUI command starts backend plus workbench, with Bubble Tea kept as operator cockpit',
    expectedVerification: ['node bin/liminal --help', 'pnpm test -- studio-improve-cli-contract'],
    impact: 5,
    confidence: 5,
    effort: 2,
    risk: 2,
    reversibility: 5,
    verificationClarity: 5,
  });

  const previewMs = evidence.previewMetrics?.timeToPreviewMs ?? 0;
  const firstActivityMs = evidence.previewMetrics?.timeToFirstActivityMs ?? 0;
  addIf(proposals, previewMs > 10_000 || firstActivityMs > 500, {
    id: 'improve-preview-latency',
    title: 'Reduce perceived preview latency',
    category: 'performance optimization',
    evidence: [`timeToFirstActivityMs=${firstActivityMs || 'unknown'}`, `timeToPreviewMs=${previewMs || 'unknown'}`],
    measurableTarget: 'First activity under 500ms and preview/artifact progress visible before model completion',
    expectedVerification: ['GUI smoke: prompt -> streamed phase -> preview artifact'],
    impact: 5,
    confidence: 4,
    effort: 3,
    risk: 2,
    reversibility: 4,
    verificationClarity: 4,
  });

  const promptBytes = evidence.providerMetrics?.averagePromptBytes ?? 0;
  addIf(proposals, promptBytes > 50_000, {
    id: 'improve-context-budget',
    title: 'Trim self-improvement context before provider calls',
    category: 'performance optimization',
    evidence: [`averagePromptBytes=${promptBytes}`],
    measurableTarget: 'Self-improvement task packets stay below 50k bytes unless explicitly expanded',
    expectedVerification: ['pnpm test -- SelfImprovementRuntime', 'prompt-size proof artifact'],
    impact: 5,
    confidence: 4,
    effort: 3,
    risk: 2,
    reversibility: 4,
    verificationClarity: 5,
  });

  addIf(proposals, (evidence.lintWarnings ?? 0) > 0, {
    id: 'harden-warning-budget',
    title: 'Convert launch-critical warnings into a budget',
    category: 'reliability hardening',
    evidence: [`lintWarnings=${evidence.lintWarnings}`],
    measurableTarget: 'Warnings are classified as allowed, fixed, or launch-blocking',
    expectedVerification: ['pnpm lint', 'pnpm test:quality'],
    impact: 4,
    confidence: 4,
    effort: 3,
    risk: 1,
    reversibility: 5,
    verificationClarity: 4,
  });

  addIf(proposals, evidence.guiSmoke?.status && evidence.guiSmoke.status !== 'pass', {
    id: 'harden-gui-smoke-gate',
    title: 'Commit the Studio GUI smoke gate',
    category: 'reliability hardening',
    evidence: [`guiSmoke=${evidence.guiSmoke?.status}`, evidence.guiSmoke?.detail ?? 'GUI smoke is not a repeatable proof gate'],
    measurableTarget: 'Studio launches, Improve scan renders in-browser, and the smoke cleans up its own server processes',
    expectedVerification: [evidence.guiSmoke?.command ?? 'pnpm run proof:studio-smoke'],
    impact: 5,
    confidence: 4,
    effort: 3,
    risk: 2,
    reversibility: 4,
    verificationClarity: 5,
  });

  addIf(proposals, evidence.releaseReceipts && evidence.releaseReceipts.length === 0, {
    id: 'harden-release-receipts',
    title: 'Persist launch risk and proof receipts',
    category: 'documentation truth fix',
    evidence: ['No current launch-risk receipt was supplied'],
    measurableTarget: 'A current-head proof file lists every launch risk, status, leverage, ROI, and verification command',
    expectedVerification: ['pnpm run proof:launch-risk'],
    impact: 4,
    confidence: 5,
    effort: 2,
    risk: 1,
    reversibility: 5,
    verificationClarity: 5,
  });

  addIf(proposals, evidence.packageLock?.status && evidence.packageLock.status !== 'reviewed', {
    id: 'harden-package-lock-review',
    title: 'Review GUI package-lock churn before launch',
    category: 'integration cleanup',
    evidence: [evidence.packageLock?.detail ?? 'GUI package-lock review status is unknown'],
    measurableTarget: 'GUI dependency lockfile is either unchanged after package-lock-only install or documented as intentional',
    expectedVerification: ['cd gui && npm install --package-lock-only --ignore-scripts', 'git diff -- gui/package-lock.json'],
    impact: 3,
    confidence: 4,
    effort: 1,
    risk: 1,
    reversibility: 5,
    verificationClarity: 4,
  });

  addIf(proposals, evidence.processCleanup?.status && evidence.processCleanup.status !== 'automated', {
    id: 'harden-process-cleanup',
    title: 'Automate Studio smoke process cleanup',
    category: 'reliability hardening',
    evidence: [`processCleanup=${evidence.processCleanup?.status ?? 'unknown'}`],
    measurableTarget: 'Studio smoke test starts and stops only its own backend/frontend processes',
    expectedVerification: [evidence.processCleanup?.command ?? 'pnpm run proof:studio-smoke'],
    impact: 4,
    confidence: 4,
    effort: 2,
    risk: 2,
    reversibility: 5,
    verificationClarity: 5,
  });

  addIf(proposals, evidence.integrationHellSignals?.length, {
    id: 'harden-integration-coupling',
    title: 'Remove launch-path integration coupling',
    category: 'integration cleanup',
    evidence: evidence.integrationHellSignals ?? [],
    measurableTarget: 'Canonical launch and improve paths have a single implementation each, with focused CLI contract tests',
    expectedVerification: ['pnpm test -- studio-improve-cli-contract'],
    impact: 4,
    confidence: 4,
    effort: 2,
    risk: 2,
    reversibility: 5,
    verificationClarity: 5,
  });

  addIf(proposals, (evidence.skippedTests ?? 0) > 0, {
    id: 'harden-skipped-tests',
    title: 'Inventory skipped tests as release risk',
    category: 'test coverage improvement',
    evidence: [`skippedTests=${evidence.skippedTests}`],
    measurableTarget: 'Every skipped test has an owner, reason, and launch label',
    expectedVerification: ['pnpm test:ci:fast', 'pnpm test:ci:slow'],
    impact: 4,
    confidence: 4,
    effort: 2,
    risk: 1,
    reversibility: 5,
    verificationClarity: 4,
  });

  addIf(proposals, evidence.staleProofArtifacts?.length, {
    id: 'harden-proof-freshness',
    title: 'Refresh stale launch proof artifacts',
    category: 'documentation truth fix',
    evidence: evidence.staleProofArtifacts ?? [],
    measurableTarget: 'Launch scorecard and proof artifacts are regenerated from current HEAD',
    expectedVerification: ['pnpm test -- self-improvement-proof-script loop-intelligence-proof-script'],
    impact: 4,
    confidence: 4,
    effort: 2,
    risk: 1,
    reversibility: 5,
    verificationClarity: 4,
  });

  addIf(proposals, evidence.docsDrift?.length, {
    id: 'harden-docs-truth',
    title: 'Align docs and marketing with verified behavior',
    category: 'documentation truth fix',
    evidence: evidence.docsDrift ?? [],
    measurableTarget: 'Docs distinguish proven, experimental, and planned self-healing capabilities',
    expectedVerification: ['pnpm test -- visual-bible-consistency'],
    impact: 4,
    confidence: 4,
    effort: 2,
    risk: 1,
    reversibility: 5,
    verificationClarity: 3,
  });

  const nonProvenMl = mlFeatures.filter((feature) => feature.launchLabel !== 'proven');
  addIf(proposals, nonProvenMl.length, {
    id: 'improve-ml-value-gates',
    title: 'Prove or hide ML feature value',
    category: 'ML value improvement',
    evidence: nonProvenMl.map((feature) => `${feature.id}: ${feature.launchLabel}`),
    measurableTarget: 'Every marketed ML feature has a passing proof command and value metric',
    expectedVerification: ['pnpm run proof:ml-value'],
    impact: 5,
    confidence: 4,
    effort: 4,
    risk: 2,
    reversibility: 5,
    verificationClarity: 4,
  });

  proposals.sort((a, b) => b.leverage - a.leverage || b.roi - a.roi || b.score - a.score || a.id.localeCompare(b.id));
  return {
    runType: failingGate ? 'repair' : gatesGreen ? 'improve' : 'harden',
    summary: failingGate
      ? `Repair mode: ${failingGate.name} is failing.`
      : gatesGreen
        ? `Improve mode: system gates are fully green; ${proposals.length} evidence-backed opportunities found.`
        : `Harden mode: gate status is incomplete; ${proposals.length} blind spots found.`,
    gatesGreen,
    proposals,
    mlFeatures,
  };
}

export function collectRepositoryOpportunityEvidence(repoRoot = process.cwd()): ImprovementOpportunityEvidence {
  const packageJson = readJson(path.join(repoRoot, 'package.json')) as { scripts?: Record<string, string> } | null;
  const scripts = packageJson?.scripts ?? {};
  const readme = readText(path.join(repoRoot, 'README.md'));
  const duplicatedLaunchPaths = [
    scripts['gui:all'] ? 'package.json still exposes deprecated gui:all instead of canonical gui' : '',
    scripts['tui:bubbletea'] ? 'package.json still exposes deprecated tui:bubbletea alias instead of canonical tui' : '',
    scripts.tui?.includes('HarnessTUI') ? 'package.json tui still launches legacy Ink instead of Bubble Tea' : '',
    scripts.studio && scripts.studio !== 'npm run gui' ? 'package.json studio is not an alias of canonical gui' : '',
  ].filter(Boolean);
  const docsDrift = /closed-loop self-improvement|continuously improves the system/i.test(readme)
    ? ['README markets closed-loop self-improvement; verify current-head proof before launch claims']
    : [];

  return {
    gates: [
      { name: 'build', status: 'unknown', command: 'pnpm build', detail: 'scanner is read-only and does not run gates' },
      { name: 'lint', status: 'unknown', command: 'pnpm lint', detail: 'scanner is read-only and does not run gates' },
      { name: 'fast tests', status: 'unknown', command: 'pnpm test:ci:fast', detail: 'scanner is read-only and does not run gates' },
      { name: 'slow tests', status: 'unknown', command: 'pnpm test:ci:slow', detail: 'scanner is read-only and does not run gates' },
    ],
    lintWarnings: 0,
    skippedTests: countTestSkips(path.join(repoRoot, 'test')),
    staleProofArtifacts: [],
    duplicatedLaunchPaths,
    previewMetrics: {},
    providerMetrics: {},
    docsDrift,
    mlFeatures: buildMlFeatureValueMatrix(),
  };
}

export function formatOpportunityReport(report: ImprovementOpportunityReport): string {
  const lines = [`Liminal self-healing ${report.runType} report`, report.summary, '', 'Proposals:'];
  if (report.proposals.length === 0) {
    lines.push('  none');
  } else {
    for (const proposal of report.proposals) {
      lines.push(`  ${proposal.id} [leverage ${proposal.leverage}, ROI ${proposal.roi}, score ${proposal.score}] ${proposal.title}`);
      lines.push(`    category: ${proposal.category}`);
      lines.push(`    target: ${proposal.measurableTarget}`);
      lines.push(`    verify: ${proposal.expectedVerification.join(' && ')}`);
    }
  }
  lines.push('', 'ML value labels:');
  for (const feature of report.mlFeatures) {
    lines.push(`  ${feature.id}: ${feature.launchLabel}${feature.proofCommand ? ` (${feature.proofCommand})` : ''}`);
  }
  return lines.join('\n');
}

export function buildLaunchRiskRegister(report: ImprovementOpportunityReport): LaunchRisk[] {
  return report.proposals.map((proposal) => ({ ...proposal, status: 'open' as const }));
}

function addIf(proposals: ImprovementProposal[], condition: unknown, input: Omit<ImprovementProposal, 'score' | 'leverage' | 'roi'>): void {
  if (condition) proposals.push(makeProposal(input));
}

function makeProposal(input: Omit<ImprovementProposal, 'score' | 'leverage' | 'roi'>): ImprovementProposal {
  const divisor = Math.max(1, input.effort + input.risk);
  return {
    ...input,
    leverage: roundOne((input.impact * input.confidence * input.verificationClarity) / divisor),
    roi: roundOne((input.impact * input.confidence * input.reversibility) / divisor),
    score: scoreImprovementProposal(input),
  };
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function countTestSkips(testRoot: string): number {
  if (!fs.existsSync(testRoot)) return 0;
  let count = 0;
  for (const file of walkFiles(testRoot)) {
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) continue;
    count += (readText(file).match(/\b(?:it|test|describe)\.skip\(/g) || []).length;
  }
  return count;
}

function* walkFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return null;
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}
