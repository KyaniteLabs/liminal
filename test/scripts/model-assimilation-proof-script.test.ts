import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

interface ModelAssimilationReport {
  contract: 'liminal-model-assimilation-v1';
  mode: 'fixture' | 'live';
  candidates: Array<{ model: string; provider: string }>;
  recommendedAssignments: Array<{ role: string; domain: string; model: string; decision: 'promote' | 'hold' | 'demote'; reason: string }>;
  fallbackProvenance: Array<{ role: string; domain: string; chain: string[] }>;
}

describe('model-assimilation proof script', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  });

  async function tempRoot(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'liminal-model-assimilation-'));
    tempDirs.push(dir);
    return dir;
  }

  it('writes a model audition report with assignments and fallback provenance', async () => {
    const out = await tempRoot();

    const result = await execFileAsync('pnpm', ['tsx', 'scripts/proof/model-assimilation-proof.ts', '--out', out], { cwd: process.cwd() });

    expect(result.stdout).toContain('model-assimilation report');

    const reportPath = join(out, 'report.json');
    const markdownPath = join(out, 'report.md');
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as ModelAssimilationReport;
    const markdown = await readFile(markdownPath, 'utf8');

    expect(report.contract).toBe('liminal-model-assimilation-v1');
    expect(report.mode).toBe('fixture');
    expect(report.candidates.map(candidate => candidate.model)).toEqual(expect.arrayContaining([
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'glm-4.5-air',
    ]));
    const finishLineDomains = ['svg', 'p5', 'glsl', 'hydra', 'three', 'tone', 'strudel', 'revideo', 'html', 'ascii', 'kinetic', 'textgen'];
    expect(new Set(report.recommendedAssignments.map(item => item.domain))).toEqual(new Set(finishLineDomains));
    expect(report.recommendedAssignments).toHaveLength(finishLineDomains.length * 3);
    expect(report.fallbackProvenance).toHaveLength(finishLineDomains.length * 3);
    expect(report.recommendedAssignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'generator', domain: 'svg', decision: 'promote' }),
      expect.objectContaining({ role: 'generator', domain: 'tone', decision: 'hold' }),
      expect.objectContaining({ role: 'generator', domain: 'html' }),
      expect.objectContaining({ role: 'evaluator', domain: 'ascii' }),
      expect.objectContaining({ role: 'harness', domain: 'kinetic' }),
      expect.objectContaining({ role: 'generator', domain: 'textgen' }),
    ]));
    for (const domain of finishLineDomains) {
      expect(report.fallbackProvenance.find(item => item.role === 'generator' && item.domain === domain)?.chain.length).toBeGreaterThan(1);
    }
    expect(markdown).toContain('## Recommended Assignments');
    expect(markdown).toContain('gpt-5.4-mini');
  });
});
