import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChildProcess } from 'child_process';

// -----------------------------------------------------------------------
// Mock child_process — hoisted above all imports by Vitest
// -----------------------------------------------------------------------
const { mockFfmpegProcess, _closeListeners } = vi.hoisted(() => {
  const _closeListeners: Array<(code: number | null) => void> = [];

  const mockFfmpegProcess = {
    kill: vi.fn(),
    stdout: {
      on: vi.fn(() => mockFfmpegProcess.stdout),
      removeListener: vi.fn(),
    },
    stderr: {
      on: vi.fn(() => mockFfmpegProcess.stderr),
      removeListener: vi.fn(),
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'close' || event === 'error') {
        _closeListeners.push(cb as (code: number | null) => void);
      }
      return mockFfmpegProcess;
    }),
  } as unknown as ChildProcess;

  return { mockFfmpegProcess, _closeListeners };
});

vi.mock('child_process', () => ({
  spawn: vi.fn(() => mockFfmpegProcess),
}));

import { captureMicAudio } from '../../../src/audio/MicCapture.js';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

let _stdinOnListener: ((data: Buffer) => void) | null = null;

function simulateFfmpegClose(code: number | null) {
  _closeListeners.forEach((cb) => cb(code));
}

function clearCloseListeners() {
  _closeListeners.length = 0;
}

function mockStdinIsTTY(value: boolean | undefined) {
  // Replace isTTY getter without replacing the entire stdin object
  // This keeps process.stdin.on accessible
  Object.defineProperty(process.stdin, 'isTTY', {
    value,
    configurable: true,
    writable: true,
  });
  // Patch .on to capture the listener that MicCapture registers
  const originalOn = process.stdin.on.bind(process.stdin);
  // @ts-ignore - we know stdin has .on but we want to intercept it
  process.stdin.on = vi.fn((event: string, cb: (data: Buffer) => void) => {
    if (event === 'data') _stdinOnListener = cb;
    return process.stdin as unknown as NodeJS.ReadStream & { on: typeof process.stdin.on };
  }) as unknown as typeof process.stdin.on;
  return () => {
    // Restore
    // @ts-ignore
    process.stdin.on = originalOn;
  };
}

describe('captureMicAudio', () => {
  let restoreStdin: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCloseListeners();
    _stdinOnListener = null;
    mockFfmpegProcess.kill.mockClear();
    restoreStdin?.();
  });

  afterEach(() => {
    restoreStdin?.();
  });

  it('returns Float32Array when ffmpeg exits with code 0', async () => {
    restoreStdin = mockStdinIsTTY(true);

    // PCM: 4 samples, signed 16-bit little-endian
    const pcmChunk = Buffer.alloc(8);
    pcmChunk.writeInt16LE(16448, 0);  // ~0.502
    pcmChunk.writeInt16LE(-16448, 2); // ~-0.502
    pcmChunk.writeInt16LE(0, 4);      // 0.0
    pcmChunk.writeInt16LE(32767, 6);  // 1.0

    const resultPromise = captureMicAudio();

    // Feed PCM data to the ffmpeg stdout handler (triggers chunk collection)
    // The stdout 'data' handler is registered by captureMicAudio on ffmpegProcess.stdout
    const stdoutOnCalls = mockFfmpegProcess.stdout.on.mock.calls;
    const dataHandler = stdoutOnCalls.find(([evt]) => evt === 'data')?.[1] as ((chunk: Buffer) => void) | undefined;
    dataHandler?.(pcmChunk);

    // Simulate Enter keypress (triggers ffmpeg kill)
    _stdinOnListener?.(Buffer.from('\n'));

    // Simulate ffmpeg clean exit
    simulateFfmpegClose(0);

    const result = await resultPromise;

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0.502, 2);
    expect(result[1]).toBeCloseTo(-0.502, 2);
    expect(result[2]).toBeCloseTo(0.0, 2);
    expect(result[3]).toBeCloseTo(1.0, 2);
  });

  it('throws when stdin is not a TTY', async () => {
    // Make isTTY return false without overwriting the stdin object
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
      writable: true,
    });

    await expect(captureMicAudio()).rejects.toThrow(
      '--voice requires an interactive terminal (cannot use with piped input)'
    );
  });

  it('throws when ffmpeg exits with non-zero code', async () => {
    restoreStdin = mockStdinIsTTY(true);

    const resultPromise = captureMicAudio();

    // Simulate Enter to trigger kill (prevents stdin listener leak)
    _stdinOnListener?.(Buffer.from('\n'));

    // Simulate ffmpeg failing
    simulateFfmpegClose(2);

    await expect(resultPromise).rejects.toThrow(
      'ffmpeg exited with code 2. Check that your microphone is connected and accessible.'
    );
  });
});