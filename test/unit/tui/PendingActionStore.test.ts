import { describe, it, expect } from 'vitest';
import { PendingActionStore } from '../../../src/tui/PendingActionStore.js';

describe('PendingActionStore', () => {
  it('creates a pending action with structured kind and returns record', () => {
    const store = new PendingActionStore();
    const record = store.create('structured', {
      id: 'task-1', title: 'Fix bug', description: 'Fix the bug in module X',
      targetFile: 'src/foo.ts', approved: false,
    });
    expect(record.id).toMatch(/^pending-/);
    expect(record.kind).toBe('structured');
    expect(record.title).toBe('Fix bug');
    expect(record.createdAt).toBeTruthy();
    expect(record.task).toEqual({
      id: 'task-1', title: 'Fix bug', description: 'Fix the bug in module X',
      targetFile: 'src/foo.ts', approved: false,
    });
  });

  it('creates a pending action with llm kind and returns record', () => {
    const store = new PendingActionStore();
    const record = store.create('llm', {
      id: 'task-2', title: 'Generate art', description: 'Create colorful hydra',
      fileHint: 'src/art.ts', approved: false,
    });
    expect(record.kind).toBe('llm');
    expect(record.task).toEqual({
      id: 'task-2', title: 'Generate art', description: 'Create colorful hydra',
      fileHint: 'src/art.ts', approved: false,
    });
  });

  it('generates unique IDs for each action', () => {
    const store = new PendingActionStore();
    const r1 = store.create('structured', { id: 'a', title: 'A', description: 'A', approved: false });
    const r2 = store.create('llm', { id: 'b', title: 'B', description: 'B', approved: false });
    expect(r1.id).not.toBe(r2.id);
  });

  it('gets a record by ID', () => {
    const store = new PendingActionStore();
    const created = store.create('structured', { id: 't', title: 'T', description: 'T', approved: false });
    const retrieved = store.get(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(created.id);
  });

  it('returns undefined for nonexistent ID', () => {
    const store = new PendingActionStore();
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('confirm removes the record and returns it', () => {
    const store = new PendingActionStore();
    const created = store.create('structured', { id: 't', title: 'T', description: 'T', approved: false });
    const confirmed = store.confirm(created.id);
    expect(confirmed).toBeDefined();
    expect(confirmed!.id).toBe(created.id);
    expect(store.get(created.id)).toBeUndefined();
  });

  it('confirm returns undefined for already-confirmed action', () => {
    const store = new PendingActionStore();
    const created = store.create('structured', { id: 't', title: 'T', description: 'T', approved: false });
    store.confirm(created.id);
    expect(store.confirm(created.id)).toBeUndefined();
  });

  it('confirm returns undefined for nonexistent ID', () => {
    const store = new PendingActionStore();
    expect(store.confirm('nonexistent')).toBeUndefined();
  });

  it('cancel removes the record and returns true', () => {
    const store = new PendingActionStore();
    const created = store.create('structured', { id: 't', title: 'T', description: 'T', approved: false });
    expect(store.cancel(created.id)).toBe(true);
    expect(store.get(created.id)).toBeUndefined();
  });

  it('cancel returns false for nonexistent ID', () => {
    const store = new PendingActionStore();
    expect(store.cancel('nonexistent')).toBe(false);
  });

  it('cancel returns false for already-cancelled action', () => {
    const store = new PendingActionStore();
    const created = store.create('structured', { id: 't', title: 'T', description: 'T', approved: false });
    store.cancel(created.id);
    expect(store.cancel(created.id)).toBe(false);
  });

  it('list returns all pending records', () => {
    const store = new PendingActionStore();
    store.create('structured', { id: 'a', title: 'A', description: 'A', approved: false });
    store.create('llm', { id: 'b', title: 'B', description: 'B', approved: false });
    store.create('structured', { id: 'c', title: 'C', description: 'C', approved: false });
    expect(store.list()).toHaveLength(3);
  });

  it('list does not include confirmed or cancelled records', () => {
    const store = new PendingActionStore();
    const r1 = store.create('structured', { id: 'a', title: 'A', description: 'A', approved: false });
    const r2 = store.create('llm', { id: 'b', title: 'B', description: 'B', approved: false });
    store.create('structured', { id: 'c', title: 'C', description: 'C', approved: false });
    store.confirm(r1.id);
    store.cancel(r2.id);
    const remaining = store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('C');
  });

  it('list returns empty array when store is empty', () => {
    const store = new PendingActionStore();
    expect(store.list()).toEqual([]);
  });
});
