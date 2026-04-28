import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLevel6ReleaseGate } from '../../../src/runtime-core/Level6ReleaseGate.js';
import { CREATIVE_DOMAIN_GAUNTLET_DOMAINS } from '../../../src/runtime-core/CreativeDomainGauntlet.js';


function createSourceContractRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'liminal-level6-live-'));
  for (const domain of CREATIVE_DOMAIN_GAUNTLET_DOMAINS) {
    for (const file of domain.implementationFiles) {
      const fullPath = join(repoRoot, file);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, '// source-contract fixture');
    }
  }
  return repoRoot;
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
    mkdirSync(join(repoRoot, '.omx', 'proof'), { recursive: true });
    writeFileSync(join(repoRoot, '.omx', 'proof', 'domain-gauntlet-live.json'), JSON.stringify({ status: 'pass', mode: 'live-execution' }));
    writeFileSync(join(repoRoot, '.omx', 'proof', 'model-assimilation-live.json'), JSON.stringify({ status: 'pass', mode: 'live' }));

    const gate = runLevel6ReleaseGate({ repoRoot, includeMarketReadiness: false });

    expect(gate.ready).toBe(true);
    expect(gate.level).toBe('level-6');
    expect(gate.checks.find((check) => check.id === 'live-creative-domain-execution')?.evidence).toContain('.omx/proof/domain-gauntlet-live.json');
    expect(gate.checks.find((check) => check.id === 'live-model-assimilation')?.evidence).toContain('.omx/proof/model-assimilation-live.json');
  });
});
