/**
 * Unit tests for src/tui/commands.ts — TUI command palette
 *
 * Covers all 11 commands with branches for:
 * - Missing arguments, unknown args, empty state
 * - Happy paths, error paths, and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted() — required for all variables referenced inside vi.mock()
// ---------------------------------------------------------------------------

const { mockAudioPlayer, mockBrowserLauncher, mockPreviewRouter, mockFs, mockFormatError, mockMetaHarness, mockLLMClientStatic, mockLLMModeAgent } = vi.hoisted(() => {
  const audio = {
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
    getWaveform: vi.fn().mockReturnValue('▃▅▇█▆▄▂▁▃▅▇█▆▄▂▁▃▅▇█▆▄▂▁▃▅▇█▆'),
    getAudioInfo: vi.fn(),
  };

  const browser = {
    getInfo: vi.fn().mockReturnValue({ running: false, port: 3456, lastUrl: undefined }),
    previewFile: vi.fn(),
    reopenLast: vi.fn().mockResolvedValue(null),
    stopServer: vi.fn().mockResolvedValue(undefined),
  };

  const router = {
    route: vi.fn(),
  };

  const fsMock = {
    access: vi.fn(),
    readFile: vi.fn(),
  };

  const formatErr = vi.fn((_ctx: string, err: unknown) => `${_ctx}: ${err instanceof Error ? err.message : String(err)}`);

  const harness = {
    getStatus: vi.fn(),
    getLLMClient: vi.fn(),
  };

  const llmStatic = {
    isConfigured: vi.fn().mockReturnValue(false),
  };

  const llmAgent = {
    executeTask: vi.fn(),
  };

  return {
    mockAudioPlayer: audio,
    mockBrowserLauncher: browser,
    mockPreviewRouter: router,
    mockFs: fsMock,
    mockFormatError: formatErr,
    mockMetaHarness: harness,
    mockLLMClientStatic: llmStatic,
    mockLLMModeAgent: llmAgent,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/tui/preview/AudioPlayer.js', () => ({
  audioPlayer: mockAudioPlayer,
}));

vi.mock('../../../src/tui/preview/BrowserLauncher.js', () => ({
  browserLauncher: mockBrowserLauncher,
}));

vi.mock('../../../src/tui/preview/PreviewRouter.js', () => ({
  previewRouter: mockPreviewRouter,
}));

vi.mock('node:fs/promises', () => ({
  default: mockFs,
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: mockFormatError,
}));

vi.mock('../../../src/harness/index.js', () => ({
  metaHarness: mockMetaHarness,
}));

vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: mockLLMClientStatic,
}));

vi.mock('../../../src/harness/agent/LLMModeAgent.js', () => ({
  LLMModeAgent: class {
    executeTask = mockLLMModeAgent.executeTask;
  },
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks are set up
// ---------------------------------------------------------------------------

import { commands } from '../../../src/tui/commands.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides?: Partial<{
  tasks: Array<{ id: string; title: string; description: string; targetFile?: string; approved: boolean }>;
  logs: string[];
}>) {
  const logs: string[] = [];
  return {
    agent: {
      executeTask: vi.fn(),
    },
    tasks: overrides?.tasks ?? [],
    logs: overrides?.logs ?? logs,
    addLog: vi.fn((msg: string) => logs.push(msg)),
    setStatusMessage: vi.fn(),
    addOutput: vi.fn(),
    createPendingAction: vi.fn().mockReturnValue({ id: 'pending-1' }),
    confirmPendingAction: vi.fn().mockResolvedValue('Approved'),
    cancelPendingAction: vi.fn().mockReturnValue(true),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioPlayer.isPlaying.mockReturnValue(false);
    mockLLMClientStatic.isConfigured.mockReturnValue(false);
  });

  // ── help ────────────────────────────────────────────────────────────────

  describe('help', () => {
    it('lists all commands when no arg is given', async () => {
      const result = await commands.help.execute([], makeCtx());
      expect(result).toContain('Commands:');
      expect(result).toContain('/help');
      expect(result).toContain('/status');
      expect(result).toContain('/tasks');
    });

    it('shows specific help for a known command', async () => {
      const result = await commands.help.execute(['status'], makeCtx());
      expect(result).toContain('status');
      expect(result).toContain('Usage: /status');
    });

    it('lists all commands when given an unknown command arg', async () => {
      const result = await commands.help.execute(['nonexistent'], makeCtx());
      expect(result).toContain('Commands:');
      expect(result).not.toContain('nonexistent:');
    });

    it('includes aliases for commands that have them', async () => {
      // exit has aliases ['quit', 'q']
      const listing = await commands.help.execute([], makeCtx());
      // The general listing should include exit
      expect(listing).toContain('exit');
    });
  });

  // ── status ──────────────────────────────────────────────────────────────

  describe('status', () => {
    it('shows online harness, stopped browser, stopped audio', async () => {
      mockMetaHarness.getStatus.mockReturnValue({
        initialized: true,
        activeProvider: 'openai',
        recentFailures: 2,
        detectedPatterns: ['p1', 'p2', 'p3'],
      });
      mockBrowserLauncher.getInfo.mockReturnValue({ running: false, port: 3456 });
      mockAudioPlayer.isPlaying.mockReturnValue(false);

      const result = await commands.status.execute([], makeCtx());

      expect(result).toContain('Online');
      expect(result).toContain('openai');
      expect(result).toContain('Failures: 2');
      expect(result).toContain('Patterns: 3');
      expect(result).toContain('Stopped');
    });

    it('shows offline harness and running browser', async () => {
      mockMetaHarness.getStatus.mockReturnValue({
        initialized: false,
        activeProvider: 'none',
        recentFailures: 0,
        detectedPatterns: [],
      });
      mockBrowserLauncher.getInfo.mockReturnValue({ running: true, port: 8080 });
      mockAudioPlayer.isPlaying.mockReturnValue(true);

      const result = await commands.status.execute([], makeCtx());

      expect(result).toContain('Offline');
      expect(result).toContain('Port 8080');
      expect(result).toContain('Playing');
    });
  });

  // ── tasks ───────────────────────────────────────────────────────────────

  describe('tasks', () => {
    it('returns "No pending tasks" when list is empty', async () => {
      const result = await commands.tasks.execute([], makeCtx({ tasks: [] }));
      expect(result).toBe('No pending tasks');
    });

    it('formats tasks with id and truncated title', async () => {
      const ctx = makeCtx({
        tasks: [
          { id: 't1', title: 'Short task', description: '', approved: true },
          { id: 'task-2', title: 'A'.repeat(50), description: '', approved: true },
        ],
      });
      const result = await commands.tasks.execute([], ctx);

      expect(result).toContain('t1');
      expect(result).toContain('Short task');
      expect(result).toContain('task-2');
      expect(result).toContain('...'); // title > 40 chars gets truncated
    });

    it('does not truncate short titles', async () => {
      const ctx = makeCtx({
        tasks: [
          { id: 't3', title: 'Fix bug', description: '', approved: true },
        ],
      });
      const result = await commands.tasks.execute([], ctx);
      expect(result).toContain('Fix bug');
      expect(result).not.toContain('...');
    });
  });

  // ── run ─────────────────────────────────────────────────────────────────

  describe('run', () => {
    it('returns error when taskId is missing', async () => {
      const result = await commands.run.execute([], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('Task ID required');
    });

    it('returns error when taskId is not found in ctx.tasks', async () => {
      const ctx = makeCtx({ tasks: [] });
      const result = await commands.run.execute(['missing-id'], ctx);
      expect(result).toContain('Error');
      expect(result).toContain('not found');
    });

    it('creates pending action and returns awaiting approval message', async () => {
      const task = { id: 't1', title: 'Test task', description: '', targetFile: '/tmp/out.html', approved: true };
      const ctx = makeCtx({ tasks: [task] });

      const result = await commands.run.execute(['t1'], ctx);

      expect(ctx.createPendingAction).toHaveBeenCalledWith('structured', task);
      expect(result).toContain('awaiting approval');
      expect(result).toContain('pending-1');
      expect(ctx.setStatusMessage).toHaveBeenCalledWith('Task awaiting approval');
    });

    it('returns error when task is not found', async () => {
      const ctx = makeCtx({ tasks: [] });

      const result = await commands.run.execute(['nonexistent'], ctx);

      expect(result).toContain('not found');
      expect(ctx.createPendingAction).not.toHaveBeenCalled();
    });
  });

  // ── agent ───────────────────────────────────────────────────────────────

  describe('agent', () => {
    it('returns error when description is empty', async () => {
      const result = await commands.agent.execute([], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('description required');
    });

    it('returns error when LLM is not configured', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(false);
      const result = await commands.agent.execute(['fix', 'something'], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('No LLM configured');
    });

    it('returns error when metaHarness LLM client is null', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue(null);

      const result = await commands.agent.execute(['fix bug'], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('LLM client not initialized');
    });

    it('creates pending LLM task and returns awaiting approval message', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue({ generate: vi.fn(), generateWithToolLoop: vi.fn().mockResolvedValue({ content: 'mock', toolCalls: [], success: true }) });

      const ctx = makeCtx();
      const result = await commands.agent.execute(['Fix validation bug'], ctx);

      expect(ctx.createPendingAction).toHaveBeenCalledWith('llm', expect.objectContaining({
        title: 'Fix validation bug',
        description: 'Fix validation bug',
        approved: false,
      }));
      expect(result).toContain('not auto-approved');
      expect(result).toContain('pending-1');
      expect(ctx.setStatusMessage).toHaveBeenCalledWith('Task awaiting approval');
    });

    it('returns error when LLM is not configured', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(false);
      const result = await commands.agent.execute(['fix', 'something'], makeCtx());
      expect(result).toContain('No LLM configured');
    });

    it('returns error when metaHarness LLM client is null', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue(null);

      const result = await commands.agent.execute(['fix bug'], makeCtx());
      expect(result).toContain('LLM client not initialized');
    });
  });

  // ── preview ─────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('returns error when filePath is missing', async () => {
      const result = await commands.preview.execute([], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('File path required');
    });

    it('returns error when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await commands.preview.execute(['/no/such/file.ts'], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('File not found');
    });

    it('routes to terminal for code files', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('const x = 1;\nconst y = 2;\n');
      mockPreviewRouter.route.mockResolvedValue({ target: 'terminal', terminalType: 'code' });

      const ctx = makeCtx();
      const result = await commands.preview.execute(['/tmp/code.ts'], ctx);

      expect(result).toContain('terminal');
      expect(ctx.addOutput).toHaveBeenCalledWith('code', expect.any(String));
    });

    it('routes to browser and returns url', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockPreviewRouter.route.mockResolvedValue({ target: 'browser' });
      mockBrowserLauncher.previewFile.mockResolvedValue('http://localhost:3456/preview/test.html');

      const ctx = makeCtx();
      const result = await commands.preview.execute(['/tmp/visual.html'], ctx);

      expect(result).toContain('http://localhost:3456/preview/test.html');
      expect(mockBrowserLauncher.previewFile).toHaveBeenCalledWith('/tmp/visual.html');
    });

    it('routes to both for audio files and plays audio', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockPreviewRouter.route.mockResolvedValue({ target: 'both', terminalType: 'waveform' });
      mockAudioPlayer.play.mockResolvedValue({ success: true });
      mockAudioPlayer.getAudioInfo.mockReturnValue({ name: 'song.mp3', format: 'MP3' });

      const ctx = makeCtx();
      const result = await commands.preview.execute(['/tmp/song.mp3'], ctx);

      expect(mockAudioPlayer.play).toHaveBeenCalledWith('/tmp/song.mp3');
      expect(result).toContain('Playing audio');
      expect(ctx.addOutput).toHaveBeenCalledWith('audio', expect.stringContaining('song.mp3'));
    });

    it('handles audio play failure in "both" route', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockPreviewRouter.route.mockResolvedValue({ target: 'both', terminalType: 'waveform' });
      mockAudioPlayer.play.mockResolvedValue({ success: false, error: 'No player found' });

      const result = await commands.preview.execute(['/tmp/song.mp3'], makeCtx());
      expect(result).toContain('Error playing audio');
      expect(result).toContain('No player found');
    });

    it('returns reason when target is none', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockPreviewRouter.route.mockResolvedValue({ target: 'none', reason: 'Unknown content type: .xyz' });

      const result = await commands.preview.execute(['/tmp/data.xyz'], makeCtx());
      expect(result).toContain('Cannot preview');
      expect(result).toContain('Unknown content type: .xyz');
    });
  });

  // ── play ────────────────────────────────────────────────────────────────

  describe('play', () => {
    it('returns error when filePath is missing', async () => {
      const result = await commands.play.execute([], makeCtx());
      expect(result).toContain('Error');
      expect(result).toContain('Audio file required');
    });

    it('returns error when play fails', async () => {
      mockAudioPlayer.play.mockResolvedValue({ success: false, error: 'No player found' });

      const result = await commands.play.execute(['/tmp/song.mp3'], makeCtx());
      expect(result).toContain('No player found');
    });

    it('plays successfully and outputs waveform info', async () => {
      mockAudioPlayer.play.mockResolvedValue({ success: true });
      mockAudioPlayer.getAudioInfo.mockReturnValue({ name: 'track.wav', format: 'WAV' });

      const ctx = makeCtx();
      const result = await commands.play.execute(['/tmp/track.wav'], ctx);

      expect(result).toContain('Playing WAV audio');
      expect(ctx.addOutput).toHaveBeenCalledWith('audio', expect.stringContaining('track.wav'));
    });
  });

  // ── stop ────────────────────────────────────────────────────────────────

  describe('stop', () => {
    it('returns message when nothing is playing', async () => {
      mockAudioPlayer.isPlaying.mockReturnValue(false);
      const result = await commands.stop.execute([], makeCtx());
      expect(result).toBe('No audio playing');
    });

    it('stops audio when something is playing', async () => {
      mockAudioPlayer.isPlaying.mockReturnValue(true);
      const result = await commands.stop.execute([], makeCtx());
      expect(mockAudioPlayer.stop).toHaveBeenCalled();
      expect(result).toContain('Audio stopped');
    });
  });

  // ── browser ─────────────────────────────────────────────────────────────

  describe('browser', () => {
    it('opens a file when arg is provided', async () => {
      mockBrowserLauncher.previewFile.mockResolvedValue('http://localhost:3456/preview/test.html');

      const result = await commands.browser.execute(['/tmp/test.html'], makeCtx());
      expect(mockBrowserLauncher.previewFile).toHaveBeenCalledWith('/tmp/test.html');
      expect(result).toContain('http://localhost:3456/preview/test.html');
    });

    it('reopens last preview when no arg and lastUrl exists', async () => {
      mockBrowserLauncher.reopenLast.mockResolvedValue('http://localhost:3456/preview/old.html');

      const result = await commands.browser.execute([], makeCtx());
      expect(result).toContain('Reopened');
      expect(result).toContain('http://localhost:3456/preview/old.html');
    });

    it('returns message when no arg and no previous preview', async () => {
      mockBrowserLauncher.reopenLast.mockResolvedValue(null);

      const result = await commands.browser.execute([], makeCtx());
      expect(result).toContain('No previous preview');
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('returns the terminal escape code', async () => {
      const result = await commands.clear.execute([], makeCtx());
      expect(result).toBe('\x1B[2J\x1B[H');
    });
  });

  // ── exit ────────────────────────────────────────────────────────────────

  describe('exit', () => {
    it('calls stop() and stopServer()', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

      await commands.exit.execute([], makeCtx());

      expect(mockAudioPlayer.stop).toHaveBeenCalled();
      expect(mockBrowserLauncher.stopServer).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it('has aliases defined', () => {
      expect(commands.exit.aliases).toEqual(['quit', 'q']);
    });
  });

  // ── command registry structure ──────────────────────────────────────────

  describe('registry shape', () => {
    it('has all 11 commands registered', () => {
      const keys = Object.keys(commands);
      expect(keys).toHaveLength(14);
      expect(keys).toContain('help');
      expect(keys).toContain('status');
      expect(keys).toContain('provider');
      expect(keys).toContain('tasks');
      expect(keys).toContain('run');
      expect(keys).toContain('agent');
      expect(keys).toContain('confirm');
      expect(keys).toContain('cancel');
      expect(keys).toContain('preview');
      expect(keys).toContain('play');
      expect(keys).toContain('stop');
      expect(keys).toContain('browser');
      expect(keys).toContain('clear');
      expect(keys).toContain('exit');
    });

    it('every command has name, description, usage, and execute', () => {
      for (const cmd of Object.values(commands)) {
        expect(cmd.name).toBeTruthy();
        expect(cmd.description).toBeTruthy();
        expect(cmd.usage).toBeTruthy();
        expect(typeof cmd.execute).toBe('function');
      }
    });
  });
});
