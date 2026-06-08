/**
 * Accumulation gap (audit 2026-06-08): session history is persisted to SinterFS
 * by SessionGraph but SessionResumer only ever read its in-memory map, so
 * resumable sessions silently vanished on restart. This proves the closed loop:
 * a session persisted by one "process" is seen by a fresh SessionResumer in the
 * next via hydrate() — cold 0 → hydrated N.
 *
 * Real data flow: SessionGraph.persist* → SinterFS manifests →
 * SinterFS.listManifests → SessionGraph.load → SessionResumer.hydrate.
 *
 * Each test gets its own throwaway SinterFS root via SINTER_PROJECT_ROOT (#605).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SinterFS } from '../../src/fs/SinterFS.js';
import { resolveSinterProjectRoot } from '../../src/fs/projectRoot.js';
import { SessionGraph } from '../../src/agent/SessionGraph.js';
import { SessionResumer } from '../../src/agent/SessionResumer.js';

function recordTwoTurns(graph: SessionGraph): void {
  graph.recordTurn({ turnId: 't1', input: 'hello', intent: 'chat', delegatedTo: 'none', response: 'hi', durationMs: 5 });
  graph.recordTurn({ turnId: 't2', input: 'again', intent: 'chat', delegatedTo: 'none', response: 'yo', durationMs: 7 });
}

describe('session resume hydration (accumulation across restarts)', () => {
  let tmpRoot: string;
  let savedRoot: string | undefined;

  beforeEach(() => {
    savedRoot = process.env.SINTER_PROJECT_ROOT;
    tmpRoot = mkdtempSync(join(tmpdir(), 'session-hydration-test-'));
    process.env.SINTER_PROJECT_ROOT = tmpRoot;
  });

  afterEach(() => {
    if (savedRoot !== undefined) process.env.SINTER_PROJECT_ROOT = savedRoot;
    else delete process.env.SINTER_PROJECT_ROOT;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('first-ever hydrate of an empty store yields no sessions and does not throw', () => {
    const fs = SinterFS.open(resolveSinterProjectRoot());
    const resumer = new SessionResumer();

    expect(resumer.hydrate(fs)).toBe(0);
    expect(resumer.listSessions()).toEqual([]);
    expect(resumer.sessionCount).toBe(0);

    fs.close();
  });

  it('a fresh resumer hydrates a session persisted by a prior process: cold 0 → hydrated 1', () => {
    // ── "Process 1": run a session that persists two turns to SinterFS ──
    const writeFs = SinterFS.open(resolveSinterProjectRoot());
    recordTwoTurns(new SessionGraph('sess-1', writeFs));
    writeFs.close();

    // ── "Process 2": a brand-new resumer starts cold (in-memory only) ──
    const resumer = new SessionResumer();
    expect(resumer.listSessions()).toEqual([]); // cold = 0
    expect(resumer.sessionCount).toBe(0);

    // ── Hydrate from SinterFS ──
    const readFs = SinterFS.open(resolveSinterProjectRoot());
    const loaded = resumer.hydrate(readFs);

    expect(loaded).toBe(1);
    expect(resumer.sessionCount).toBe(1);

    const sessions = resumer.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('sess-1');
    expect(sessions[0].turnCount).toBe(2); // accumulated, not reset

    const restored = resumer.getSession('sess-1');
    expect(restored?.getTurns()).toHaveLength(2);
    expect(restored?.getTurns().map(t => t.turnId).sort()).toEqual(['t1', 't2']);

    readFs.close();
  });

  it('hydrate is idempotent and accumulates multiple persisted sessions', () => {
    const writeFs = SinterFS.open(resolveSinterProjectRoot());
    recordTwoTurns(new SessionGraph('sess-a', writeFs));
    new SessionGraph('sess-b', writeFs).recordTurn({
      turnId: 't1', input: 'x', intent: 'chat', delegatedTo: 'none', response: 'y', durationMs: 3,
    });
    writeFs.close();

    const resumer = new SessionResumer();
    const readFs = SinterFS.open(resolveSinterProjectRoot());

    expect(resumer.hydrate(readFs)).toBe(2); // both sessions loaded
    expect(resumer.sessionCount).toBe(2);
    expect(resumer.hydrate(readFs)).toBe(0); // idempotent: already-registered skipped
    expect(resumer.sessionCount).toBe(2);

    expect(resumer.getSession('sess-a')?.getTurns()).toHaveLength(2);
    expect(resumer.getSession('sess-b')?.getTurns()).toHaveLength(1);

    readFs.close();
  });
});
