import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';

describe('GUI progress dashboard', () => {
  let server;
  let port;
  let tempDir;
  let previousHome;
  let previousLedgerPath;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sinter-progress-'));
    previousHome = process.env.HOME;
    previousLedgerPath = process.env.SINTER_PROGRESS_LEDGER_PATH;
    process.env.HOME = tempDir;

    const archiveDir = path.join(tempDir, '.sinter', 'archive');
    await fs.mkdir(archiveDir, { recursive: true });
    const entries = Array.from({ length: 9 }, (_, i) => ({
      id: `p5_test_${i}`,
      domain: 'p5',
      prompt: `p5 prompt ${i}`,
      output: 'function setup(){} function draw(){}',
      qualityScore: 0.7 + i / 100,
      createdAt: `2026-06-12T15:0${i}:00.000Z`,
      metadata: i === 0 ? { rescore: { priorScore: 0.95, rescoredAt: '2026-06-12T15:30:00.000Z', provenance: 'test' } } : {},
    }));
    entries.push({
      id: 'three_minimax',
      domain: 'three',
      prompt: 'new three prompt',
      output: 'console.log("three")',
      qualityScore: 0.82,
      createdAt: '2026-06-12T16:01:00.000Z',
      metadata: {},
    });
    entries.push(...Array.from({ length: 4 }, (_, i) => ({
      id: `glsl_test_${i}`,
      domain: 'glsl',
      prompt: `glsl prompt ${i}`,
      output: 'void main(){ gl_FragColor = vec4(1.0); }',
      qualityScore: 0.76 + i / 100,
      createdAt: `2026-06-12T16:1${i}:00.000Z`,
      metadata: {},
    })));
    entries.push({
      id: 'p5_quarantined',
      domain: 'p5',
      prompt: 'hidden',
      output: 'bad',
      qualityScore: 0.99,
      createdAt: '2026-06-12T16:02:00.000Z',
      metadata: { quarantinedAt: '2026-06-12T16:03:00.000Z' },
    });
    await fs.writeFile(path.join(archiveDir, 'quality_archive.json'), JSON.stringify({
      archives: {
        p5: entries.filter((e) => e.domain === 'p5'),
        glsl: entries.filter((e) => e.domain === 'glsl'),
        three: entries.filter((e) => e.domain === 'three'),
      },
    }), 'utf8');

    const ledgerPath = path.join(tempDir, 'self-improve-ledger.jsonl');
    process.env.SINTER_PROGRESS_LEDGER_PATH = ledgerPath;
    await fs.writeFile(ledgerPath, [
      JSON.stringify({ ts: '2026-06-11T23:59:00.000Z', targetedDomains: ['p5'], scores: [0.7], after: { archive: 10 } }),
      JSON.stringify({ ts: '2026-06-12T16:05:00.000Z', targetedDomains: ['p5', 'three'], scores: [0.81, 0.82], admitted: 1, after: { archive: 11 } }),
      JSON.stringify({ ts: '2026-06-12T16:20:00.000Z', targetedDomains: ['hydra'], scores: [0.9], admitted: 5, after: { archive: 16 } }),
    ].join('\n'), 'utf8');

    const { createApp } = await import('../../gui/server.js');
    server = http.createServer(createApp(undefined, 0));
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousLedgerPath === undefined) delete process.env.SINTER_PROGRESS_LEDGER_PATH;
    else process.env.SINTER_PROGRESS_LEDGER_PATH = previousLedgerPath;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('serves aggregated progress data without quarantined archive entries', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/progress/data`);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.entriesByDomain.p5).toHaveLength(9);
    expect(data.entriesByDomain.p5.map((entry) => entry.id)).not.toContain('p5_quarantined');
    expect(data.entriesByDomain.three[0]).toMatchObject({
      id: 'three_minimax',
      modelLabel: 'MiniMax-M3',
      modelSource: 'era-derived',
    });
    expect(data.entriesByDomain.p5.find((entry) => entry.id === 'p5_test_0').rescore).toMatchObject({
      priorScore: 0.95,
      currentScore: 0.7,
    });
    expect(data.timeline.map((line) => line.admitted)).toEqual([null, 1, 5]);
  });

  it('server-renders the progress page with lazy capped iframes and honesty markers', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/progress`);
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('--sinter-bg-void');
    expect(html).toContain('scores became honest here');
    expect(html).toContain('0.95 → 0.70');
    expect(html).toContain('admitted 1');
    expect(html).toContain('admitted 5');
    expect(html).toContain('model (era-derived): MiniMax-M3');
    expect((html.match(/\ssrc="\/api\/archive\/p5_test_/g) || [])).toHaveLength(8);
    expect((html.match(/data-src="\/api\/archive\/p5_test_/g) || [])).toHaveLength(1);
    expect((html.match(/\ssrc="\/api\/archive\/glsl_test_/g) || [])).toHaveLength(2);
    expect((html.match(/data-src="\/api\/archive\/glsl_test_/g) || [])).toHaveLength(2);
  });
});
