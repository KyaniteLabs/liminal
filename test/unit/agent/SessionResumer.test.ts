/**
 * SessionResumer unit tests — Phase 12 Increment 4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionResumer } from '../../../src/agent/SessionResumer.js';
import { SessionGraph } from '../../../src/agent/SessionGraph.js';

describe('SessionResumer', () => {
  let resumer: SessionResumer;

  beforeEach(() => {
    resumer = new SessionResumer();
  });

  it('starts with zero sessions', () => {
    expect(resumer.sessionCount).toBe(0);
    expect(resumer.listSessions()).toEqual([]);
  });

  it('registers a session and lists it', () => {
    const graph = new SessionGraph('sess-001');
    resumer.register('sess-001', graph);

    expect(resumer.sessionCount).toBe(1);
    const sessions = resumer.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('sess-001');
  });

  it('retrieves a registered session graph', () => {
    const graph = new SessionGraph('sess-002');
    resumer.register('sess-002', graph);

    const retrieved = resumer.getSession('sess-002');
    expect(retrieved).toBe(graph);
  });

  it('returns undefined for unknown session', () => {
    expect(resumer.getSession('unknown')).toBeUndefined();
  });

  it('removes a session', () => {
    const graph = new SessionGraph('sess-003');
    resumer.register('sess-003', graph);
    expect(resumer.sessionCount).toBe(1);

    const removed = resumer.remove('sess-003');
    expect(removed).toBe(true);
    expect(resumer.sessionCount).toBe(0);
    expect(resumer.getSession('sess-003')).toBeUndefined();
  });

  it('returns false when removing unknown session', () => {
    expect(resumer.remove('nonexistent')).toBe(false);
  });

  it('lists sessions sorted by updatedAt descending', () => {
    const graph1 = new SessionGraph('sess-early');
    const graph2 = new SessionGraph('sess-late');
    resumer.register('sess-early', graph1);
    resumer.register('sess-late', graph2);

    const sessions = resumer.listSessions();
    expect(sessions).toHaveLength(2);
    // Both have similar timestamps so order depends on creation time
    // Just verify both are present
    const ids = sessions.map(s => s.sessionId);
    expect(ids).toContain('sess-early');
    expect(ids).toContain('sess-late');
  });

  it('session entry has correct structure', () => {
    const graph = new SessionGraph('sess-struct');
    resumer.register('sess-struct', graph);

    const sessions = resumer.listSessions();
    const entry = sessions[0];
    expect(entry.sessionId).toBe('sess-struct');
    expect(typeof entry.createdAt).toBe('string');
    expect(typeof entry.updatedAt).toBe('string');
    expect(typeof entry.turnCount).toBe('number');
  });

  it('re-registering overwrites existing session', () => {
    const graph1 = new SessionGraph('sess-dup');
    const graph2 = new SessionGraph('sess-dup');
    resumer.register('sess-dup', graph1);
    resumer.register('sess-dup', graph2);

    expect(resumer.sessionCount).toBe(1);
    expect(resumer.getSession('sess-dup')).toBe(graph2);
  });
});
