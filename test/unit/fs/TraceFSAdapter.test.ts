import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LiminalFS } from '../../../src/fs/LiminalFS.js';
import { TraceFSAdapter } from '../../../src/fs/adapters/TraceFSAdapter.js';

describe('TraceFSAdapter', () => {
  let projectRoot: string;
  let fs: LiminalFS;
  let adapter: TraceFSAdapter;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'liminal-trace-test-'));
    fs = LiminalFS.open(projectRoot);
    adapter = new TraceFSAdapter(fs);
  });

  afterEach(() => {
    fs.close();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it('linkReasoningTrace — returns LinkedTrace with correct traceId and runId', () => {
    const result = adapter.linkReasoningTrace('trace-123', 'run-456');

    expect(result.traceId).toBe('trace-123');
    expect(result.runId).toBe('run-456');
    expect(result.artifactRefs).toHaveLength(1);
  });

  it('linkReasoningTrace — creates artifact with liminal://artifact/ URI', () => {
    const result = adapter.linkReasoningTrace('trace-123', 'run-456');

    const ref = result.artifactRefs[0];
    expect(ref.uri).toMatch(/^liminal:\/\/artifact\/[a-f0-9]{64}$/);
    expect(ref.kind).toBe('trace');
    expect(ref.hash).toHaveLength(64);
  });

  it('linkReasoningTrace — writes ref at trace/{traceId}', () => {
    adapter.linkReasoningTrace('trace-789', 'run-abc');

    const readBack = fs.readRef('trace/trace-789');
    expect(readBack).not.toBeNull();
    expect(readBack?.kind).toBe('trace');
  });

  it('linkReasoningTrace — artifact content contains both traceId and runId', () => {
    const result = adapter.linkReasoningTrace('trace-content', 'run-content');

    const content = fs.readArtifact(result.artifactRefs[0]);
    const parsed = JSON.parse(content?.toString('utf-8') ?? '{}');
    expect(parsed.traceId).toBe('trace-content');
    expect(parsed.runId).toBe('run-content');
    expect(parsed.linkedAt).toBeDefined();
  });

  it('linkThinkingTrace — returns LinkedTrace with correct traceId and runId', () => {
    const result = adapter.linkThinkingTrace('think-1', 'run-1', 'openai');

    expect(result.traceId).toBe('think-1');
    expect(result.runId).toBe('run-1');
    expect(result.artifactRefs).toHaveLength(1);
  });

  it('linkThinkingTrace — creates artifact with correct metadata (source, traceType)', () => {
    const result = adapter.linkThinkingTrace('think-2', 'run-2', 'minimax');

    const ref = result.artifactRefs[0];
    const eventStore = fs.getProjectStore().getEventStore();
    const events = eventStore.queryEvents({ type: 'config_change', limit: 10 });
    const artifactEvent = events.find(
      e => e.payload.action === 'artifact_write' && e.payload.hash === ref.hash,
    );
    expect(artifactEvent).toBeDefined();
    expect(artifactEvent?.payload.metadata).toMatchObject({
      traceId: 'think-2',
      runId: 'run-2',
      traceType: 'thinking',
      source: 'minimax',
    });
  });

  it('linkThinkingTrace — writes ref at trace/{traceId}', () => {
    adapter.linkThinkingTrace('think-3', 'run-3', 'anthropic');

    const readBack = fs.readRef('trace/think-3');
    expect(readBack).not.toBeNull();
    expect(readBack?.kind).toBe('trace');
  });

  it('linkThinkingTrace — artifact content includes source field', () => {
    const result = adapter.linkThinkingTrace('think-src', 'run-src', 'gemini');

    const content = fs.readArtifact(result.artifactRefs[0]);
    const parsed = JSON.parse(content?.toString('utf-8') ?? '{}');
    expect(parsed.traceId).toBe('think-src');
    expect(parsed.runId).toBe('run-src');
    expect(parsed.source).toBe('gemini');
    expect(parsed.linkedAt).toBeDefined();
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  it('linkReasoningTrace — handles special characters in traceId', () => {
    const result = adapter.linkReasoningTrace('trace-with-emoji-🎉', 'run/special');

    expect(result.traceId).toBe('trace-with-emoji-🎉');
    const content = fs.readArtifact(result.artifactRefs[0]);
    const parsed = JSON.parse(content?.toString('utf-8') ?? '{}');
    expect(parsed.traceId).toBe('trace-with-emoji-🎉');
  });

  it('linkReasoningTrace — overwrites existing trace with same ID', () => {
    adapter.linkReasoningTrace('dup-trace', 'run-1');
    adapter.linkReasoningTrace('dup-trace', 'run-2');

    const readBack = fs.readRef('trace/dup-trace');
    expect(readBack).not.toBeNull();
  });

  it('readArtifact returns null for invalid ref', () => {
    const result = adapter.linkReasoningTrace('valid-trace', 'run-1');
    const badRef = { ...result.artifactRefs[0], hash: 'deadbeef' };
    const content = fs.readArtifact(badRef);
    expect(content).toBeNull();
  });
});
