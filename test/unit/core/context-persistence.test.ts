import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ContextAccumulation } from '../../../src/core/ContextAccumulation.js';
import { ensureDir } from '../../../src/utils/fs.js';

const tmpDir = path.join(os.tmpdir(), `atelier-persist-test-${Date.now()}`);

beforeAll(() => {
  ensureDir(tmpDir);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ContextAccumulation state persistence', () => {
  it('saveState writes JSON to file', () => {
    const ctx = new ContextAccumulation();
    const filePath = path.join(tmpDir, 'state1.json');
    const state = {
      bestFitness: 0.85,
      iterationsSinceLastImprovement: 2,
      budgetUsed: 0.42,
      totalIterations: 10,
      savedAt: new Date().toISOString(),
    };
    ctx.saveState(filePath, state);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.bestFitness).toBe(0.85);
    expect(content.iterationsSinceLastImprovement).toBe(2);
  });

  it('loadState reads and returns persisted state', () => {
    const ctx = new ContextAccumulation();
    const filePath = path.join(tmpDir, 'state2.json');
    const state = {
      bestFitness: 0.92,
      iterationsSinceLastImprovement: 0,
      budgetUsed: 0.1,
      totalIterations: 5,
      savedAt: new Date().toISOString(),
    };
    ctx.saveState(filePath, state);

    const loaded = ctx.loadState(filePath);
    expect(loaded.isOk()).toBe(true);
    if (loaded.isOk()) {
      expect(loaded.value.bestFitness).toBe(0.92);
      expect(loaded.value.totalIterations).toBe(5);
    }
  });

  it('loadState returns err for missing file', () => {
    const ctx = new ContextAccumulation();
    const loaded = ctx.loadState(path.join(tmpDir, 'nonexistent.json'));
    expect(loaded.isErr()).toBe(true);
  });

  it('loadState returns err for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, 'not json', 'utf-8');
    const ctx = new ContextAccumulation();
    const loaded = ctx.loadState(filePath);
    expect(loaded.isErr()).toBe(true);
  });

  it('loadState returns err when bestFitness is not a number', () => {
    const filePath = path.join(tmpDir, 'wrong-type.json');
    fs.writeFileSync(filePath, JSON.stringify({ bestFitness: 'high' }), 'utf-8');
    const ctx = new ContextAccumulation();
    const loaded = ctx.loadState(filePath);
    expect(loaded.isErr()).toBe(true);
  });
});
