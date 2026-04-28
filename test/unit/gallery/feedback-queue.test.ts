import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * FeedbackQueue tests - JSONL-based human rating storage
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { FeedbackQueue } from '../../../src/gallery/FeedbackQueue.js';

describe('FeedbackQueue', () => {
  let tmpDir: string;
  let tmpFile: string;
  let queue: FeedbackQueue;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-queue-test-')) as string;
    tmpFile = path.join(tmpDir, 'feedback.jsonl');
    queue = new FeedbackQueue(tmpFile);
  });

  afterEach(async () => {
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // already gone
    }
  });

  it('constructor uses default path when none provided', () => {
    const q = new FeedbackQueue();
    // Access private field via any cast to verify
    expect((q as any).path).toBe('gallery/feedback.jsonl');
  });

  it('constructor accepts custom path', () => {
    const q = new FeedbackQueue('/custom/path.jsonl');
    expect((q as any).path).toBe('/custom/path.jsonl');
  });

  it('add generates id and timestamp', () => {
    const entry = queue.add({
      creationId: 'c1',
      rating: 4,
      processed: false,
    });

    expect(entry.id).toMatch(/^fb_\d+_[a-z0-9]+$/);
    expect(entry.timestamp).not.toBeNull();
    expect(new Date(entry.timestamp).getTime()).not.toBeNaN();
  });

  it('add stores feedback in memory', () => {
    queue.add({ creationId: 'c1', rating: 3, processed: false });
    queue.add({ creationId: 'c2', rating: 5, processed: false });

    const all = queue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].creationId).toBe('c1');
    expect(all[1].creationId).toBe('c2');
  });

  it('pending returns only unprocessed entries', () => {
    const e1 = queue.add({ creationId: 'c1', rating: 3, processed: false });
    const e2 = queue.add({ creationId: 'c2', rating: 5, processed: false });
    const e3 = queue.add({ creationId: 'c3', rating: 1, processed: false });

    queue.markProcessed(e2.id);

    const pending = queue.pending();
    expect(pending).toHaveLength(2);
    const pendingIds = pending.map((f: { id: string }) => f.id);
    expect(pendingIds).toContain(e1.id);
    expect(pendingIds).toContain(e3.id);
    expect(pendingIds).not.toContain(e2.id);
  });

  it('markProcessed updates entry', () => {
    const entry = queue.add({ creationId: 'c1', rating: 4, processed: false });
    expect(entry.processed).toBe(false);

    queue.markProcessed(entry.id);

    const all = queue.getAll();
    expect(all[0].processed).toBe(true);
  });

  it('getAll returns all entries', () => {
    queue.add({ creationId: 'c1', rating: 1, processed: false });
    queue.add({ creationId: 'c2', rating: 2, processed: true });

    const all = queue.getAll();
    expect(all).toHaveLength(2);
  });

  it('save writes JSONL file', async () => {
    queue.add({ creationId: 'c1', rating: 3, processed: false });
    queue.add({ creationId: 'c2', rating: 5, processed: true });

    await queue.save();

    const content = await fsp.readFile(tmpFile, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const parsed = lines.map((l: string) => JSON.parse(l));
    expect(parsed[0].creationId).toBe('c1');
    expect(parsed[1].creationId).toBe('c2');
    expect(parsed[1].processed).toBe(true);
  });

  it('load reads JSONL file', async () => {
    const data = [
      { id: 'fb_1_abc', creationId: 'c1', rating: 3, timestamp: '2026-01-01T00:00:00Z', processed: false },
      { id: 'fb_2_def', creationId: 'c2', rating: 5, timestamp: '2026-01-02T00:00:00Z', processed: true },
    ];
    await fsp.writeFile(tmpFile, data.map(d => JSON.stringify(d)).join('\n') + '\n', 'utf-8');

    await queue.load();

    const all = queue.getAll();
    expect(all).toHaveLength(2);
    expect(all[0].id).toBe('fb_1_abc');
    expect(all[1].rating).toBe(5);
  });

  it('load creates empty array if file does not exist', async () => {
    await queue.load();
    expect(queue.getAll()).toHaveLength(0);
  });

  it('round-trip: save then load preserves data', async () => {
    queue.add({ creationId: 'c1', rating: 3, processed: false });
    queue.add({ creationId: 'c2', rating: 5, processed: true });
    queue.markProcessed(queue.getAll()[1].id);

    await queue.save();

    const queue2 = new FeedbackQueue(tmpFile);
    await queue2.load();

    const loaded = queue2.getAll();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].creationId).toBe('c1');
    expect(loaded[0].rating).toBe(3);
    expect(loaded[0].processed).toBe(false);
    expect(loaded[1].creationId).toBe('c2');
    expect(loaded[1].rating).toBe(5);
    expect(loaded[1].processed).toBe(true);
  });
});
