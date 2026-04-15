import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
const {
  mockComplete,
  mockStreamWithThinking,
  mockGetConfig,
  mockLoadSoul,
  mockFormatError,
  mockMetaHarnessGetStatus,
  mockBrowserLauncherPreview,
  mockBrowserLauncherGetInfo,
  mockAudioIsPlaying,
  mockOnStatus,
  mockOnLog,
} = vi.hoisted(() => ({
  mockComplete: vi.fn(),
  mockStreamWithThinking: vi.fn(),
  mockGetConfig: vi.fn(() => ({ model: 'test-model' })),
  mockLoadSoul: vi.fn(async () => 'You are Liminal, a creative coding partner.'),
  mockFormatError: vi.fn((_ctx: string, err: unknown) => `Formatted: ${String(err)}`),
  mockMetaHarnessGetStatus: vi.fn(() => ({
    initialized: true,
    activeProvider: 'openai',
    configuredProviders: ['openai'],
    recentFailures: 2,
    detectedPatterns: [{ name: 'test-pattern' }],
    appliedAdaptations: [],
    memory: {},
  })),
  mockBrowserLauncherPreview: vi.fn(async (filePath: string) => `http://localhost:3000/${filePath}`),
  mockBrowserLauncherGetInfo: vi.fn(() => ({ running: false, port: null })),
  mockAudioIsPlaying: vi.fn(() => false),
  mockOnStatus: vi.fn(),
  mockOnLog: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────
vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    complete = mockComplete;
    streamWithThinking = mockStreamWithThinking;
    getConfig = mockGetConfig;
    static isConfigured() {
      return true;
    }
  },
}));

vi.mock('../../../src/tui/IntentRouter.js', () => ({
  loadSoul: mockLoadSoul,
}));

vi.mock('../../../src/harness/index.js', () => ({
  metaHarness: {
    getStatus: mockMetaHarnessGetStatus,
  },
}));

vi.mock('../../../src/tui/preview/BrowserLauncher.js', () => ({
  browserLauncher: {
    previewFile: mockBrowserLauncherPreview,
    getInfo: mockBrowserLauncherGetInfo,
  },
}));

vi.mock('../../../src/tui/preview/AudioPlayer.js', () => ({
  audioPlayer: {
    isPlaying: mockAudioIsPlaying,
  },
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: mockFormatError,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/core/AmbiguityDetector.js', () => ({
  AmbiguityDetector: vi.fn(function(this: any) {
    this.detect = vi.fn((prompt: string) =>
      prompt.includes('cool')
        ? [
            {
              type: 'vague' as const,
              severity: 'medium' as const,
              description: 'Vague term "cool" found',
              suggestedQuestion: 'Describe the specific aesthetic or interaction you find "cool".',
            },
          ]
        : []
    );
    this.getDomainHints = vi.fn((_prompt: string) => ['p5']);
    this.isAmbiguous = vi.fn((prompt: string) => prompt.includes('cool'));
  }),
}));

// ── Import after mocks ───────────────────────────────────────────────
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { NaturalInterface } from '../../../src/tui/NaturalInterface.js';

// ── Helpers ──────────────────────────────────────────────────────────
function createInterface(tasks: any[] = []) {
  const harnessAgent = { executeTask: vi.fn() };
  const llmAgent = {
    executeTask: vi.fn().mockResolvedValue({
      status: 'success',
      stepCount: 1,
      messages: [],
    }),
  };
  const llmClient = new LLMClient();

  const iface = new NaturalInterface({
    harnessAgent: harnessAgent as any,
    llmAgent: llmAgent as any,
    llmClient: llmClient as any,
    tasks,
    onStatus: mockOnStatus,
    onLog: mockOnLog,
  });

  return { iface, harnessAgent, llmAgent, llmClient };
}

