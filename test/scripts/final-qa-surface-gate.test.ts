import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { validateCreativeDomainArtifact } from '../../scripts/lib/creative-domain-artifact-validation.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts/ci/final-qa-surface-gate.mjs');
const ledgerPath = path.join(repoRoot, 'docs/launch/final-qa-test-surface-ledger.json');
const launchDomains = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen'];
const extensions: Record<string, string> = {
  p5: 'js',
  svg: 'svg',
  glsl: 'frag',
  three: 'js',
  hydra: 'js',
  strudel: 'js',
  tone: 'html',
  revideo: 'tsx',
  hyperframes: 'html',
  ascii: 'txt',
  kinetic: 'html',
  textgen: 'txt',
};

const artifactSource: Record<string, string> = {
  p5: 'function setup(){ createCanvas(400,400); } function draw(){ background(0); }',
  svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
  glsl: 'precision mediump float; uniform vec2 u_resolution; void main(){ vec2 uv=gl_FragCoord.xy/u_resolution; gl_FragColor=vec4(uv,0.0,1.0); }',
  three: 'const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(); const renderer = new THREE.WebGLRenderer(); renderer.render(scene, camera);',
  hydra: 'osc(8, 0.1, 1).color(1,0,1).out(); render();',
  strudel: 's("bd sn hh").note("c1 g1").out()',
  tone: '<!doctype html><html><body><button>Start</button><script src="Tone.js"></script><script>Tone.start();</script></body></html>',
  revideo: 'import { makeScene2D, Txt } from "@revideo/2d"; import { waitFor } from "@revideo/core"; export default makeScene2D(function*(view){ view.add(<Txt text="hi" />); yield* waitFor(1); });',
  hyperframes: '<!doctype html><html><body><div data-composition-id="x"><div class="clip" data-start="0" data-duration="1" data-track-index="0"></div><div class="clip" data-start="1" data-duration="1" data-track-index="1"></div><div class="clip" data-start="2" data-duration="1" data-track-index="2"></div></div><script>const tl = gsap.timeline(); window.__timelines = { x: tl };</script></body></html>',
  ascii: `/\\
 /  \\
/____\\
|    |
|____|`,
  kinetic: '<!doctype html><html><head><style>@keyframes spin{to{transform:rotate(360deg)}} .word{animation:spin 1s linear infinite}</style></head><body><div class="word">Orbit</div></body></html>',
  textgen: `loop
  dream
    memory
      signal
        threshold
          machine breathing in lines of language`,
};

function currentGitCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function makeReceipt(tempRoot: string, domains = launchDomains, overrides: Record<string, unknown> = {}): string {
  const artifactDir = path.join(tempRoot, 'artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const receiptPath = path.join(tempRoot, 'domain-gauntlet-live.json');
  const receipt = {
    contract: 'liminal-live-creative-domain-execution-v1',
    status: domains.length === launchDomains.length ? 'pass' : 'fail',
    ready: domains.length === launchDomains.length,
    mode: 'live-execution',
    generatedAt: new Date().toISOString(),
    gitCommit: currentGitCommit(),
    provider: 'test-provider',
    model: 'test-model',
    domains: domains.map((domain) => {
      const code = artifactSource[domain];
      const artifactPath = path.join(artifactDir, `${domain}.${extensions[domain]}`);
      writeFileSync(artifactPath, code);
      const artifactValidation = validateCreativeDomainArtifact(domain, artifactPath, code);
      return { domain, status: 'pass', artifactPath, codeBytes: Buffer.byteLength(code, 'utf8'), artifactValidation };
    }),
    ...overrides,
  };
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  return receiptPath;
}

describe('final QA surface gate', () => {
  it('is wired as a package script and documents classified launch surfaces', () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['final-qa:surface']).toBe('node scripts/ci/final-qa-surface-gate.mjs');
    expect(pkg.scripts['gui:build']).toBe('pnpm --dir gui build');
    expect(pkg.scripts['bubbletea:test']).toBe('cd bubbletea && go test ./...');
    expect(pkg.scripts['proof:live-creative-domains']).toBe('tsx scripts/proof/live-creative-domain-execution.ts');
  });

  it('passes with a complete all-domain live receipt and classified pending/skipped tests', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-'));
    try {
      const receiptPath = makeReceipt(tempRoot);
      const output = execFileSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });

      expect(output).toContain('Included surfaces');
      expect(output).toContain('GUI production build');
      expect(output).toContain('Bubble Tea Go tests');
      expect(output).toContain('Creative domains: 12/12 covered');
      expect(output).toContain('Pending tests classified');
      expect(output).toContain('Skipped/gated tests classified');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails when a launch-scoped creative domain is missing from the live receipt', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-missing-'));
    try {
      const receiptPath = makeReceipt(tempRoot, launchDomains.filter((domain) => domain !== 'glsl'));
      const result = spawnSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('Missing creative-domain live artifacts: glsl');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails when a complete live receipt is not bound to the current commit', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-stale-commit-'));
    try {
      const receiptPath = makeReceipt(tempRoot, launchDomains, { gitCommit: '0'.repeat(40) });
      const result = spawnSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('Live creative-domain receipt gitCommit');
      expect(output).toContain('does not match current');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails when a complete live receipt is stale', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-stale-time-'));
    try {
      const receiptPath = makeReceipt(tempRoot, launchDomains, { generatedAt: '2020-01-01T00:00:00.000Z' });
      const result = spawnSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('Live creative-domain receipt is stale');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails when a complete receipt points at non-empty junk instead of domain artifacts', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-final-qa-surface-junk-artifacts-'));
    try {
      const artifactDir = path.join(tempRoot, 'artifacts');
      mkdirSync(artifactDir, { recursive: true });
      const receiptPath = path.join(tempRoot, 'domain-gauntlet-live.json');
      const domains = launchDomains.map((domain) => {
        const artifactPath = path.join(artifactDir, `${domain}.txt`);
        writeFileSync(artifactPath, `${domain} artifact`);
        return {
          domain,
          status: 'pass',
          artifactPath,
          codeBytes: 16,
          artifactValidation: { status: 'pass', checks: [{ name: 'fake', passed: true }], errors: [] },
        };
      });
      writeFileSync(receiptPath, JSON.stringify({
        contract: 'liminal-live-creative-domain-execution-v1',
        status: 'pass',
        ready: true,
        mode: 'live-execution',
        generatedAt: new Date().toISOString(),
        gitCommit: currentGitCommit(),
        provider: 'test-provider',
        model: 'test-model',
        domains,
      }, null, 2));

      const result = spawnSync(process.execPath, [
        scriptPath,
        '--receipt',
        receiptPath,
        '--ledger',
        ledgerPath,
        '--no-write-proof',
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).toBe(1);
      expect(output).toContain('p5 artifact failed domain validation');
      expect(output).toContain('Missing creative-domain live artifacts');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
