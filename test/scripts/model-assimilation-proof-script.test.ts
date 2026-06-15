import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const FIXTURE_IN_LIVE_BLOCKER = 'Live mode requested but candidate evidence is fixture data';

interface ModelAssimilationReport {
  contract: 'sinter-model-assimilation-v1';
  mode: 'fixture' | 'live';
  candidatesSource: 'fixture' | 'live';
  status: 'pass' | 'fail';
  blockers: string[];
  gitCommit: string;
  caseCoverage: {
    complete: boolean;
    roles: string[];
    domains: string[];
    assignmentCount: number;
    fallbackProvenanceCount: number;
  };
  candidates: Array<{ model: string; provider: string }>;
  recommendedAssignments: Array<{ role: string; domain: string; model: string; decision: 'promote' | 'hold' | 'demote'; reason: string }>;
  fallbackProvenance: Array<{ role: string; domain: string; chain: string[] }>;
}

describe('model-assimilation proof script', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  });

  // Remove any pre-existing live receipt so the fixture-only test isn't
  // polluted by a valid receipt left from a prior real live audition.
  beforeEach(async () => {
    await unlink(join(process.cwd(), '.omx', 'proof', 'model-assimilation-live.json')).catch(() => {});
  });

  async function tempRoot(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'sinter-model-assimilation-'));
    tempDirs.push(dir);
    return dir;
  }

  // The script exits non-zero when a live run is not a passing proof; we still
  // want to read the emitted report, so tolerate the rejection.
  async function runScript(args: string[]): Promise<void> {
    try {
      await execFileAsync('pnpm', ['tsx', 'scripts/proof/model-assimilation-proof.ts', ...args], { cwd: process.cwd() });
    } catch {
      // non-zero exit is expected for failing live runs; the report is still written
    }
  }

  it('writes a model audition report with assignments and fallback provenance', async () => {
    const out = await tempRoot();

    const result = await execFileAsync('pnpm', ['tsx', 'scripts/proof/model-assimilation-proof.ts', '--out', out], { cwd: process.cwd() });

    expect(result.stdout).toContain('model-assimilation report');

    const reportPath = join(out, 'report.json');
    const markdownPath = join(out, 'report.md');
    const report = JSON.parse(await readFile(reportPath, 'utf8')) as ModelAssimilationReport;
    const markdown = await readFile(markdownPath, 'utf8');

    expect(report.contract).toBe('sinter-model-assimilation-v1');
    expect(report.mode).toBe('fixture');
    expect(report.candidatesSource).toBe('fixture');
    expect(report.gitCommit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(report.candidates.map(candidate => candidate.model)).toEqual(expect.arrayContaining([
      'gpt-5.4-mini',
      'gpt-5.4-nano',
      'glm-4.5-air',
    ]));
    const finishLineDomains = ['svg', 'p5', 'glsl', 'hydra', 'three', 'tone', 'strudel', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];
    expect(new Set(report.recommendedAssignments.map(item => item.domain))).toEqual(new Set(finishLineDomains));
    expect(report.recommendedAssignments).toHaveLength(finishLineDomains.length * 3);
    expect(report.fallbackProvenance).toHaveLength(finishLineDomains.length * 3);
    expect(report.caseCoverage).toMatchObject({
      complete: true,
      assignmentCount: finishLineDomains.length * 3,
      fallbackProvenanceCount: finishLineDomains.length * 3,
    });
    expect(report.recommendedAssignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'generator', domain: 'svg', decision: 'promote' }),
      expect.objectContaining({ role: 'generator', domain: 'tone', decision: 'hold' }),
      expect.objectContaining({ role: 'generator', domain: 'hyperframes' }),
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

  it('refuses to report a passing live proof when only fixture candidates are available', async () => {
    const out = await tempRoot();

    await runScript(['--live', '--out', out]);

    const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8')) as ModelAssimilationReport;
    // "--live" with fixtures is a lie: the run must be labelled fixture-sourced and fail.
    expect(report.mode).toBe('live');
    expect(report.candidatesSource).toBe('fixture');
    expect(report.status).toBe('fail');
    expect(report.blockers.some(blocker => blocker.includes(FIXTURE_IN_LIVE_BLOCKER))).toBe(true);
    // It must NOT leave a live receipt downstream gates would treat as proof.
    expect(existsSync(join(process.cwd(), '.omx', 'proof', 'model-assimilation-live.json'))).toBe(false);
  });

  it('ranks real candidate evidence (not fixtures) when --candidates is supplied', async () => {
    const out = await tempRoot();
    const candidatesDir = await tempRoot();
    const candidatesPath = join(candidatesDir, 'real-candidates.json');
    const domainScores = {
      svg: 0.86, p5: 0.83, glsl: 0.78, hydra: 0.75, three: 0.80, tone: 0.72,
      strudel: 0.71, revideo: 0.70, hyperframes: 0.81, ascii: 0.68, kinetic: 0.67, textgen: 0.72,
    };
    await writeFile(candidatesPath, JSON.stringify({
      candidates: [{
        model: 'real-audition-model',
        provider: 'openai',
        notes: ['observed live audition'],
        scores: { generator: domainScores, evaluator: domainScores, harness: domainScores },
      }],
    }), 'utf8');

    await runScript(['--live', '--candidates', candidatesPath, '--out', out]);

    const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8')) as ModelAssimilationReport;
    expect(report.candidatesSource).toBe('live');
    expect(report.candidates.map(candidate => candidate.model)).toEqual(['real-audition-model']);
    // The fixture-in-live lie blocker must NOT be present once real candidates are supplied.
    expect(report.blockers.some(blocker => blocker.includes(FIXTURE_IN_LIVE_BLOCKER))).toBe(false);
    expect(report.recommendedAssignments.every(item => item.model === 'real-audition-model')).toBe(true);
  });
});
