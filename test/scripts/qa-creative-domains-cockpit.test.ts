import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'qa-creative-domains.mjs');

const domains = ['p5', 'svg', 'glsl', 'three', 'hydra', 'strudel', 'tone', 'revideo', 'html', 'ascii', 'kinetic', 'textgen'];

describe('creative-domain QA cockpit script', () => {
  it('is valid JavaScript syntax', () => {
    expect(() => {
      execFileSync(process.execPath, ['--check', scriptPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    }).not.toThrow();
  });

  it('builds a disposable manual cockpit bundle from domain artifacts', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-qa-cockpit-test-'));
    try {
      const inputDir = path.join(tempRoot, 'sweep');
      const outDir = path.join(tempRoot, 'cockpit');
      mkdirSync(inputDir, { recursive: true });

      const results = domains.map((domain) => {
        const domainDir = path.join(inputDir, domain);
        mkdirSync(domainDir, { recursive: true });
        const fileName = `${domain}.html`;
        writeFileSync(
          path.join(domainDir, fileName),
          `<!DOCTYPE html><html><head><title>${domain}</title></head><body><canvas data-domain="${domain}"></canvas></body></html>`,
        );
        return { domain, success: true, outputDir: domainDir, html: path.join(domainDir, fileName) };
      });
      writeFileSync(path.join(inputDir, 'summary.json'), JSON.stringify({ results }, null, 2));

      execFileSync(process.execPath, [scriptPath, '--input', inputDir, '--out', outDir, '--no-serve'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const cockpit = readFileSync(path.join(outDir, 'cockpit.html'), 'utf8');
      const checklist = readFileSync(path.join(outDir, 'checklist.md'), 'utf8');
      const bugReport = readFileSync(path.join(outDir, 'bug-report.md'), 'utf8');
      const summary = JSON.parse(readFileSync(path.join(outDir, 'summary.json'), 'utf8'));

      for (const domain of domains) {
        expect(cockpit).toContain(`data-domain="${domain}"`);
        expect(checklist).toContain(` ${domain} `);
      }
      const scripts = [...cockpit.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
      expect(scripts.length).toBeGreaterThan(0);
      expect(() => scripts.forEach((script) => new vm.Script(script))).not.toThrow();
      expect(cockpit).toContain('Run machine checks');
      expect(cockpit).toContain('Manual checks that still need human senses');
      expect(cockpit).toContain('/artifact/p5');
      expect(checklist).toContain('## Recording order');
      expect(bugReport).toContain('Expected vs actual');
      expect(bugReport).toContain('Marketing-recording impact');
      expect(summary.domains).toHaveLength(12);
      expect(summary.missingDomains).toEqual([]);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds from the live all-domain receipt shape', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-live-qa-cockpit-test-'));
    try {
      const proofDir = path.join(tempRoot, 'proof');
      const artifactDir = path.join(proofDir, 'live-creative-domains');
      const outDir = path.join(tempRoot, 'cockpit');
      mkdirSync(artifactDir, { recursive: true });

      const receipt = {
        domains: domains.map((domain) => {
          const ext = domain === 'svg' ? 'svg' : domain === 'ascii' || domain === 'textgen' ? 'txt' : 'html';
          const artifactPath = path.join(artifactDir, `${domain}.${ext}`);
          writeFileSync(
            artifactPath,
            ext === 'svg' ? `<svg><text>${domain}</text></svg>` : `<!doctype html><body>${domain}</body>`,
          );
          return { domain, status: 'pass', artifactPath };
        }),
      };
      const receiptPath = path.join(proofDir, 'domain-gauntlet-live.json');
      writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));

      execFileSync(process.execPath, [scriptPath, '--input', receiptPath, '--out', outDir, '--no-serve'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const summary = JSON.parse(readFileSync(path.join(outDir, 'summary.json'), 'utf8'));
      expect(summary.domains).toHaveLength(12);
      expect(summary.missingDomains).toEqual([]);
      expect(readFileSync(path.join(outDir, 'checklist.md'), 'utf8')).toContain('## Recording order');
      expect(readFileSync(path.join(outDir, 'bug-report.md'), 'utf8')).toContain('Marketing-recording impact');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
