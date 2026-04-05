import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
/**
 * Tests for CLI commands — liminal compost subcommand parsing.
 */

import { parseArgs, execute } from '../../src/compost/cli.js';

describe('CLI parseArgs', () => {
  it('parses compost add action', () => {
    const action = parseArgs(['compost', 'add', 'file.txt', 'dir/']);
    expect(action.command).toBe('add');
    if (action.command === 'add') {
      expect(action.paths).toEqual(['file.txt', 'dir/']);
    }
  });

  it('parses compost digest action', () => {
    const action = parseArgs(['compost', 'digest']);
    expect(action.command).toBe('digest');
  });

  it('parses soup start action', () => {
    const action = parseArgs(['compost', 'soup', 'start']);
    expect(action.command).toBe('soup');
    if (action.command === 'soup') {
      expect(action.subcommand).toBe('start');
    }
  });

  it('parses soup stop action', () => {
    const action = parseArgs(['compost', 'soup', 'stop']);
    expect(action.command).toBe('soup');
    if (action.command === 'soup') {
      expect(action.subcommand).toBe('stop');
    }
  });

  it('parses soup status action', () => {
    const action = parseArgs(['compost', 'soup', 'status']);
    expect(action.command).toBe('soup');
    if (action.command === 'soup') {
      expect(action.subcommand).toBe('status');
    }
  });

  it('parses seeds list action', () => {
    const action = parseArgs(['compost', 'seeds', 'list']);
    expect(action.command).toBe('seeds');
    if (action.command === 'seeds') {
      expect(action.subcommand).toBe('list');
    }
  });

  it('parses status action', () => {
    const action = parseArgs(['compost', 'status']);
    expect(action.command).toBe('status');
  });
});

describe('CLI execute', () => {
  let consoleSpy: vi.SpiedFunction<any>;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('dispatches digest to mill.digest()', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const digestFn: any = vi.fn();
    digestFn.mockResolvedValue({
      stats: { filesProcessed: 1, fragmentCount: 5, collisionCount: 2, seedsPromoted: 1, soupCycles: 10, durationMs: 1000, totalBytes: 500, domains: ['a'] },
      seeds: [],
      digestPath: '/tmp/digest.md',
    });

    const mockMill = {
      digest: digestFn,
      add: vi.fn(),
      status: vi.fn().mockReturnValue({ heapSize: 0, heapFileCount: 0, seedCount: 0, soupRunning: false, soupGeneration: 0, lastDigestAt: null }),
      stopSoup: vi.fn(),
      startSoup: vi.fn(),
      shouldAutoDigest: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockMill.shouldAutoDigest as any).mockResolvedValue(false);

    await execute({ command: 'digest' }, mockMill as any);
    expect(mockMill.digest).toHaveBeenCalled();
  });

  it('dispatches status to mill.statusAsync()', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusFn: any = vi.fn();
    statusFn.mockReturnValue({ heapSize: 0, heapFileCount: 0, seedCount: 0, soupRunning: false, soupGeneration: 0, lastDigestAt: null });

    const mockMill: Record<string, unknown> = {
      digest: vi.fn(),
      add: vi.fn(),
      statusAsync: vi.fn<() => Promise<unknown>>().mockResolvedValue(statusFn()),
      stopSoup: vi.fn(),
      startSoup: vi.fn(),
      shouldAutoDigest: vi.fn(),
      listSeeds: vi.fn<() => Promise<unknown>>().mockResolvedValue([]),
      getTopSeeds: vi.fn<() => Promise<unknown>>().mockResolvedValue([]),
      getProjectStore: vi.fn().mockReturnValue(null),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockMill.shouldAutoDigest as any).mockResolvedValue(false);

    await execute({ command: 'status' }, mockMill as any);
    expect(mockMill.statusAsync).toHaveBeenCalled();
  });
});
