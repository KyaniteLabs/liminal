import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostGenerationCognitiveWriter } from '../../src/tui-bridge/PostGenerationCognitiveWriter.js';

const okSave = { isErr: () => false };

describe('PostGenerationCognitiveWriter', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => rm(dir, { recursive: true, force: true })));
  });

  async function tempRoot(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'liminal-cognition-'));
    tempDirs.push(dir);
    return dir;
  }

  it('retrieves prior domain memory before generation and reports an observed receipt', async () => {
    const memory = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRelevantEpisodesByDomain: vi.fn().mockResolvedValue([
        { id: 'ep-1', prompt: 'previous nebula', domain: 'p5' },
      ]),
      recordEpisode: vi.fn(),
      save: vi.fn().mockResolvedValue(okSave),
    };
    const writer = new PostGenerationCognitiveWriter({ memory });

    const receipts = await writer.prepareGeneration({
      sessionId: 'session-1',
      userText: 'make a living nebula',
      domain: 'p5',
    });

    expect(memory.initialize).toHaveBeenCalledTimes(1);
    expect(memory.getRelevantEpisodesByDomain).toHaveBeenCalledWith('make a living nebula', 'p5', 3);
    expect(receipts).toContainEqual({
      organ: 'memory',
      status: 'observed',
      detail: 'Retrieved 1 relevant prior generation episode for p5.',
    });
  });

  it('writes completed generations into memory, compost heap, and dream queue receipts', async () => {
    const root = await tempRoot();
    const memory = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRelevantEpisodesByDomain: vi.fn().mockResolvedValue([]),
      recordEpisode: vi.fn().mockReturnValue('ep-123'),
      save: vi.fn().mockResolvedValue(okSave),
    };
    const compost = { add: vi.fn().mockResolvedValue(undefined) };
    const dreamQueue = { enqueue: vi.fn().mockReturnValue('dream-1') };
    const writer = new PostGenerationCognitiveWriter({ memory, compost, dreamQueue, artifactRoot: root });

    const result = await writer.writeBackGeneration({
      sessionId: 'studio/session',
      userText: 'make a green signal garden',
      domain: 'svg',
      code: '<svg><circle fill="green" /></svg>',
      finalScore: 0.82,
      iterations: 2,
      model: 'gpt-test',
      reason: 'accepted',
      executionMode: 'prove',
    });

    expect(memory.recordEpisode).toHaveBeenCalledWith(expect.objectContaining({
      type: 'generation',
      domain: 'svg',
      prompt: 'make a green signal garden',
      code: '<svg><circle fill="green" /></svg>',
      score: 0.82,
      tags: expect.arrayContaining(['studio', 'tui-bridge', 'execution:prove', 'model:gpt-test']),
    }));
    expect(memory.save).toHaveBeenCalled();
    expect(compost.add).toHaveBeenCalledWith([result.artifactPath]);
    expect(dreamQueue.enqueue).toHaveBeenCalledWith('elite-x-compost', [expect.objectContaining({ id: 'ep-123', quality: 0.82 })], 0.82);
    expect(await readFile(result.artifactPath, 'utf8')).toContain('green');
    expect(result.receipts).toEqual(expect.arrayContaining([
      { organ: 'memory', status: 'observed', detail: 'Stored generation episode ep-123 for future retrieval.' },
      { organ: 'compost', status: 'observed', detail: `Added generated artifact to compost heap: ${result.artifactPath}` },
      { organ: 'dreaming', status: 'observed', detail: 'Queued dream recombination task dream-1 from episode ep-123.' },
    ]));
  });

  it('keeps successful organ receipts when another write-back organ fails', async () => {
    const root = await tempRoot();
    const memory = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getRelevantEpisodesByDomain: vi.fn().mockResolvedValue([]),
      recordEpisode: vi.fn().mockReturnValue('ep-ok'),
      save: vi.fn().mockResolvedValue(okSave),
    };
    const compost = { add: vi.fn().mockRejectedValue(new Error('heap unavailable')) };
    const dreamQueue = { enqueue: vi.fn().mockReturnValue('dream-ok') };
    const writer = new PostGenerationCognitiveWriter({ memory, compost, dreamQueue, artifactRoot: root });

    const result = await writer.writeBackGeneration({
      sessionId: 'session-1',
      userText: 'make a blue sketch',
      domain: 'p5',
      code: 'function setup() {}',
      finalScore: 0.4,
      iterations: 1,
      model: 'gpt-test',
      reason: 'draft',
      executionMode: 'draft',
    });

    expect(result.receipts).toContainEqual({ organ: 'memory', status: 'observed', detail: 'Stored generation episode ep-ok for future retrieval.' });
    expect(result.receipts).toContainEqual({ organ: 'compost', status: 'unavailable', detail: 'Compost write-back failed: heap unavailable' });
    expect(result.receipts).toContainEqual({ organ: 'dreaming', status: 'observed', detail: 'Queued dream recombination task dream-ok from episode ep-ok.' });
  });
});
