import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks (accessible inside vi.mock factories) ─────────────
const {
  mockComplete,
  mockStreamWithThinking,
  mockGetConfig,
  mockLoadSoul,
  mockFormatError,
  mockMetaHarnessGetStatus,
  mockBrowserLauncherPreview,
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
  mockOnStatus: vi.fn(),
  mockOnLog: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────
vi.mock('../../../src/llm/LLMClient.js', () => ({
  LLMClient: class {
    complete = mockComplete;
    streamWithThinking = mockStreamWithThinking;
    getConfig = mockGetConfig;
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
  },
}));

vi.mock('../../../src/utils/errors.js', () => ({
  formatError: mockFormatError,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────
import { LLMClient } from '../../../src/llm/LLMClient.js';
import { NaturalInterface } from '../../../src/tui/NaturalInterface.js';

// ── Helpers ──────────────────────────────────────────────────────────
function createInterface(tasks: any[] = []) {
  const harnessAgent = { executeTask: vi.fn() };
  const llmAgent = { executeTask: vi.fn() };
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

  // ── getHistory / setTasks ───────────────────────────────────────────

  describe('getHistory', () => {
    it('returns empty array initially', async () => {
      const { iface } = createInterface();
      expect(iface.getHistory()).toEqual([]);
    });
  });

  describe('setTasks', () => {
    it('replaces the internal tasks array', async () => {
      const { iface } = createInterface();
      const tasks = [
        { id: 'task-1', title: 'First task', description: 'desc' },
        { id: 'task-2', title: 'Second task', description: 'desc' },
      ];
      iface.setTasks(tasks);

      // Verify by calling processInput with "tasks" command
      const result = await iface.processInput('tasks');
      expect(result.response).toContain('task-1');
      expect(result.response).toContain('task-2');
      expect(result.response).toContain('Pending tasks');
    });
  });

  // ── processInput — routing ──────────────────────────────────────────

  describe('processInput routing', () => {
    it('routes slash commands via handleSlashCommand', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/help');
      expect(result.type).toBe('command');
      expect(result.response).toContain("I'm Liminal");
    });

    it('routes command patterns via matchCommand', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('status');
      expect(result.type).toBe('command');
      expect(result.response).toContain('Harness:');
    });

    it('routes agent patterns via handleAgentRequest', async () => {
      const { iface, llmAgent } = createInterface();
      llmAgent.executeTask.mockResolvedValue({
        status: 'success',
        stepCount: 3,
        messages: [{ role: 'assistant', toolCall: { tool: 'applyEdit', thought: 'fixing' } }],
      });

      const result = await iface.processInput('fix the login bug');
      expect(result.type).toBe('agent');
      expect(result.response).toContain('success');
      expect(mockOnStatus).toHaveBeenCalledWith('Thinking...');
    });

    it('routes chat when no command or agent pattern matches', async () => {
      mockComplete.mockResolvedValue({
        success: true,
        text: '  Hello from Liminal!  ',
      });
      const { iface } = createInterface();

      const result = await iface.processInput('tell me a joke');
      expect(result.type).toBe('chat');
      expect(result.response).toBe('Hello from Liminal!');
    });

    it('adds user message to history before routing', async () => {
      mockComplete.mockResolvedValue({ success: true, text: 'hi' });
      const { iface } = createInterface();
      await iface.processInput('hello world');

      const history = iface.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('hello world');
    });
  });

  // ── matchCommand — pattern coverage ─────────────────────────────────

  describe('matchCommand (via processInput)', () => {
    it('matches "status" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('status');
      expect(result.type).toBe('command');
      expect(result.response).toContain('Harness:');
    });

    it('matches "health" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('health');
      expect(result.type).toBe('command');
      expect(result.response).toContain('Harness:');
    });

    it('matches "how are you"', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('how are you');
      expect(result.type).toBe('command');
      expect(result.response).toContain('Harness:');
    });

    it('matches "tasks" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('tasks');
      expect(result.response).toBe('No pending tasks.');
    });

    it('matches "todo" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('todo');
      expect(result.response).toBe('No pending tasks.');
    });

    it('matches "help" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('help');
      expect(result.response).toContain("I'm Liminal");
    });

    it('matches trailing "?" as help', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('what is this?');
      expect(result.type).toBe('command');
      expect(result.response).toContain("I'm Liminal");
    });

    it('matches "exit" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('exit');
      expect(result.shouldContinue).toBe(false);
      expect(result.response).toContain('Goodbye');
    });

    it('matches "quit" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('quit');
      expect(result.shouldContinue).toBe(false);
    });

    it('matches "q" as exit', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('q');
      expect(result.shouldContinue).toBe(false);
    });

    it('matches "clear" keyword', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('clear');
      expect(result.response).toBe('\x1Bc');
      expect(result.shouldContinue).toBe(true);
    });

    it('matches "run <id>" with task id capture', async () => {
      const task = { id: 't42', title: 'My task', description: 'Do the thing' };
      const { iface, harnessAgent } = createInterface([task]);
      harnessAgent.executeTask.mockResolvedValue({ status: 'success', stepCount: 1 });

      const result = await iface.processInput('run t42');
      expect(result.response).toBe('Task t42: SUCCESS');
    });

    it('matches "preview <file>" with file path capture', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('preview index.html');
      expect(result.response).toContain('http://localhost:3000/index.html');
    });
  });

  // ── executeCommand — switch branches ────────────────────────────────

  describe('executeCommand (via slash)', () => {
    it('/status returns harness status', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/status');
      expect(result.response).toContain('Online');
      expect(result.response).toContain('openai');
      expect(result.response).toContain('Recent failures: 2');
    });

    it('/help returns help text with command list', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/help');
      expect(result.response).toContain('status');
      expect(result.response).toContain('tasks');
      expect(result.response).toContain('run <id>');
      expect(result.response).toContain('preview <file>');
      expect(result.response).toContain('exit');
    });

    it('/clear returns ANSI escape sequence', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/clear');
      expect(result.response).toBe('\x1Bc');
    });

    it('/exit returns shouldContinue false', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/exit');
      expect(result.shouldContinue).toBe(false);
    });

    it('/quit returns shouldContinue false', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/quit');
      expect(result.shouldContinue).toBe(false);
    });

    it('/test runs diagnostics', async () => {
      mockComplete
        .mockResolvedValueOnce({ success: true, text: 'PASS' })
        .mockResolvedValueOnce({ success: true, text: 'yes I remember banana' });

      const { iface } = createInterface();
      const result = await iface.processInput('/test');
      expect(result.response).toContain('HARNESS DIAGNOSTIC RESULTS');
      expect(result.response).toContain('LLM Connection: PASS');
      expect(result.response).toContain('JSON Parsing: PASS');
      expect(result.response).toContain('Harness Online: PASS');
      expect(result.response).toContain('Context Retention: PASS');
    });

    it('/diagnostic runs same diagnostics as /test', async () => {
      mockComplete
        .mockResolvedValueOnce({ success: true, text: 'PASS' })
        .mockResolvedValueOnce({ success: true, text: 'banana confirmed' });

      const { iface } = createInterface();
      const result = await iface.processInput('/diagnostic');
      expect(result.response).toContain('HARNESS DIAGNOSTIC RESULTS');
    });

    it('unknown slash command returns ambiguous result', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/foobar');
      expect(result.type).toBe('ambiguous');
      expect(result.response).toContain('Unknown command: foobar');
      expect(result.response).toContain('Try "help"');
    });
  });

  // ── handleStatus ────────────────────────────────────────────────────

  describe('handleStatus', () => {
    it('shows offline when harness not initialized', async () => {
      mockMetaHarnessGetStatus.mockReturnValueOnce({
        initialized: false,
        activeProvider: 'none',
        configuredProviders: [],
        recentFailures: 0,
        detectedPatterns: [],
        appliedAdaptations: [],
        memory: {},
      });

      const { iface } = createInterface();
      const result = await iface.processInput('status');
      expect(result.response).toContain('Offline');
    });

    it('shows online and provider info when initialized', async () => {
      mockMetaHarnessGetStatus.mockReturnValueOnce({
        initialized: true,
        activeProvider: 'anthropic',
        configuredProviders: ['anthropic'],
        recentFailures: 5,
        detectedPatterns: [{ name: 'p1' }, { name: 'p2' }],
        appliedAdaptations: [],
        memory: {},
      });

      const { iface } = createInterface();
      const result = await iface.processInput('status');
      expect(result.response).toContain('Online');
      expect(result.response).toContain('anthropic');
      expect(result.response).toContain('Recent failures: 5');
      expect(result.response).toContain('Detected patterns: 2');
    });
  });

  // ── handleTasks ─────────────────────────────────────────────────────

  describe('handleTasks', () => {
    it('returns "No pending tasks" when tasks array is empty', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('tasks');
      expect(result.response).toBe('No pending tasks.');
    });

    it('lists tasks with id and truncated title', async () => {
      const tasks = [
        { id: 'task-a', title: 'Fix the authentication module', description: 'desc' },
        { id: 'task-b', title: 'Add new feature', description: 'desc' },
      ];
      const { iface } = createInterface(tasks);
      const result = await iface.processInput('tasks');
      expect(result.response).toContain('Pending tasks');
      expect(result.response).toContain('task-a');
      expect(result.response).toContain('Fix the authentication module');
      expect(result.response).toContain('task-b');
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

  // ── handlePreview ───────────────────────────────────────────────────

  describe('handlePreview', () => {
    it('returns error when no file path provided', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('/preview');
      expect(result.response).toBe('Please specify a file path. Usage: preview <file>');
    });

    it('launches browser with file and returns url', async () => {
      const { iface } = createInterface();
      const result = await iface.processInput('preview output.html');
      expect(mockBrowserLauncherPreview).toHaveBeenCalledWith('output.html');
      expect(result.response).toContain('http://localhost:3000/output.html');
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
  });

  // ── handleChat — non-streaming ──────────────────────────────────────

  describe('handleChat (non-streaming)', () => {
    it('returns cleaned response from LLM', async () => {
      mockComplete.mockResolvedValue({
        success: true,
        text: '  Here is my answer.  ',
      });
      const { iface } = createInterface();

      const result = await iface.processInput('tell me about p5 library');
      expect(result.type).toBe('chat');
      expect(result.response).toBe('Here is my answer.');
      expect(result.shouldContinue).toBe(true);
    });

    it('adds assistant message to history', async () => {
      mockComplete.mockResolvedValue({ success: true, text: 'Reply text' });
      const { iface } = createInterface();

      await iface.processInput('greetings friend');
      const history = iface.getHistory();
      expect(history).toHaveLength(2);
      expect(history[1].role).toBe('assistant');
      expect(history[1].content).toBe('Reply text');
    });

    it('throws when LLM returns unsuccessful result', async () => {
      mockComplete.mockResolvedValue({ success: false, error: 'Rate limited' });
      const { iface } = createInterface();

      const result = await iface.processInput('nice weather today');
      expect(result.response).toContain('Rate limited');
    });

    it('handles LLM exception gracefully', async () => {
      mockComplete.mockRejectedValue(new Error('Timeout'));
      const { iface } = createInterface();

      const result = await iface.processInput('nice day outside');
      expect(result.response).toContain('Timeout');
      expect(result.shouldContinue).toBe(true);
    });

    it('handles non-Error thrown values', async () => {
      mockComplete.mockRejectedValue('string error');
      const { iface } = createInterface();

      const result = await iface.processInput('good morning');
      expect(result.response).toContain('string error');
    });
  });

  // ── handleChat — streaming ──────────────────────────────────────────

  describe('handleChat (streaming)', () => {
    it('streams content events and returns full response', async () => {
      async function* mockStream() {
        yield { type: 'content', content: 'Hello ' };
        yield { type: 'content', content: 'World' };
      }
      mockStreamWithThinking.mockReturnValue(mockStream());

      const { iface } = createInterface();
      const chunks: string[] = [];
      const result = await iface.processInput('hi', (chunk) => { chunks.push(chunk); });

      expect(result.type).toBe('chat');
      expect(result.response).toBe('Hello World');
      expect(chunks).toEqual(['Hello ', 'World']);
    });

    it('streams thinking events with ANSI dim prefix', async () => {
      async function* mockStream() {
        yield { type: 'thinking', content: 'hmm' };
        yield { type: 'content', content: 'answer' };
      }
      mockStreamWithThinking.mockReturnValue(mockStream());

      const { iface } = createInterface();
      const streamCalls: any[] = [];
      await iface.processInput('think about this', (chunk, meta) => {
        streamCalls.push({ chunk, meta });
      });

      // Thinking event gets wrapped in ANSI escape codes
      expect(streamCalls[0].chunk).toContain('hmm');
      expect(streamCalls[0].chunk).toContain('\x1B[2m');
      expect(streamCalls[0].meta.type).toBe('thinking');
      expect(streamCalls[1].meta.type).toBe('content');
    });

    it('updates onStatus when thinking chars reach multiple of 50', async () => {
      // Generate thinking content that hits length 50
      const thinkingContent = 'a'.repeat(50);
      async function* mockStream() {
        yield { type: 'thinking', content: thinkingContent };
        yield { type: 'content', content: 'done' };
      }
      mockStreamWithThinking.mockReturnValue(mockStream());

      const { iface } = createInterface();
      await iface.processInput('ponder this', () => {});

      expect(mockOnStatus).toHaveBeenCalledWith(expect.stringContaining('Thinking... (50 chars)'));
    });

    it('stores thinking content in message metadata', async () => {
      async function* mockStream() {
        yield { type: 'thinking', content: 'deep thought' };
        yield { type: 'content', content: 'final answer' };
      }
      mockStreamWithThinking.mockReturnValue(mockStream());

      const { iface } = createInterface();
      await iface.processInput('complex question', () => {});

      const history = iface.getHistory();
      const assistantMsg = history.find(m => m.role === 'assistant');
      expect(assistantMsg?.metadata?.thinking).toBe('deep thought');
    });
  });

  // ── cleanThinkTags ──────────────────────────────────────────────────

  describe('cleanThinkTags (via chat responses)', () => {
    it('removes paired think tags and their content', async () => {
      mockComplete.mockResolvedValue({
        success: true,
        text: '<think internal reasoning here</think >Final answer',
      });
      const { iface } = createInterface();

      const result = await iface.processInput('tell me something');
      expect(result.response).toBe('Final answer');
    });

    it('removes orphaned opening think tags with closing bracket', async () => {
      mockComplete.mockResolvedValue({
        success: true,
        text: '<think type="internal">Some reasoning hereFinal answer',
      });
      const { iface } = createInterface();

      const result = await iface.processInput('tell me more');
      // The regex /<think\b[^>]*>/gi removes the opening <think type="internal">
      // but leaves the text after it
      expect(result.response).toBe('Some reasoning hereFinal answer');
    });

    it('removes orphaned closing think tags without space', async () => {
      mockComplete.mockResolvedValue({
        success: true,
        text: 'Hello world</think >extra text here',
      });
      const { iface } = createInterface();

      const result = await iface.processInput('say something fun');
      // "</think >" has a space before > so /<\/think>/gi won't match it.
      // The regex expects </think immediately followed by >.
      expect(result.response).toBe('Hello world</think >extra text here');
    });
  });
});
