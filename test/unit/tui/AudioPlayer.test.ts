/**
 * Unit tests for src/tui/preview/AudioPlayer.ts — cross-platform audio playback
 *
 * Covers: detectPlayer(), play(), stop(), isPlaying(), getWaveform(), getAudioInfo()
 * Mocks: node:child_process (spawn, execFile), node:util (promisify), process.platform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted() — required for all mock variables used in vi.mock() factories
// ---------------------------------------------------------------------------

const { mockSpawn, mockFormatError, mockCommandExists } = vi.hoisted(() => {
  const spawn = vi.fn();
  const formatError = vi.fn((_ctx: string, err: unknown) =>
    `${_ctx}: ${err instanceof Error ? err.message : String(err)}`
  );
  // commandExists is the promisified execFile result used by AudioPlayer
  // It is called with ('which', [cmd]) and returns Promise<{stdout: string}>
  const commandExists = vi.fn();
  return { mockSpawn: spawn, mockFormatError: formatError, mockCommandExists: commandExists };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
  // execFile is used by promisify at module load. We intercept promisify itself.
  execFile: vi.fn(),
}));

// Mock promisify so that when AudioPlayer calls promisify(execFile),
// it returns our mockCommandExists instead
vi.mock('node:util', () => ({
  promisify: vi.fn(() => mockCommandExists),
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: mockFormatError,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { AudioPlayer } from '../../../src/tui/preview/AudioPlayer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock child process object. */
function mockChildProcess(overrides?: { pid?: number }) {
  return {
    pid: overrides?.pid ?? 12345,
    on: vi.fn().mockReturnThis(),
    unref: vi.fn(),
    kill: vi.fn(),
  };
}

let originalPlatform: PropertyDescriptor | undefined;

