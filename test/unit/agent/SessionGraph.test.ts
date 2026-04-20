import { describe, it, expect, vi } from 'vitest';
import { SessionGraph } from '../../../src/agent/SessionGraph.js';

describe('SessionGraph', () => {
  describe('constructor', () => {
    it('initializes with the given session ID', () => {
      const graph = new SessionGraph('sess-1');
      const manifest = graph.getManifest();
      expect(manifest.sessionId).toBe('sess-1');
      expect(manifest.turnCount).toBe(0);
    });

    it('sets createdAt and updatedAt to matching timestamps', () => {
      const graph = new SessionGraph('sess-1');
      const manifest = graph.getManifest();
      expect(manifest.createdAt).toBe(manifest.updatedAt);
    });
  });

  describe('recordTurn', () => {
    it('records a turn and returns it with a timestamp', () => {
      const graph = new SessionGraph('sess-1');
      const turn = graph.recordTurn({
        turnId: 'turn-1',
        input: 'hello',
        intent: 'direct',
        delegatedTo: 'llm-chat',
        response: 'hi there',
        durationMs: 120,
      });
      expect(turn.turnId).toBe('turn-1');
      expect(turn.timestamp).toBeTruthy();
    });

    it('increments turnCount in the manifest', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 50 });
      graph.recordTurn({ turnId: 't2', input: 'b', intent: 'creative', delegatedTo: 'ralph', response: 'r2', durationMs: 80 });
      expect(graph.getManifest().turnCount).toBe(2);
    });

    it('updates lastIntent and lastDelegatedTo in manifest', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'make art', intent: 'creative', delegatedTo: 'ralph', response: 'art', durationMs: 100 });
      const manifest = graph.getManifest();
      expect(manifest.lastIntent).toBe('creative');
      expect(manifest.lastDelegatedTo).toBe('ralph');
    });
  });

  describe('getTurns', () => {
    it('returns all recorded turns', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      graph.recordTurn({ turnId: 't2', input: 'b', intent: 'creative', delegatedTo: 'ralph', response: 'r2', durationMs: 20 });
      expect(graph.getTurns()).toHaveLength(2);
    });

    it('returns a copy (mutations do not affect internal state)', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      const turns = graph.getTurns();
      turns.pop();
      expect(graph.getTurns()).toHaveLength(1);
    });
  });

  describe('getTurn', () => {
    it('returns a specific turn by ID', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 'target', input: 'x', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 5 });
      const turn = graph.getTurn('target');
      expect(turn?.input).toBe('x');
    });

    it('returns undefined for a nonexistent turn ID', () => {
      const graph = new SessionGraph('sess-1');
      expect(graph.getTurn('nope')).toBeUndefined();
    });
  });

  describe('getTurnsByIntent', () => {
    it('filters turns by intent', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'hello', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      graph.recordTurn({ turnId: 't2', input: 'make art', intent: 'creative', delegatedTo: 'ralph', response: 'r2', durationMs: 20 });
      graph.recordTurn({ turnId: 't3', input: 'fix bug', intent: 'engineering', delegatedTo: 'conveyor', response: 'r3', durationMs: 30 });
      expect(graph.getTurnsByIntent('creative')).toHaveLength(1);
      expect(graph.getTurnsByIntent('direct')).toHaveLength(1);
    });
  });

  describe('getTurnsByDelegation', () => {
    it('filters turns by delegation target', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      graph.recordTurn({ turnId: 't2', input: 'b', intent: 'creative', delegatedTo: 'ralph', response: 'r2', durationMs: 20 });
      expect(graph.getTurnsByDelegation('llm')).toHaveLength(1);
      expect(graph.getTurnsByDelegation('ralph')).toHaveLength(1);
      expect(graph.getTurnsByDelegation('conveyor')).toHaveLength(0);
    });
  });

  describe('getAllArtifactRefs', () => {
    it('collects artifact refs from all turns', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10, artifactRefs: ['art1.png'] });
      graph.recordTurn({ turnId: 't2', input: 'b', intent: 'creative', delegatedTo: 'ralph', response: 'r2', durationMs: 20, artifactRefs: ['art2.png', 'art3.glsl'] });
      expect(graph.getAllArtifactRefs()).toEqual(['art1.png', 'art2.png', 'art3.glsl']);
    });

    it('returns empty array when no turns have artifact refs', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      expect(graph.getAllArtifactRefs()).toEqual([]);
    });
  });

  describe('getAllTaskRefs', () => {
    it('collects task refs from all turns', () => {
      const graph = new SessionGraph('sess-1');
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'engineering', delegatedTo: 'conveyor', response: 'r', durationMs: 10, taskRefs: ['task-001'] });
      graph.recordTurn({ turnId: 't2', input: 'b', intent: 'engineering', delegatedTo: 'conveyor', response: 'r2', durationMs: 20, taskRefs: ['task-002'] });
      expect(graph.getAllTaskRefs()).toEqual(['task-001', 'task-002']);
    });
  });

  describe('persistence', () => {
    it('does not call fs when no LiminalFS is provided', () => {
      const graph = new SessionGraph('sess-1');
      // Should not throw — in-memory mode
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      expect(graph.getTurns()).toHaveLength(1);
    });

    it('calls fs.writeManifest when LiminalFS is provided', () => {
      const writeManifest = vi.fn();
      const graph = new SessionGraph('sess-1', { writeManifest } as any);
      graph.recordTurn({ turnId: 't1', input: 'a', intent: 'direct', delegatedTo: 'llm', response: 'r', durationMs: 10 });
      // Called once for turn, once for manifest update
      expect(writeManifest).toHaveBeenCalledTimes(2);
      expect(writeManifest).toHaveBeenCalledWith('session/sess-1/turn/t1', expect.any(Object));
      expect(writeManifest).toHaveBeenCalledWith('session/sess-1/manifest', expect.any(Object));
    });
  });
});
