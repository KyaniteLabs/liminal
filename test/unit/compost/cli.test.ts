/**
 * CLI argument parser and executor tests for `liminal compost` subcommands.
 * Covers: parseArgs, execute, export-finetuning command.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseArgs } from '../../../src/compost/cli.js';

// ---------------------------------------------------------------------------
// parseArgs tests
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('maps "status" to status command', () => {
    expect(parseArgs(['status'])).toEqual({ command: 'status' });
  });

  it('maps "add" with paths', () => {
    expect(parseArgs(['add', 'file.ts', 'dir/'])).toEqual({ command: 'add', paths: ['file.ts', 'dir/'] });
  });

  it('maps "soup start"', () => {
    expect(parseArgs(['soup', 'start'])).toEqual({ command: 'soup', subcommand: 'start' });
  });

  it('maps "soup stop"', () => {
    expect(parseArgs(['soup', 'stop'])).toEqual({ command: 'soup', subcommand: 'stop' });
  });

  it('maps "seeds list"', () => {
    expect(parseArgs(['seeds', 'list'])).toEqual({ command: 'seeds', subcommand: 'list', args: [] });
    expect(parseArgs(['seeds', 'list', 'extra'])).toEqual({ command: 'seeds', subcommand: 'list', args: ['extra'] });
  });

  it('maps "log" with optional limit', () => {
    expect(parseArgs(['log'])).toEqual({ command: 'log', limit: 20 });
    expect(parseArgs(['log', '5'])).toEqual({ command: 'log', limit: 5 });
    expect(parseArgs(['log', 'abc'])).toEqual({ command: 'log', limit: 20 });
  });

  it('maps "undo"', () => {
    expect(parseArgs(['undo'])).toEqual({ command: 'undo' });
  });

  it('maps "branch list"', () => {
    expect(parseArgs(['branch', 'list'])).toEqual({ command: 'branch', subcommand: 'list', args: [] });
  });

  it('maps "branch create" with description', () => {
    // Current implementation: --description is consumed but also included in args
    expect(parseArgs(['branch', 'create', 'my-branch', '--description', 'a feature'])).toEqual({
      command: 'branch',
      subcommand: 'create',
      args: ['my-branch', '--description', 'a feature'],
      description: 'a feature',
    });
  });

  it('maps "history"', () => {
    expect(parseArgs(['history'])).toEqual({ command: 'history' });
  });

  it('defaults unknown subcommand to status', () => {
    expect(parseArgs(['unknown'])).toEqual({ command: 'status' });
  });

  // ─── export-finetuning ───────────────────────────────────────────────────

  it('maps bare "export-finetuning"', () => {
    expect(parseArgs(['export-finetuning'])).toEqual({
      command: 'export-finetuning',
      domain: undefined,
      minQuality: undefined,
      outputPath: undefined,
    });
  });

  it('parses positional domain argument', () => {
    expect(parseArgs(['export-finetuning', 'p5'])).toEqual({
      command: 'export-finetuning',
      domain: 'p5',
      minQuality: undefined,
      outputPath: undefined,
    });
  });

  it('parses --domain flag', () => {
    expect(parseArgs(['export-finetuning', '--domain', 'code'])).toEqual({
      command: 'export-finetuning',
      domain: 'code',
      minQuality: undefined,
      outputPath: undefined,
    });
  });

  it('parses --min-quality flag', () => {
    expect(parseArgs(['export-finetuning', '--min-quality', '0.8'])).toEqual({
      command: 'export-finetuning',
      domain: undefined,
      minQuality: 0.8,
      outputPath: undefined,
    });
  });

  it('parses --output flag', () => {
    expect(parseArgs(['export-finetuning', '--output', '/tmp/train.jsonl'])).toEqual({
      command: 'export-finetuning',
      domain: undefined,
      minQuality: undefined,
      outputPath: '/tmp/train.jsonl',
    });
  });

  it('parses all flags together', () => {
    expect(parseArgs(['export-finetuning', 'p5', '--domain', 'code', '--min-quality', '0.9', '--output', '/tmp/out.jsonl'])).toEqual({
      command: 'export-finetuning',
      domain: 'code',
      minQuality: 0.9,
      outputPath: '/tmp/out.jsonl',
    });
  });

  it('positional domain wins when --domain also provided last', () => {
    expect(parseArgs(['export-finetuning', '--domain', 'code', 'p5'])).toEqual({
      command: 'export-finetuning',
      domain: 'p5',
      minQuality: undefined,
      outputPath: undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// execute — export-finetuning tests
// ---------------------------------------------------------------------------

// Destructuring from the object is the established pattern that preserves the fn reference.
const { mockExportFn } = vi.hoisted(() => ({
  mockExportFn: vi.fn(),
}));

const EXAMPLES = [
  {
    prompt: 'Write a composable',
    completion: 'export const useX = () => { }',
    domain: 'p5',
    qualityScore: 0.9,
    metadata: { source: 'test' },
  },
  {
    prompt: 'Implement a reducer',
    completion: 'const reducer = (state, action) => state;',
    domain: 'p5',
    qualityScore: 0.8,
    metadata: { source: 'test' },
  },
];

vi.mock('../../../src/learning/ArchiveLearning.js', () => ({
  ArchiveLearning: vi.fn(function (this: any) {
    return { exportForFinetuning: mockExportFn };
  }),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const { execute } = await import('../../../src/compost/cli.js');

describe('execute — export-finetuning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportFn.mockReturnValue(EXAMPLES);
  });

  it('writes JSONL to stdout when no output path given', async () => {
    const chunks: string[] = [];
    const stream = { write: (s: string) => { chunks.push(s); return true; } };
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true, writable: true });

    await execute({ command: 'export-finetuning' }, {} as any);

    expect(chunks).toHaveLength(1);
    const lines = chunks[0]!.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ domain: 'p5', qualityScore: 0.9 });
    expect(JSON.parse(lines[1]!)).toMatchObject({ domain: 'p5', qualityScore: 0.8 });
  });

  it('writes JSONL to file when --output is given', async () => {
    const fs = await import('node:fs/promises');

    await execute({ command: 'export-finetuning', outputPath: '/tmp/train.jsonl' }, {} as any);

    expect(fs.writeFile).toHaveBeenCalledOnce();
    const [path, content] = fs.writeFile.mock.calls[0]!;
    expect(path).toBe('/tmp/train.jsonl');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ domain: 'p5' });
  });

  it('passes domain and minQuality through to exportForFinetuning', async () => {
    const chunks: string[] = [];
    const stream = { write: (s: string) => { chunks.push(s); return true; } };
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true, writable: true });

    await execute({ command: 'export-finetuning', domain: 'p5', minQuality: 0.85 }, {} as any);

    expect(mockExportFn).toHaveBeenCalledOnce();
    expect(mockExportFn.mock.calls[0]).toEqual(['p5', 0.85]);
    expect(chunks[0]).toBeTruthy();
  });

  it('uses default minQuality of 0.75 when not specified', async () => {
    const chunks: string[] = [];
    const stream = { write: (s: string) => { chunks.push(s); return true; } };
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true, writable: true });

    await execute({ command: 'export-finetuning', domain: 'p5' }, {} as any);

    expect(mockExportFn).toHaveBeenCalledOnce();
    expect(mockExportFn.mock.calls[0]).toEqual(['p5', 0.75]);
  });

  it('writes nothing when archive returns no examples', async () => {
    mockExportFn.mockReturnValue([]);

    const chunks: string[] = [];
    const stream = { write: (s: string) => { chunks.push(s); return true; } };
    Object.defineProperty(process, 'stdout', { value: stream, configurable: true, writable: true });

    await execute({ command: 'export-finetuning' }, {} as any);

    expect(chunks).toHaveLength(0);
  });
});