function setPlatform(platform: string) {
  originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

function restorePlatform() {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPlatform('darwin');
  });

  afterEach(() => {
    restorePlatform();
  });

  // ── detectPlayer() ─────────────────────────────────────────────────────

  describe('detectPlayer()', () => {
    it('returns afplay on darwin', async () => {
      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toEqual({ command: 'afplay', args: [] });
    });

    it('returns mpg123 on linux when available', async () => {
      setPlatform('linux');
      mockCommandExists.mockResolvedValue({ stdout: '/usr/bin/mpg123' });

      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toEqual({ command: 'mpg123', args: ['-q'] });
      expect(mockCommandExists).toHaveBeenCalledWith('which', ['mpg123']);
    });

    it('returns ffplay on linux when mpg123 is unavailable', async () => {
      setPlatform('linux');
      mockCommandExists
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce({ stdout: '/usr/bin/ffplay' });

      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toEqual({ command: 'ffplay', args: ['-nodisp', '-autoexit', '-loglevel', 'quiet'] });
    });

    it('returns aplay on linux when mpg123 and ffplay are unavailable', async () => {
      setPlatform('linux');
      mockCommandExists
        .mockRejectedValueOnce(new Error('not found'))
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce({ stdout: '/usr/bin/aplay' });

      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toEqual({ command: 'aplay', args: ['-q'] });
    });

    it('returns null on linux when no player is available', async () => {
      setPlatform('linux');
      mockCommandExists.mockRejectedValue(new Error('not found'));

      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toBeNull();
    });

    it('returns start on win32', async () => {
      setPlatform('win32');
      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toEqual({ command: 'start', args: [] });
    });

    it('returns null on unknown platform', async () => {
      setPlatform('freebsd');
      const player = new AudioPlayer();
      const result = await player.detectPlayer();
      expect(result).toBeNull();
    });
  });

  // ── play() ─────────────────────────────────────────────────────────────

  describe('play()', () => {
    it('returns error when no player is available', async () => {
      setPlatform('freebsd');

      const player = new AudioPlayer();
      const result = await player.play('/tmp/song.mp3');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No audio player found');
    });

    it('spawns afplay on darwin successfully', async () => {
      const proc = mockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const player = new AudioPlayer();
      const result = await player.play('/tmp/song.mp3');

      expect(result.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'afplay',
        ['/tmp/song.mp3'],
        expect.objectContaining({ detached: true, stdio: 'ignore' }),
      );
    });

    it('uses execFile for win32 start command', async () => {
      setPlatform('win32');
      // On win32, play() calls execFile('start', ...) directly (not promisified one)
      // The mock for node:child_process provides execFile as vi.fn()
      const childProcess = await import('node:child_process');
      const mockExecFile = childProcess.execFile as ReturnType<typeof vi.fn>;
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: object) => {});

      const player = new AudioPlayer();
      const result = await player.play('/tmp/song.mp3');

      expect(result.success).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'start',
        ['/tmp/song.mp3'],
        expect.objectContaining({ shell: true, windowsHide: true }),
      );
    });

    it('stops previous audio before playing new audio', async () => {
      const proc1 = mockChildProcess({ pid: 111 });
      const proc2 = mockChildProcess({ pid: 222 });
      mockSpawn.mockReturnValueOnce(proc1).mockReturnValueOnce(proc2);

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const player = new AudioPlayer();
      await player.play('/tmp/song1.mp3');
      expect(player.isPlaying()).toBe(true);

      await player.play('/tmp/song2.mp3');
      // First process should have been killed
      expect(killSpy).toHaveBeenCalledWith(-111, 'SIGTERM');

      killSpy.mockRestore();
    });

    it('returns error on spawn exception', async () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('spawn ENOENT');
      });

      const player = new AudioPlayer();
      const result = await player.play('/tmp/song.mp3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('spawn ENOENT');
    });

    it('registers exit handler that clears currentProcess', async () => {
      const proc = mockChildProcess();
      mockSpawn.mockReturnValue(proc);

      const player = new AudioPlayer();
      await player.play('/tmp/song.mp3');
      expect(player.isPlaying()).toBe(true);

      // Find and invoke the 'exit' handler
      const exitCall = proc.on.mock.calls.find((c: [string]) => c[0] === 'exit');
      expect(exitCall).toBeTruthy();
      (exitCall![1] as () => void)();

      expect(player.isPlaying()).toBe(false);
    });

    it('does not clear currentProcess if a different process exits', async () => {
      const proc1 = mockChildProcess({ pid: 100 });
      const proc2 = mockChildProcess({ pid: 200 });
      mockSpawn.mockReturnValueOnce(proc1).mockReturnValueOnce(proc2);

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const player = new AudioPlayer();
      await player.play('/tmp/song1.mp3');
      await player.play('/tmp/song2.mp3');

      // currentProcess is proc2. Fire exit on proc1 — should NOT clear.
      const exitCall1 = proc1.on.mock.calls.find((c: [string]) => c[0] === 'exit');
      (exitCall1![1] as () => void)();

      expect(player.isPlaying()).toBe(true);

      killSpy.mockRestore();
    });

    it('registers error handler on spawned process', async () => {
      const proc = mockChildProcess();
      mockSpawn.mockReturnValue(proc);

      await new AudioPlayer().play('/tmp/song.mp3');

      const errorCall = proc.on.mock.calls.find((c: [string]) => c[0] === 'error');
      expect(errorCall).toBeTruthy();
    });

    it('calls unref on spawned process', async () => {
      const proc = mockChildProcess();
      mockSpawn.mockReturnValue(proc);

      await new AudioPlayer().play('/tmp/song.mp3');
      expect(proc.unref).toHaveBeenCalled();
    });
  });

  // ── stop() ─────────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('does nothing when no process is active', () => {
      const player = new AudioPlayer();
      expect(() => player.stop()).not.toThrow();
    });

    it('kills the process group when a process is active', async () => {
      const proc = mockChildProcess({ pid: 42 });
      mockSpawn.mockReturnValue(proc);

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const player = new AudioPlayer();
      await player.play('/tmp/song.mp3');
      player.stop();

      expect(killSpy).toHaveBeenCalledWith(-42, 'SIGTERM');
      expect(player.isPlaying()).toBe(false);

      killSpy.mockRestore();
    });

    it('handles kill error gracefully (process already dead)', async () => {
      const proc = mockChildProcess({ pid: 99 });
      mockSpawn.mockReturnValue(proc);

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('ESRCH');
      });

      const player = new AudioPlayer();
      await player.play('/tmp/song.mp3');

      expect(() => player.stop()).not.toThrow();
      expect(player.isPlaying()).toBe(false);

      killSpy.mockRestore();
    });
  });

  // ── isPlaying() ────────────────────────────────────────────────────────

  describe('isPlaying()', () => {
    it('returns false initially', () => {
      expect(new AudioPlayer().isPlaying()).toBe(false);
    });

    it('returns true after successful play', async () => {
      mockSpawn.mockReturnValue(mockChildProcess());

      const player = new AudioPlayer();
      await player.play('/tmp/song.mp3');
      expect(player.isPlaying()).toBe(true);
    });

    it('returns false after stop', async () => {
      mockSpawn.mockReturnValue(mockChildProcess());

      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const player = new AudioPlayer();
      await player.play('/tmp/song.mp3');
      player.stop();
      expect(player.isPlaying()).toBe(false);

      killSpy.mockRestore();
    });
  });

  // ── getWaveform() ──────────────────────────────────────────────────────

  describe('getWaveform()', () => {
    it('returns a 30-character string', () => {
      const waveform = new AudioPlayer().getWaveform();
      expect(waveform).toHaveLength(30);
    });

    it('contains only valid bar characters', () => {
      const validBars = new Set(['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588']);
      const waveform = new AudioPlayer().getWaveform();
      for (const ch of waveform) {
        expect(validBars.has(ch)).toBe(true);
      }
    });

    it('generates non-deterministic output across calls', () => {
      const player = new AudioPlayer();
      const results = new Set<string>();
      for (let i = 0; i < 10; i++) {
        results.add(player.getWaveform());
      }
      // At least some variation expected (random)
      expect(results.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ── getAudioInfo() ─────────────────────────────────────────────────────

  describe('getAudioInfo()', () => {
    it('returns MP3 format for .mp3 files', () => {
      const info = new AudioPlayer().getAudioInfo('/music/track.mp3');
      expect(info.name).toBe('track.mp3');
      expect(info.format).toBe('MP3');
    });

    it('returns WAV format for .wav files', () => {
      expect(new AudioPlayer().getAudioInfo('/music/drum.wav').format).toBe('WAV');
    });

    it('returns OGG format for .ogg files', () => {
      expect(new AudioPlayer().getAudioInfo('/music/sound.ogg').format).toBe('OGG');
    });

    it('returns FLAC format for .flac files', () => {
      expect(new AudioPlayer().getAudioInfo('/music/lossless.flac').format).toBe('FLAC');
    });

    it('returns AAC format for .aac files', () => {
      expect(new AudioPlayer().getAudioInfo('/music/compressed.aac').format).toBe('AAC');
    });

    it('returns M4A format for .m4a files', () => {
      expect(new AudioPlayer().getAudioInfo('/music/podcast.m4a').format).toBe('M4A');
    });

    it('returns uppercase extension for unknown formats', () => {
      expect(new AudioPlayer().getAudioInfo('/music/audio.wma').format).toBe('.WMA');
    });

    it('handles file with no extension', () => {
      const info = new AudioPlayer().getAudioInfo('/music/audiofile');
      expect(info.name).toBe('audiofile');
      expect(info.format).toBe('');
    });

    it('extracts basename correctly from deep path', () => {
      expect(new AudioPlayer().getAudioInfo('/deep/nested/path/to/song.mp3').name).toBe('song.mp3');
    });

    it('handles uppercase extension with lowercase normalization', () => {
      expect(new AudioPlayer().getAudioInfo('/music/SONG.MP3').format).toBe('MP3');
    });
  });
});
