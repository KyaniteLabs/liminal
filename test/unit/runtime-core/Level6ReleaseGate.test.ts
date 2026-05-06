import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLevel6ReleaseGate } from '../../../src/runtime-core/Level6ReleaseGate.js';
import { CREATIVE_DOMAIN_GAUNTLET_DOMAINS } from '../../../src/runtime-core/CreativeDomainGauntlet.js';

const MODEL_ASSIMILATION_DOMAINS = ['svg', 'p5', 'glsl', 'hydra', 'three', 'tone', 'strudel', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];
const MODEL_ASSIMILATION_ROLES = ['generator', 'evaluator', 'harness'];

function createSourceContractRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'liminal-level6-live-'));
  writeFakeGitHead(repoRoot);
  for (const domain of CREATIVE_DOMAIN_GAUNTLET_DOMAINS) {
    for (const file of domain.implementationFiles) {
      const fullPath = join(repoRoot, file);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, '// source-contract fixture');
    }
  }
  return repoRoot;
}

function writeFakeGitHead(repoRoot: string, commit = 'b'.repeat(40)): string {
  mkdirSync(join(repoRoot, '.git', 'refs', 'heads'), { recursive: true });
  writeFileSync(join(repoRoot, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(repoRoot, '.git', 'refs', 'heads', 'main'), `${commit}\n`);
  return commit;
}

function writeLiveReleaseReceipts(repoRoot: string, options: { generatedAt?: string } = {}): void {
  const gitCommit = writeFakeGitHead(repoRoot);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const domainArtifact = join(repoRoot, '.omx', 'proof', 'domain-gauntlet-live', 'p5.js');
  mkdirSync(dirname(domainArtifact), { recursive: true });
  writeFileSync(domainArtifact, 'function setup() { createCanvas(100, 100); }\n');
  writeFileSync(join(repoRoot, '.omx', 'proof', 'domain-gauntlet-live.json'), JSON.stringify({
    status: 'pass',
    mode: 'live-execution',
    generatedAt,
    gitCommit,
    provider: 'glm',
    model: 'glm-5v-turbo',
    domains: [{ domain: 'p5', status: 'pass', artifactPath: '.omx/proof/domain-gauntlet-live/p5.js' }],
  }));
  writeFileSync(join(repoRoot, '.omx', 'proof', 'model-assimilation-live.json'), JSON.stringify({
    status: 'pass',
    mode: 'live',
    generatedAt,
    gitCommit,
    provider: 'glm',
    model: 'glm-5v-turbo',
    caseCoverage: {
      complete: true,
      roles: MODEL_ASSIMILATION_ROLES,
      domains: MODEL_ASSIMILATION_DOMAINS,
      assignmentCount: MODEL_ASSIMILATION_ROLES.length * MODEL_ASSIMILATION_DOMAINS.length,
      fallbackProvenanceCount: MODEL_ASSIMILATION_ROLES.length * MODEL_ASSIMILATION_DOMAINS.length,
    },
  }));
}

describe('runLevel6ReleaseGate', () => {
  it('combines self-improvement, domain, cognition, model, and market gates in candidate mode', () => {
    const gate = runLevel6ReleaseGate({ includeMarketReadiness: false, candidate: true });

    expect(gate.level).toBe('level-6-candidate');
    expect(gate.ready).toBe(true);
    expect(gate.checks.map((check) => check.id)).toEqual([
      'self-improvement-gauntlet',
      'creative-domain-gauntlet',
      'cognitive-receipts',
      'model-assimilation',
      'workbench-front-door',
    ]);
    expect(gate.checks.every((check) => check.status === 'pass')).toBe(true);
  });

  it('does not treat dry-run-only evidence as completed Level 6', () => {
    const gate = runLevel6ReleaseGate({ repoRoot: createSourceContractRepo(), includeMarketReadiness: false });

    expect(gate.level).toBe('not-level-6');
    expect(gate.ready).toBe(false);
    expect(gate.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('Live creative-domain execution'),
      expect.stringContaining('Live model assimilation'),
    ]));
  });

  it('reports completed Level 6 only from typed live receipts', () => {
    const repoRoot = createSourceContractRepo();
    writeLiveReleaseReceipts(repoRoot);

    const gate = runLevel6ReleaseGate({ repoRoot, includeMarketReadiness: false });

    expect(gate.ready).toBe(true);
    expect(gate.level).toBe('level-6');
    expect(gate.checks.find((check) => check.id === 'live-creative-domain-execution')?.evidence).toContain('.omx/proof/domain-gauntlet-live.json');
    expect(gate.checks.find((check) => check.id === 'live-model-assimilation')?.evidence).toContain('.omx/proof/model-assimilation-live.json');
  });

  it('rejects stale live receipts even when they say pass', () => {
    const repoRoot = createSourceContractRepo();
    writeLiveReleaseReceipts(repoRoot, { generatedAt: '2000-01-01T00:00:00.000Z' });

    const gate = runLevel6ReleaseGate({ repoRoot, includeMarketReadiness: false });

    expect(gate.ready).toBe(false);
    expect(gate.blockers.join('\n')).toContain('stale');
  });
});
