import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RalphLoop } from '../../../src/core/RalphLoop.js';
import { ScoringEngine } from '../../../src/core/ScoringEngine.js';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { LoopPersistence } from '../../../src/core/LoopPersistence.js';
import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';

describe('RalphLoop recordRun LiminalFS integration', () => {
  let projectRoot: string;
  let galleryDir: string;
  let originalApiKey: string | undefined;
  let originalCwd: typeof process.cwd;
  let scoreSpy: ReturnType<typeof vi.spyOn>;
  let saveIterationSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-recordrun-test-'));
    galleryDir = mkdtempSync(join(tmpdir(), 'liminal-gallery-test-'));
    originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'fake-api-key-for-tests';
    originalCwd = process.cwd;
    mkdirSync(join(projectRoot, 'config'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'config', 'liminal.json'),
      JSON.stringify({ llm: { provider: 'lmstudio', baseUrl: 'http://localhost:1234/v1', model: 'test-model' } }),
    );
    process.cwd = () => projectRoot;
    generatorRegistry.clear();

    generatorRegistry.register({
      name: 'p5',
      canHandle: () => 1,
      generate: async () => ({
        code: 'function setup() { createCanvas(400, 400); noLoop(); frameRate(30); } function draw() { background(220); fill(255, 0, 0); circle(200, 200, 50); }',
      }),
    });

    scoreSpy = vi.spyOn(ScoringEngine.prototype, 'scoreReliable').mockResolvedValue({
      score: 0.85,
      issues: [],
      dimensions: {
        technical: 0.85,
        creative: 0.85,
        novelty: 0.85,
        aesthetic: 0.85,
        emergence: 0.85,
        interestingness: 0.85,
      },
    });

    saveIterationSpy = vi.spyOn(LoopPersistence.prototype, 'saveIteration');
  });

  afterEach(() => {
    RalphLoop.reset();
    generatorRegistry.clear();
    scoreSpy.mockRestore();
    saveIterationSpy.mockRestore();
    process.env.OPENAI_API_KEY = originalApiKey;
    process.cwd = originalCwd;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(galleryDir, { recursive: true, force: true });
  });

  it('writes run artifact and run record to LiminalFS', async () => {
    // This test exercises real LiminalFS I/O; takes ~4s solo, needs headroom under parallel load
    const result = await RalphLoop.run('p5 sketch with circle', {
      project: 'test-project',
      maxIterations: 1,
      minQualityScore: 0,
      evalMode: 'legacy',
      galleryDir,
      git: { enabled: false },
    });

    expect(result.iterations).toBe(1);
    expect(result.code).toContain('function setup()');
    expect(saveIterationSpy).toHaveBeenCalledTimes(1);

    // Re-open LiminalFS to inspect persisted data
    const fs = LiminalFS.open(projectRoot);

    // Verify LoopPersistence wrote gallery refs
    const latestRef = fs.readRef('gallery/test-project/latest');
    expect(latestRef).not.toBeNull();
    expect(latestRef?.kind).toBe('gallery-version');

    // Verify artifact content matches generated code
    const content = fs.readArtifact(latestRef!);
    expect(content?.toString('utf-8')).toBe(
      'function setup() { createCanvas(400, 400); noLoop(); frameRate(30); } function draw() { background(220); fill(255, 0, 0); circle(200, 200, 50); }'
    );

    // Verify run record exists in EventStore
    const eventStore = fs.getProjectStore().getEventStore();
    const runs = eventStore.queryEvents({ type: 'run_record', limit: 10 });
    expect(runs.length).toBeGreaterThanOrEqual(1);
    const finalRun = runs.find((r: any) => r.payload.status !== 'started');

    expect(result.completed).toBe(false);
    expect(result.reason).toBe('max iterations reached (1)');
    expect(finalRun!.payload.status).toBe('suspended');
    expect(finalRun!.payload.project).toBe('test-project');
    expect(finalRun!.payload.artifacts.length).toBe(1);
    expect(finalRun!.payload.metadata.iterations).toBe(1);
    expect(finalRun!.payload.metadata.reason).toBe('max iterations reached (1)');

    fs.close();
  }, 30000);
});
