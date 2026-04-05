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

    it('executes task and returns success status', async () => {
      const task = { id: 't1', title: 'Test task', description: '', targetFile: '/tmp/out.html', approved: true };
      const ctx = makeCtx({ tasks: [task] });
      ctx.agent.executeTask.mockResolvedValue({ status: 'success', steps: [{}, {}] });

      const result = await commands.run.execute(['t1'], ctx);

      expect(ctx.agent.executeTask).toHaveBeenCalledWith(task);
      expect(result).toContain('SUCCESS');
      expect(result).toContain('Steps: 2');
      expect(ctx.addLog).toHaveBeenCalledWith('Starting task t1');
    });

    it('logs auto-preview hint when task succeeds with targetFile', async () => {
      const task = { id: 't2', title: 'Preview task', description: '', targetFile: '/tmp/visual.html', approved: true };
      const ctx = makeCtx({ tasks: [task] });
      ctx.agent.executeTask.mockResolvedValue({ status: 'success', steps: [] });

      await commands.run.execute(['t2'], ctx);

      expect(ctx.addLog).toHaveBeenCalledWith('Run /preview /tmp/visual.html to see result');
    });

    it('does not log preview hint when task has no targetFile', async () => {
      const task = { id: 't3', title: 'No target', description: '', approved: true };
      const ctx = makeCtx({ tasks: [task] });
      ctx.agent.executeTask.mockResolvedValue({ status: 'success', steps: [] });

      await commands.run.execute(['t3'], ctx);

      const previewCalls = ctx.addLog.mock.calls.filter((c: string[]) => c[0]?.includes('/preview'));
      expect(previewCalls).toHaveLength(0);
    });

    it('reports failure status from task execution', async () => {
      const task = { id: 't4', title: 'Failing task', description: '', approved: true };
      const ctx = makeCtx({ tasks: [task] });
      ctx.agent.executeTask.mockResolvedValue({ status: 'failed', steps: [{}] });

      const result = await commands.run.execute(['t4'], ctx);
      expect(result).toContain('FAILED');
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

    it('executes LLM agent and reports success', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue({ generate: vi.fn() });

      const mockSession = {
        status: 'success',
        stepCount: 5,
        messages: [
          { role: 'assistant', toolCall: { tool: 'readFile', thought: 'Reading the main file to understand the structure' } },
          { role: 'tool', toolResult: { success: true } },
          { role: 'assistant', content: 'Planning next step' },
        ],
      };
      mockLLMModeAgent.executeTask.mockResolvedValue(mockSession);

      const ctx = makeCtx();
      const result = await commands.agent.execute(['Fix', 'validation', 'bug'], ctx);

      expect(result).toContain('SUCCESS');
      expect(result).toContain('Steps: 5');
      expect(result).toContain('LLM Calls: 2');
      expect(ctx.addLog).toHaveBeenCalled();
    });

    it('handles rolled_back status from LLM agent', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue({ generate: vi.fn() });

      mockLLMModeAgent.executeTask.mockResolvedValue({
        status: 'rolled_back',
        stepCount: 3,
        messages: [],
      });

      const result = await commands.agent.execute(['bad task'], makeCtx());
      expect(result).toContain('ROLLED_BACK');
      expect(result).toContain('Changes were rolled back');
    });

    it('handles exception from LLM agent execution', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue({ generate: vi.fn() });
      mockLLMModeAgent.executeTask.mockRejectedValue(new Error('LLM timeout'));

      const result = await commands.agent.execute(['causes error'], makeCtx());
      expect(result).toContain('Command: LLM timeout');
    });

    it('logs tool calls with thought and tool results', async () => {
      mockLLMClientStatic.isConfigured.mockReturnValue(true);
      mockMetaHarness.getLLMClient.mockReturnValue({ generate: vi.fn() });

      mockLLMModeAgent.executeTask.mockResolvedValue({
        status: 'success',
        stepCount: 1,
        messages: [
          { role: 'assistant', toolCall: { tool: 'writeFile', thought: 'Writing the fixed output to disk now' } },
          { role: 'tool', toolResult: { success: false, error: 'Permission denied' } },
        ],
      });

      const ctx = makeCtx();
      await commands.agent.execute(['fix perms'], ctx);

      // Should log the tool call with truncated thought
      const logCalls = ctx.addLog.mock.calls.map((c: string[]) => c[0]);
      expect(logCalls.some((l: string) => l.includes('writeFile'))).toBe(true);
      expect(logCalls.some((l: string) => l.includes('Permission denied'))).toBe(true);
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
      expect(result).toBe('\x1Bc');
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
      expect(keys).toHaveLength(11);
      expect(keys).toContain('help');
      expect(keys).toContain('status');
      expect(keys).toContain('tasks');
      expect(keys).toContain('run');
      expect(keys).toContain('agent');
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
