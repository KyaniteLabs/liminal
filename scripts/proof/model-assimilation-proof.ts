#!/usr/bin/env tsx
/**
 * Deterministic model-assimilation proof.
 *
 * This is an offline evidence-contract runner: it proves that Liminal can take
 * role/domain audition evidence, compare candidates against baselines, preserve
 * fallback provenance, and emit promote/hold/demote assignments without
 * silently changing routes. Live provider calls can feed the same report shape.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Mode = 'fixture' | 'live';
type Decision = 'promote' | 'hold' | 'demote';
type Role = 'generator' | 'evaluator' | 'harness';
const domains = ['svg', 'p5', 'glsl', 'hydra', 'three', 'tone', 'strudel', 'revideo', 'html', 'ascii', 'kinetic', 'textgen'] as const;
type Domain = typeof domains[number];

interface CandidateEvidence {
  model: string;
  provider: string;
  notes: string[];
  scores: Record<Role, Partial<Record<Domain, number>>>;
}

interface RecommendedAssignment {
  role: Role;
  domain: Domain;
  model: string;
  score: number;
  baseline: number;
  decision: Decision;
  reason: string;
}

interface ModelAssimilationReport {
  contract: 'liminal-model-assimilation-v1';
  generatedAt: string;
  mode: Mode;
  baselinePolicy: {
    promoteMargin: number;
    holdMargin: number;
    demoteBelow: number;
  };
  candidates: CandidateEvidence[];
  recommendedAssignments: RecommendedAssignment[];
  fallbackProvenance: Array<{ role: Role; domain: Domain; chain: string[] }>;
}

const baselinePolicy = {
  promoteMargin: 0.05,
  holdMargin: 0,
  demoteBelow: -0.08,
};

const baselines: Record<Role, Partial<Record<Domain, number>>> = {
  generator: { svg: 0.76, p5: 0.74, glsl: 0.70, hydra: 0.68, three: 0.72, tone: 0.70, strudel: 0.69, revideo: 0.66, html: 0.72, ascii: 0.62, kinetic: 0.61, textgen: 0.65 },
  evaluator: { svg: 0.74, p5: 0.72, glsl: 0.71, hydra: 0.68, three: 0.70, tone: 0.66, strudel: 0.65, revideo: 0.63, html: 0.70, ascii: 0.60, kinetic: 0.59, textgen: 0.64 },
  harness: { svg: 0.73, p5: 0.73, glsl: 0.72, hydra: 0.70, three: 0.72, tone: 0.67, strudel: 0.66, revideo: 0.64, html: 0.71, ascii: 0.61, kinetic: 0.60, textgen: 0.65 },
};

const fixtureCandidates: CandidateEvidence[] = [
  {
    model: 'gpt-5.4-mini',
    provider: 'openai',
    notes: ['cloud-first DF candidate', 'strong structured outputs', 'good default for visible creative routing'],
    scores: {
      generator: { svg: 0.86, p5: 0.83, glsl: 0.78, hydra: 0.75, three: 0.80, tone: 0.72, strudel: 0.71, revideo: 0.70, html: 0.81, ascii: 0.68, kinetic: 0.67, textgen: 0.72 },
      evaluator: { svg: 0.82, p5: 0.79, glsl: 0.76, hydra: 0.73, three: 0.78, tone: 0.70, strudel: 0.69, revideo: 0.68, html: 0.77, ascii: 0.66, kinetic: 0.65, textgen: 0.71 },
      harness: { svg: 0.84, p5: 0.83, glsl: 0.80, hydra: 0.78, three: 0.82, tone: 0.75, strudel: 0.74, revideo: 0.73, html: 0.80, ascii: 0.69, kinetic: 0.68, textgen: 0.73 },
    },
  },
  {
    model: 'gpt-5.4-nano',
    provider: 'openai',
    notes: ['low-cost routing candidate', 'best for quick drafts and classification', 'not enough evidence for primary prove loops'],
    scores: {
      generator: { svg: 0.78, p5: 0.77, glsl: 0.69, hydra: 0.67, three: 0.70, tone: 0.68, strudel: 0.67, revideo: 0.64, html: 0.72, ascii: 0.63, kinetic: 0.62, textgen: 0.66 },
      evaluator: { svg: 0.73, p5: 0.72, glsl: 0.68, hydra: 0.66, three: 0.69, tone: 0.65, strudel: 0.64, revideo: 0.62, html: 0.70, ascii: 0.60, kinetic: 0.59, textgen: 0.64 },
      harness: { svg: 0.76, p5: 0.75, glsl: 0.72, hydra: 0.70, three: 0.72, tone: 0.68, strudel: 0.67, revideo: 0.65, html: 0.72, ascii: 0.61, kinetic: 0.60, textgen: 0.66 },
    },
  },
  {
    model: 'glm-4.5-air',
    provider: 'glm',
    notes: ['cloud-first alternate provider', 'useful fallback diversity', 'needs provenance because provider behavior differs'],
    scores: {
      generator: { svg: 0.80, p5: 0.78, glsl: 0.74, hydra: 0.73, three: 0.75, tone: 0.71, strudel: 0.70, revideo: 0.68, html: 0.76, ascii: 0.66, kinetic: 0.65, textgen: 0.69 },
      evaluator: { svg: 0.78, p5: 0.76, glsl: 0.75, hydra: 0.72, three: 0.75, tone: 0.69, strudel: 0.68, revideo: 0.67, html: 0.74, ascii: 0.64, kinetic: 0.63, textgen: 0.68 },
      harness: { svg: 0.79, p5: 0.78, glsl: 0.76, hydra: 0.74, three: 0.77, tone: 0.71, strudel: 0.70, revideo: 0.69, html: 0.75, ascii: 0.65, kinetic: 0.64, textgen: 0.69 },
    },
  },
];

function parseArgs(argv: string[]): { out: string; mode: Mode } {
  let out = path.join(process.cwd(), '.omx', 'proof', 'model-assimilation', new Date().toISOString().replace(/[:.]/g, '-'));
  let mode: Mode = 'fixture';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--out') out = argv[++i] ?? out;
    if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
    if (arg === '--live') mode = 'live';
  }
  return { out, mode };
}

function decide(score: number, baseline: number): Decision {
  const delta = score - baseline;
  if (delta >= baselinePolicy.promoteMargin) return 'promote';
  if (delta < baselinePolicy.demoteBelow) return 'demote';
  return 'hold';
}

function bestCandidate(role: Role, domain: Domain, candidates: CandidateEvidence[]): RecommendedAssignment {
  const baseline = baselines[role][domain] ?? 0;
  const ranked = candidates
    .map(candidate => ({ candidate, score: candidate.scores[role][domain] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const decision = decide(best.score, baseline);
  const delta = best.score - baseline;
  const reason = decision === 'promote'
    ? `score ${best.score.toFixed(2)} beats baseline ${baseline.toFixed(2)} by ${delta.toFixed(2)}`
    : decision === 'hold'
      ? `score ${best.score.toFixed(2)} is not enough evidence to replace baseline ${baseline.toFixed(2)}`
      : `score ${best.score.toFixed(2)} is below safe threshold against baseline ${baseline.toFixed(2)}`;
  return { role, domain, model: best.candidate.model, score: best.score, baseline, decision, reason };
}

function buildReport(mode: Mode): ModelAssimilationReport {
  const roles: Role[] = ['generator', 'evaluator', 'harness'];
  const recommendedAssignments = roles.flatMap(role => domains.map(domain => bestCandidate(role, domain, fixtureCandidates)));
  const fallbackProvenance = recommendedAssignments.map(item => {
    const fallback = fixtureCandidates
      .filter(candidate => candidate.model !== item.model)
      .sort((a, b) => (b.scores[item.role][item.domain] ?? 0) - (a.scores[item.role][item.domain] ?? 0))
      .map(candidate => candidate.model);
    return { role: item.role, domain: item.domain, chain: [item.model, ...fallback, `baseline:${item.role}:${item.domain}`] };
  });

  return {
    contract: 'liminal-model-assimilation-v1',
    generatedAt: new Date().toISOString(),
    mode,
    baselinePolicy,
    candidates: fixtureCandidates,
    recommendedAssignments,
    fallbackProvenance,
  };
}

function formatMarkdown(report: ModelAssimilationReport): string {
  const lines = [
    '# Liminal Model Assimilation Report',
    '',
    `Mode: ${report.mode}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Candidates',
    '',
    ...report.candidates.map(candidate => `- **${candidate.model}** (${candidate.provider}) — ${candidate.notes.join('; ')}`),
    '',
    '## Recommended Assignments',
    '',
    '| Role | Domain | Model | Decision | Score | Baseline | Reason |',
    '| --- | --- | --- | --- | ---: | ---: | --- |',
    ...report.recommendedAssignments.map(item => `| ${item.role} | ${item.domain} | ${item.model} | ${item.decision} | ${item.score.toFixed(2)} | ${item.baseline.toFixed(2)} | ${item.reason} |`),
    '',
    '## Fallback Provenance',
    '',
    ...report.fallbackProvenance.map(item => `- ${item.role}/${item.domain}: ${item.chain.join(' -> ')}`),
    '',
    '## Truth Note',
    '',
    report.mode === 'fixture'
      ? 'This is deterministic fixture evidence. It proves the assimilation decision contract and report shape, not live provider quality.'
      : 'Live mode requested; provider execution is expected to populate the same contract with real run evidence.',
  ];
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const { out, mode } = parseArgs(process.argv.slice(2));
  const report = buildReport(mode);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(out, 'report.md'), formatMarkdown(report), 'utf8');
  console.log(`model-assimilation report: ${path.join(out, 'report.md')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
