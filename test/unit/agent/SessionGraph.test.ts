/**
 * SessionGraph tests — behavioral assertions on session turn persistence.
 *
 * Tests both memory-only mode (no LiminalFS) and persistence mode (mocked FS).
 * Every assertion checks a specific expected value.
 */
import { describe, it, expect, vi } from 'vitest';
import { SessionGraph } from '../../../src/agent/SessionGraph.js';
import type { SessionTurnRecord } from '../../../src/agent/SessionGraph.js';

/** Creates a mock LiminalFS that records calls */
function mockLiminalFS() {
  return {
    writeManifest: vi.fn(),
    readManifest: vi.fn(() => null),
    writeArtifact: vi.fn(),
    readArtifact: vi.fn(() => null),
    writeRef: vi.fn(),
    readRef: vi.fn(() => null),
    recordRun: vi.fn(),
    getProjectRoot: vi.fn(() => '/tmp/test'),
    getProjectStore: vi.fn(),
    close: vi.fn(),
  };
}

describe('SessionGraph', () => {
  // ── Memory-only mode (no LiminalFS) ──

  describe('memory-only mode', () => {
    const graph = new SessionGraph('session-001');

    it('starts with empty turns', () => {
      expect(graph.getTurns()).toEqual([]);
    });

    it('records a turn and returns it with timestamp', () => {
      const turn = graph.recordTurn({
        turnId: 'turn-1',
        input: 'generate a p5 sketch',
        intent: 'creative',
        delegatedTo: 'ralph-loop',
        response: 'Generated!',
        durationMs: 2500,
        artifactRefs: ['art-001'],
      });

      expect(turn.turnId).toBe('turn-1');
      expect(turn.input).toBe('generate a p5 sketch');
      expect(turn.intent).toBe('creative');
      expect(turn.delegatedTo).toBe('ralph-loop');
      expect(turn.response).toBe('Generated!');
      expect(turn.durationMs).toBe(2500);
      expect(turn.artifactRefs).toEqual(['art-001']);
      expect(turn.timestamp).toBeTruthy();
    });

    it('updates manifest after recording', () => {
      const manifest = graph.getManifest();
      expect(manifest.sessionId).toBe('session-001');
      expect(manifest.turnCount).toBe(1);
      expect(manifest.lastIntent).toBe('creative');
      expect(manifest.lastDelegatedTo).toBe('ralph-loop');
    });

    it('retrieves a turn by ID', () => {
      const turn = graph.getTurn('turn-1');
      expect(turn).toBeDefined();
      expect(turn?.input).toBe('generate a p5 sketch');
    });

    it('returns undefined for unknown turn ID', () => {
      expect(graph.getTurn('turn-nonexistent')).toBeUndefined();
    });

    it('records multiple turns', () => {
      graph.recordTurn({
        turnId: 'turn-2',
        input: 'fix the build',
        intent: 'engineering',
        delegatedTo: 'conveyor',
        response: 'Fixed!',
        durationMs: 5000,
        taskRefs: ['T-001'],
      });

      expect(graph.getTurns()).toHaveLength(2);
      expect(graph.getManifest().turnCount).toBe(2);
    });

    it('filters turns by intent', () => {
      const creative = graph.getTurnsByIntent('creative');
      expect(creative).toHaveLength(1);
      expect(creative[0].turnId).toBe('turn-1');
    });

    it('filters turns by delegation target', () => {
      const eng = graph.getTurnsByDelegation('conveyor');
      expect(eng).toHaveLength(1);
      expect(eng[0].intent).toBe('engineering');
    });

    it('collects all artifact refs', () => {
      expect(graph.getAllArtifactRefs()).toEqual(['art-001']);
    });

    it('collects all task refs', () => {
      expect(graph.getAllTaskRefs()).toEqual(['T-001']);
    });

    it('returns copies of turns array', () => {
      const turns1 = graph.getTurns();
      const turns2 = graph.getTurns();
      expect(turns1).not.toBe(turns2);
      expect(turns1).toEqual(turns2);
    });

    it('returns a copy of the manifest', () => {
      const m1 = graph.getManifest();
      const m2 = graph.getManifest();
      expect(m1).not.toBe(m2);
      expect(m1).toEqual(m2);
    });
  });

  // ── Persistence mode (with LiminalFS) ──

  describe('persistence mode', () => {
    const fs = mockLiminalFS();
    const graph = new SessionGraph('session-persist', fs as unknown as import('../../../src/fs/LiminalFS.js').LiminalFS);

    it('persists turn to LiminalFS on record', () => {
      graph.recordTurn({
        turnId: 'turn-p1',
        input: 'hello',
        intent: 'direct',
        delegatedTo: 'llm-chat',
        response: 'Hi there!',
        durationMs: 100,
      });

      expect(fs.writeManifest).toHaveBeenCalledTimes(2); // turn + manifest
      expect(fs.writeManifest).toHaveBeenCalledWith(
        'session/session-persist/turn/turn-p1',
        expect.objectContaining({ turnId: 'turn-p1', input: 'hello' }),
      );
    });

    it('persists updated manifest after each turn', () => {
      const callCount = fs.writeManifest.mock.calls.length;
      const lastManifestCall = fs.writeManifest.mock.calls[callCount - 1];
      expect(lastManifestCall[0]).toBe('session/session-persist/manifest');
      expect(lastManifestCall[1]).toEqual(
        expect.objectContaining({
          sessionId: 'session-persist',
          turnCount: 1,
          lastIntent: 'direct',
          lastDelegatedTo: 'llm-chat',
        }),
      );
    });

    it('persists multiple turns', () => {
      fs.writeManifest.mockClear();

      graph.recordTurn({
        turnId: 'turn-p2',
        input: 'generate art',
        intent: 'creative',
        delegatedTo: 'ralph-loop',
        response: 'Done',
        durationMs: 3000,
        artifactRefs: ['art-010'],
      });

      // 2 calls: turn manifest + session manifest update
      expect(fs.writeManifest).toHaveBeenCalledTimes(2);
      expect(fs.writeManifest).toHaveBeenCalledWith(
        'session/session-persist/turn/turn-p2',
        expect.objectContaining({ turnId: 'turn-p2' }),
      );
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty response', () => {
      const graph = new SessionGraph('edge-1');
      const turn = graph.recordTurn({
        turnId: 'turn-empty',
        input: 'hello',
        intent: 'direct',
        delegatedTo: 'echo',
        response: '',
        durationMs: 0,
      });
      expect(turn.response).toBe('');
    });

    it('handles turn without optional refs', () => {
      const graph = new SessionGraph('edge-2');
      const turn = graph.recordTurn({
        turnId: 'turn-noref',
        input: 'hello',
        intent: 'direct',
        delegatedTo: 'llm-chat',
        response: 'Hi',
        durationMs: 10,
      });
      expect(turn.artifactRefs).toBeUndefined();
      expect(turn.taskRefs).toBeUndefined();
      expect(graph.getAllArtifactRefs()).toEqual([]);
      expect(graph.getAllTaskRefs()).toEqual([]);
    });

    it('handles large number of turns', () => {
      const graph = new SessionGraph('edge-many');
      for (let i = 0; i < 100; i++) {
        graph.recordTurn({
          turnId: `turn-${i}`,
          input: `input ${i}`,
          intent: i % 2 === 0 ? 'direct' : 'creative',
          delegatedTo: i % 2 === 0 ? 'llm-chat' : 'ralph-loop',
          response: `response ${i}`,
          durationMs: i * 10,
        });
      }
      expect(graph.getTurns()).toHaveLength(100);
      expect(graph.getManifest().turnCount).toBe(100);
      expect(graph.getTurnsByIntent('direct')).toHaveLength(50);
    });
  });
});
