import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoalStore } from '../../../src/cortex/GoalStore.js';
import type { CortexGoal } from '../../../src/cortex/types.js';

// Mock node:fs so listGoals can traverse the in-memory store
// Must use vi.hoisted() because these are referenced inside vi.mock() factory
const { mockExistsSync, mockReaddirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

describe('GoalStore', () => {
  let store: GoalStore;
  let stored: Map<string, Record<string, unknown>>;
  const projectRoot = '/tmp/test-liminal-goalstore';

  const mockFs = {
    getProjectRoot: () => projectRoot,
    writeManifest: vi.fn((name: string, data: Record<string, unknown>) => {
      stored.set(name, data);
    }),
    readManifest: vi.fn((name: string): Record<string, unknown> | null => {
      return stored.get(name) ?? null;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored = new Map();

    // existsSync returns true if we have any goal manifests
    mockExistsSync.mockImplementation((_dir: string) => {
      for (const key of stored.keys()) {
        if (key.startsWith('cortex/goal/')) return true;
      }
      return false;
    });

    // readdirSync returns directory names from stored goal keys
    mockReaddirSync.mockImplementation((_dir: string, _opts?: Record<string, unknown>) => {
      const dirs = new Set<string>();
      for (const key of stored.keys()) {
        if (key.startsWith('cortex/goal/')) {
          const parts = key.split('/');
          if (parts.length >= 3) dirs.add(parts[2]);
        }
      }
      return [...dirs].map((name) => ({ name, isDirectory: () => true }));
    });
  });

  function makeStore(): GoalStore {
    return new GoalStore(mockFs as unknown as import('../../../src/fs/LiminalFS.js').LiminalFS);
  }

  function getStoredGoal(id: string): CortexGoal | null {
    const data = stored.get(`cortex/goal/${id}/manifest`);
    return data as unknown as CortexGoal | null;
  }

  it('adds a goal with auto-generated id and timestamps', () => {
    store = makeStore();
    const goal = store.addGoal({ text: 'Fix coverage above 80%', priority: 'high', category: 'coverage' });

    expect(goal.id).toMatch(/^goal-\d+-[0-9a-f]{6}$/);
    expect(goal.text).toBe('Fix coverage above 80%');
    expect(goal.priority).toBe('high');
    expect(goal.category).toBe('coverage');
    expect(goal.status).toBe('active');
    expect(goal.createdAt).toBeTruthy();
    expect(goal.updatedAt).toBeTruthy();
    expect(mockFs.writeManifest).toHaveBeenCalledTimes(1);

    // Verify persisted
    const stored_goal = getStoredGoal(goal.id);
    expect(stored_goal?.text).toBe('Fix coverage above 80%');
  });

  it('uses default priority and category when omitted', () => {
    store = makeStore();
    const goal = store.addGoal({ text: 'Some goal' });
    expect(goal.priority).toBe('normal');
    expect(goal.category).toBe('maintenance');
  });

  it('loads a goal by id', () => {
    store = makeStore();
    const created = store.addGoal({ text: 'Load test' });
    const loaded = store.getGoal(created.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.text).toBe('Load test');
    expect(loaded!.id).toBe(created.id);
  });

  it('returns null for non-existent goal', () => {
    store = makeStore();
    const result = store.getGoal('goal-nonexistent');
    expect(result).toBeNull();
  });

  it('lists goals sorted by creation time', () => {
    store = makeStore();
    store.addGoal({ text: 'First' });
    store.addGoal({ text: 'Second' });
    store.addGoal({ text: 'Third' });

    const all = store.listGoals();
    expect(all).toHaveLength(3);
    expect(all[0].text).toBe('First');
    expect(all[1].text).toBe('Second');
    expect(all[2].text).toBe('Third');
  });

  it('filters goals by status', () => {
    store = makeStore();
    store.addGoal({ text: 'Active goal' });
    const g2 = store.addGoal({ text: 'To complete' });
    store.completeGoal(g2.id);

    const active = store.listGoals({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe('Active goal');

    const completed = store.listGoals({ status: 'completed' });
    expect(completed).toHaveLength(1);
    expect(completed[0].text).toBe('To complete');
  });

  it('getActiveGoals returns only active goals', () => {
    store = makeStore();
    store.addGoal({ text: 'Active 1' });
    const g2 = store.addGoal({ text: 'Active 2' });
    store.completeGoal(g2.id);

    const active = store.getActiveGoals();
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe('Active 1');
  });

  it('completes a goal and persists the change', () => {
    store = makeStore();
    const created = store.addGoal({ text: 'Finish this' });

    const completed = store.completeGoal(created.id);
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.updatedAt).toBeTruthy();

    // Verify persisted
    const loaded = store.getGoal(created.id);
    expect(loaded!.status).toBe('completed');
  });

  it('returns null when completing non-existent goal', () => {
    store = makeStore();
    const result = store.completeGoal('goal-nonexistent');
    expect(result).toBeNull();
  });

  it('removes a goal by setting dropped status', () => {
    store = makeStore();
    const created = store.addGoal({ text: 'To remove' });
    const removed = store.removeGoal(created.id);
    expect(removed).toBe(true);

    const loaded = store.getGoal(created.id);
    expect(loaded!.status).toBe('dropped');
  });

  it('returns false when removing non-existent goal', () => {
    store = makeStore();
    const result = store.removeGoal('goal-nonexistent');
    expect(result).toBe(false);
  });

  it('empty store returns empty list', () => {
    store = makeStore();
    stored.clear();
    const goals = store.listGoals();
    expect(goals).toEqual([]);
  });

  it('excludes dropped goals from getActiveGoals', () => {
    store = makeStore();
    store.addGoal({ text: 'Active' });
    const g2 = store.addGoal({ text: 'Dropped' });
    store.removeGoal(g2.id);

    const active = store.getActiveGoals();
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe('Active');
  });
});
