import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HarnessMemory } from '../../../src/harness/HarnessMemory.js';
import { Status } from '../../../src/types/status.js';

vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/embeddings/EmbeddingService.js', () => ({
  getGlobalEmbeddingService: vi.fn(),
}));

vi.mock('../../../src/utils/vectors.js', () => ({
  findKNearestNeighbors: vi.fn(),
}));

// Helper: create and initialize a fresh HarnessMemory per test.
// Each test gets its own instance with clean state.
async function createMemory(): Promise<HarnessMemory> {
  const { promises: fs } = await import('node:fs');
  vi.mocked(fs).readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  vi.mocked(fs).writeFile.mockResolvedValue(undefined);
  const mem = new HarnessMemory();
  await mem.initialize();
  return mem;
}

describe('HarnessMemory', () => {
  let memory: HarnessMemory;

  beforeEach(async () => {
    vi.clearAllMocks();
    memory = await createMemory();
  });

  describe('task operations', () => {
    it('starts a task and returns its id', () => {
      const id = memory.startTask({ type: 'M1', description: 'Test task' });
      expect(id).toMatch(/^task_/);
      const tasks = memory.getTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].status).toBe(Status.IN_PROGRESS);
      expect(tasks[0].type).toBe('M1');
    });

    it('completes a task with outcome', () => {
      const id = memory.startTask({ type: 'M2', description: 'Complete me' });
      memory.completeTask(id, { status: Status.COMPLETED, outcome: 'done', artifacts: ['file.ts'] });
      const task = memory.getTasks().find(t => t.id === id)!;
      expect(task.status).toBe(Status.COMPLETED);
      expect(task.outcome).toBe('done');
      expect(task.artifacts).toEqual(['file.ts']);
      expect(task.completedAt).toBeDefined();
    });

    it('completes a task with error', () => {
      const id = memory.startTask({ type: 'M3', description: 'Fail me' });
      memory.completeTask(id, { status: Status.FAILED, error: 'timeout' });
      const task = memory.getTasks().find(t => t.id === id)!;
      expect(task.status).toBe(Status.FAILED);
      expect(task.error).toBe('timeout');
    });

    it('ignores completeTask for nonexistent id', () => {
      memory.startTask({ type: 'M4', description: 'Only task' });
      memory.completeTask('task_nonexistent', { status: Status.COMPLETED });
      expect(memory.getTasks()).toHaveLength(1);
      expect(memory.getTasks()[0].status).toBe(Status.IN_PROGRESS);
    });

    it('getPendingTasks returns only pending tasks', () => {
      const id = memory.startTask({ type: 'M5', description: 'Active' });
      memory.completeTask(id, { status: Status.COMPLETED });
      expect(memory.getPendingTasks()).toHaveLength(0);
    });

    it('getIncompleteTasks returns pending and in-progress', () => {
      memory.startTask({ type: 'M7', description: 'In progress' });
      expect(memory.getIncompleteTasks()).toHaveLength(1);
    });

    it('getTasksByType filters by type', () => {
      memory.startTask({ type: 'M1', description: 'First' });
      memory.startTask({ type: 'M2', description: 'Second' });
      memory.startTask({ type: 'M1', description: 'Third' });
      expect(memory.getTasksByType('M1')).toHaveLength(2);
      expect(memory.getTasksByType('M2')).toHaveLength(1);
    });
  });

  describe('adaptation operations', () => {
    it('records an adaptation', () => {
      const id = memory.recordAdaptation({
        patternName: 'missing-setup',
        patternSeverity: 'high',
        fixType: 'prompt',
        description: 'Added setup() prompt',
        success: true,
      });
      expect(id).toMatch(/^adapt_/);
      expect(memory.getAdaptations()).toHaveLength(1);
    });

    it('filters successful adaptations', () => {
      memory.recordAdaptation({
        patternName: 'p1', patternSeverity: 'low', fixType: 'config',
        description: 'Config fix', success: true,
      });
      memory.recordAdaptation({
        patternName: 'p2', patternSeverity: 'medium', fixType: 'code',
        description: 'Code fix', success: false,
      });
      expect(memory.getSuccessfulAdaptations()).toHaveLength(1);
    });

    it('filters adaptations by pattern name', () => {
      memory.recordAdaptation({
        patternName: 'washout', patternSeverity: 'high', fixType: 'prompt',
        description: 'Fix 1', success: true,
      });
      memory.recordAdaptation({
        patternName: 'other', patternSeverity: 'low', fixType: 'template',
        description: 'Fix 2', success: true,
      });
      expect(memory.getAdaptationsForPattern('washout')).toHaveLength(1);
    });

    it('increments totalAdaptations stat', () => {
      memory.recordAdaptation({
        patternName: 'p', patternSeverity: 'low', fixType: 'manual',
        description: 'Manual fix', success: true,
      });
      expect(memory.getStats().totalAdaptations).toBe(1);
    });
  });

  describe('episode operations', () => {
    it('records a generation episode', () => {
      const id = memory.recordEpisode({
        type: 'generation',
        domain: 'hydra',
        prompt: 'test prompt',
        code: 'osc()',
        score: 0.8,
      });
      expect(id).toMatch(/^ep_/);
      expect(memory.getStats().totalGenerations).toBe(1);
    });

    it('records a conversation episode', () => {
      memory.recordEpisode({ type: 'conversation', comment: 'user feedback' });
      expect(memory.getStats().totalConversations).toBe(1);
    });

    it('does not increment counters for feedback type', () => {
      memory.recordEpisode({ type: 'feedback', comment: 'liked it' });
      expect(memory.getStats().totalGenerations).toBe(0);
      expect(memory.getStats().totalConversations).toBe(0);
    });

    it('getRecentEpisodes returns sorted by timestamp', () => {
      vi.useFakeTimers();
      memory.recordEpisode({ type: 'generation', prompt: 'first' });
      vi.advanceTimersByTime(10);
      memory.recordEpisode({ type: 'generation', prompt: 'second' });
      const recent = memory.getRecentEpisodes(10);
      expect(recent[0].prompt).toBe('second');
      vi.useRealTimers();
    });

    it('getEpisodesByType filters correctly', () => {
      memory.recordEpisode({ type: 'generation', prompt: 'gen' });
      memory.recordEpisode({ type: 'conversation', comment: 'conv' });
      expect(memory.getEpisodesByType('generation')).toHaveLength(1);
    });

    it('getEpisodesByDomain filters correctly', () => {
      memory.recordEpisode({ type: 'generation', domain: 'hydra', prompt: 'h' });
      memory.recordEpisode({ type: 'generation', domain: 'p5', prompt: 'p' });
      expect(memory.getEpisodesByDomain('hydra')).toHaveLength(1);
    });
  });

  describe('pattern operations', () => {
    it('records a new pattern', () => {
      memory.recordPatternOccurrence('washout', 'hydra');
      const history = memory.getPatternHistory();
      expect(history).toHaveLength(1);
      expect(history[0].patternName).toBe('washout');
      expect(history[0].occurrences).toBe(1);
      expect(history[0].affectedDomains).toEqual(['hydra']);
    });

    it('increments existing pattern occurrences', () => {
      memory.recordPatternOccurrence('washout', 'hydra');
      memory.recordPatternOccurrence('washout', 'p5');
      const pattern = memory.getPatternHistory()[0];
      expect(pattern.occurrences).toBe(2);
      expect(pattern.affectedDomains).toContain('hydra');
      expect(pattern.affectedDomains).toContain('p5');
    });

    it('does not duplicate domain in affectedDomains', () => {
      memory.recordPatternOccurrence('washout', 'hydra');
      memory.recordPatternOccurrence('washout', 'hydra');
      const pattern = memory.getPatternHistory()[0];
      expect(pattern.affectedDomains).toEqual(['hydra']);
      expect(pattern.occurrences).toBe(2);
    });

    it('getFrequentPatterns filters by min occurrences', () => {
      memory.recordPatternOccurrence('rare', 'p5');
      memory.recordPatternOccurrence('common', 'hydra');
      memory.recordPatternOccurrence('common', 'hydra');
      memory.recordPatternOccurrence('common', 'p5');
      // 'common' has 3 occurrences; threshold uses >=
      expect(memory.getFrequentPatterns(4)).toHaveLength(0);
      expect(memory.getFrequentPatterns(3)).toHaveLength(1);
    });
  });

  describe('calibration operations', () => {
    it('records calibration for a new domain', () => {
      memory.recordCalibration('hydra', { depth: 0.8, composition: 0.6, novelty: 0.9 }, 0.85, 50);
      expect(memory.isCalibrated('hydra')).toBe(true);
      expect(memory.getStats().totalCalibrations).toBe(1);
    });

    it('updates existing calibration', () => {
      memory.recordCalibration('hydra', { depth: 0.8, composition: 0.6, novelty: 0.9 }, 0.85, 50);
      memory.recordCalibration('hydra', { depth: 0.9, composition: 0.7, novelty: 0.8 }, 0.90, 100);
      expect(memory.getAllCalibrations()).toHaveLength(1);
      expect(memory.getStats().totalCalibrations).toBe(1);
      expect(memory.getCalibration('hydra')?.sampleCount).toBe(100);
    });

    it('getCalibrationWeights returns weights for domain', () => {
      memory.recordCalibration('p5', { depth: 0.5, composition: 0.5, novelty: 0.5 }, 0.7, 20);
      const weights = memory.getCalibrationWeights('p5');
      expect(weights).toEqual({ depth: 0.5, composition: 0.5, novelty: 0.5 });
    });

    it('getCalibrationWeights returns undefined for unknown domain', () => {
      expect(memory.getCalibrationWeights('unknown')).toBeUndefined();
    });

    it('clearCalibration removes specific domain', () => {
      memory.recordCalibration('hydra', { depth: 0.8, composition: 0.6, novelty: 0.9 }, 0.85, 50);
      memory.recordCalibration('p5', { depth: 0.5, composition: 0.5, novelty: 0.5 }, 0.7, 20);
      memory.clearCalibration('hydra');
      expect(memory.isCalibrated('hydra')).toBe(false);
      expect(memory.isCalibrated('p5')).toBe(true);
    });

    it('clearCalibration without domain clears all', () => {
      memory.recordCalibration('hydra', { depth: 0.8, composition: 0.6, novelty: 0.9 }, 0.85, 50);
      memory.recordCalibration('p5', { depth: 0.5, composition: 0.5, novelty: 0.5 }, 0.7, 20);
      memory.clearCalibration();
      expect(memory.getCalibratedDomains()).toEqual([]);
      expect(memory.getStats().totalCalibrations).toBe(0);
    });

    it('serializeCalibration returns expected shape', () => {
      memory.recordCalibration('hydra', { depth: 0.8, composition: 0.6, novelty: 0.9 }, 0.85, 50);
      const serialized = memory.serializeCalibration();
      expect(serialized.version).toBe(1);
      expect(serialized.currentWeights).toHaveProperty('hydra');
      expect(serialized.lastCalibrated).toHaveProperty('hydra');
    });
  });

  describe('save and error handling', () => {
    it('returns ok on successful save', async () => {
      const result = await memory.save();
      expect(result.isOk()).toBe(true);
      expect(memory.hasSaveError).toBe(false);
    });

    it('returns err and sets hasSaveError on failure', async () => {
      const { promises: fs } = await import('node:fs');
      vi.mocked(fs).writeFile.mockRejectedValueOnce(new Error('disk full'));
      const result = await memory.save();
      expect(result.isErr()).toBe(true);
      expect(memory.hasSaveError).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('returns comprehensive status', () => {
      memory.startTask({ type: 'M1', description: 'Test' });
      memory.recordEpisode({ type: 'generation', domain: 'p5', prompt: 'hi' });
      const status = memory.getStatus();
      expect(status.tasksTotal).toBe(1);
      expect(status.episodesTotal).toBe(1);
      expect(status.initialized).toBe(true);
    });
  });
});