// ── Tests ────────────────────────────────────────────────────────────
describe('NaturalInterface', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Default mock for llmAgent - individual tests can override
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Constructor / Session ───────────────────────────────────────────

  describe('constructor', () => {
    it('initializes session with generated id and empty messages', async () => {
      const { iface } = createInterface();
      const session = iface.getSession();

      expect(session.id).toMatch(/^session-\d+$/);
      expect(session.messages).toEqual([]);
      expect(session.soul).toBe('');
      expect(session.createdAt).toBeTruthy();
      expect(session.updatedAt).toBeTruthy();
    });

    it('loads soul via loadSoul on construction', async () => {
      createInterface();
      expect(mockLoadSoul).toHaveBeenCalledOnce();
    });
  });

  // ── handleRun ───────────────────────────────────────────────────────

  describe('handleRun', () => {
    it('returns error when no task id provided', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/run');
      expect(result.response).toBe('Please specify a task ID. Usage: run <task-id>');
    });

    it('returns "not found" when task id does not exist', async () => {
      const { iface } = createInterface([
        { id: 'task-1', title: 'Exists', description: 'desc' },
      ]);
      const result = await iface.processInput('/run task-999');
      expect(result.response).toBe('Task task-999 not found');
    });

    it('executes task and returns status when found', async () => {
      const task = { id: 'job-x', title: 'Run me', description: 'Do it' };
      const { iface, harnessAgent } = createInterface([task]);
      harnessAgent.executeTask.mockResolvedValue({ status: 'failed', stepCount: 2 });

      const result = await iface.processInput('/run job-x');
      expect(result.response).toBe('Task job-x: FAILED');
      expect(harnessAgent.executeTask).toHaveBeenCalledWith(task);
    });
  });


  // ── handleDiagnostic ────────────────────────────────────────────────

  describe('handleDiagnostic', () => {
    it('reports FAIL when LLM connection fails', async () => {
      mockComplete
        .mockRejectedValueOnce(new Error('Network down'))
        .mockResolvedValueOnce({ success: true, text: 'banana' });

      const { iface } = createInterface();
      const result = await iface.processInput('/diagnostic');
      expect(result.response).toContain('LLM Connection: FAIL (Network down)');
    });

    it('reports FAIL when LLM returns unexpected text', async () => {
      mockComplete
        .mockResolvedValueOnce({ success: true, text: 'WRONG' })
        .mockResolvedValueOnce({ success: true, text: 'banana' });

      const { iface } = createInterface();
      const result = await iface.processInput('/diagnostic');
      expect(result.response).toContain('LLM Connection: FAIL');
    });

    it('reports FAIL for context retention when LLM misses the word', async () => {
      mockComplete
        .mockResolvedValueOnce({ success: true, text: 'PASS' })
        .mockResolvedValueOnce({ success: true, text: 'I do not recall anything' });

      const { iface } = createInterface();
      const result = await iface.processInput('/diagnostic');
      expect(result.response).toContain('Context Retention: FAIL');
    });

    it('includes provider and harness info in diagnostic output', async () => {
      mockComplete
        .mockResolvedValueOnce({ success: true, text: 'PASS' })
        .mockResolvedValueOnce({ success: true, text: 'banana' });

      const { iface } = createInterface();
      const result = await iface.processInput('/diagnostic');
      expect(result.response).toContain('Provider: test-model');
      expect(result.response).toContain('Harness: openai');
      expect(result.response).toContain('Failures loaded: 2');
    });
  });

  describe('handleStatus', () => {
    it('includes browser and audio state from the shared status command', async () => {
      mockBrowserLauncherGetInfo.mockReturnValue({ running: true, port: 3456 });
      mockAudioIsPlaying.mockReturnValue(true);

      const { iface } = createInterface();
      const result = await iface.processInput('/status');

      expect(result.response).toContain('Harness: 🟢 Online');
      expect(result.response).toContain('Browser: 🟢 Port 3456');
      expect(result.response).toContain('Audio: 🔊 Playing');
    });
  });

  describe('handleHelp', () => {
    it('lists only commands supported by NaturalInterface', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/help');

      expect(result.response).toContain('status - Show harness status');
      expect(result.response).toContain('preview <file> - Preview a file');
      expect(result.response).toContain('does not support /agent, /confirm, /cancel, /play, or /browser');
    });
  });

  // ── isAgentRequest ──────────────────────────────────────────────────

  describe('isAgentRequest (via processInput)', () => {
    it('matches "fix the bug" pattern', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('fix the bug in auth');
      expect(result.type).toBe('agent');
    });

    it('matches "add a new feature" pattern', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('add a new feature for logging');
      expect(result.type).toBe('agent');
    });

    it('matches "can you change the config" pattern', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('can you change the config');
      expect(result.type).toBe('agent');
    });

    it('matches "remove the deprecated function" pattern', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('remove the deprecated function');
      expect(result.type).toBe('agent');
    });

    it('matches "improve the performance" pattern', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('improve the performance');
      expect(result.type).toBe('agent');
    });
  });

  // ── handleAgentRequest ──────────────────────────────────────────────

  describe('handleAgentRequest', () => {
    it('returns success with emoji for successful session', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({
        status: 'success',
        stepCount: 4,
        messages: [
          { role: 'assistant', toolCall: { tool: 'readFile', thought: 'reading' } },
          { role: 'assistant', toolCall: { tool: 'applyEdit', thought: 'editing' } },
        ],
      });

      const result = await iface.processInput('fix the broken test');
      expect(result.type).toBe('agent');
      expect(result.response).toContain('Task success');
      expect(result.response).toContain('changes have been applied');
      expect(result.actionTaken).toBe('Executed 4 steps');
    });

    it('returns rolled_back message for rolled back session', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({
        status: 'rolled_back',
        stepCount: 2,
        messages: [],
      });

      const result = await iface.processInput('fix the error');
      expect(result.response).toContain('rolled back');
      expect(result.response).toContain('Changes were rolled back');
    });

    it('returns failure message for failed session', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({
        status: 'failed',
        stepCount: 1,
        messages: [],
      });

      const result = await iface.processInput('fix the crash');
      expect(result.response).toContain('could not be completed');
    });

    it('logs tool calls from session messages', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({
        status: 'success',
        stepCount: 1,
        messages: [{ role: 'assistant', toolCall: { tool: 'readFile', thought: 'check file' } }],
      });

      await iface.processInput('fix the import');
      expect(mockOnLog).toHaveBeenCalledWith(expect.stringContaining('readFile'));
    });

    it('handles errors from llmAgent.executeTask', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockRejectedValue(new Error('Agent crashed'));

      const result = await iface.processInput('fix the crash');
      expect(result.type).toBe('agent');
      expect(result.response).toContain('Agent crashed');
      expect(mockFormatError).toHaveBeenCalledWith('Agent', expect.any(Error));
    });

    it('returns type ambiguous without calling agent when prompt is vague', async () => {
      const { iface, llmAgent } = createInterface();
      // "make it cooler" triggers AmbiguityDetector mock (contains "cool")
      const result = await iface.processInput('make it cooler');
      expect(llmAgent.executeTask).not.toHaveBeenCalled();
      expect(result.type).toBe('ambiguous');
      expect(result.clarifyingQuestions).toBeDefined();
      expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);
    });

    it('calls the agent for unambiguous prompts', async () => {
      const { iface, llmAgent } = createInterface();
      // "fix the auth bug" — no "cool", "better", etc. — unambiguous
      llmAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1, messages: [] });
      const result = await iface.processInput('fix the auth bug');
      expect(llmAgent.executeTask).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('agent');
    });

    it('includes domain suggestions in ambiguous result', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('make it cooler');
      expect(result.suggestions).toContain('p5');
    });

    it('returns clarifying questions text in response for vague prompts', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('make it cooler');
      expect(result.response).toContain('Clarifying questions');
      expect(result.response).toContain('Describe');
    });
  });

});
