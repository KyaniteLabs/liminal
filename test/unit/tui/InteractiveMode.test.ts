import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mock references (required for vi.mock factories) ----

const mockQuestion = vi.hoisted(() =>
  vi.fn<(query: string, callback: (answer: string) => void) => void>()
);
const mockClose = vi.hoisted(() => vi.fn());
const mockGetRecent = vi.hoisted(() =>
  vi.fn<(limit: number) => Promise<string[]>>()
);

vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: mockQuestion,
      close: mockClose,
    })),
  },
}));

vi.mock('../../../src/config/PromptHistory.js', () => ({
  PromptHistory: class {
    getRecent = mockGetRecent;
  },
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { InteractiveMode } from '../../../src/tui/InteractiveMode.js';

/**
 * Helper: invoke the callback stored by the most recent mockQuestion call.
 * This simulates the user typing an answer into readline.
 */
function answerQuestion(answer: string): void {
  const calls = mockQuestion.mock.calls;
  if (calls.length === 0) {
    throw new Error('answerQuestion: no question() call recorded yet');
  }
  const lastCall = calls[calls.length - 1];
  const callback = lastCall[1] as (ans: string) => void;
  callback(answer);
}

describe('InteractiveMode', () => {
  let mode: InstanceType<typeof InteractiveMode>;
  let mockHistory: { getRecent: typeof mockGetRecent };

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh mock history object for each test
    mockHistory = { getRecent: mockGetRecent };
    mockGetRecent.mockResolvedValue([]);
    mode = new InteractiveMode(mockHistory as never);
  });

  // ---- getProviders ----

  describe('getProviders()', () => {
    it('returns correct list of 5 providers', () => {
      const providers = mode.getProviders();
      expect(providers).toEqual([
        'lmstudio',
        'minimax',
        'ollama',
        'openai',
        'hybrid',
      ]);
      expect(providers).toHaveLength(5);
    });
  });

  // ---- selectPrompt ----

  describe('selectPrompt()', () => {
    it('returns null when no recent prompts', async () => {
      mockGetRecent.mockResolvedValueOnce([]);
      const result = await mode.selectPrompt();
      expect(result).toBeNull();
      expect(mockQuestion).not.toHaveBeenCalled();
    });

    it('returns selected prompt when valid number entered', async () => {
      const recent = [
        'generate a p5 sketch',
        'fix the build error',
        'explain map elites',
      ];
      mockGetRecent.mockResolvedValueOnce(recent);

      const promise = mode.selectPrompt();
      // Let the getRecent microtask resolve before answering
      await vi.waitFor(() => expect(mockQuestion).toHaveBeenCalled());
      answerQuestion('2');

      const result = await promise;
      expect(result).toBe('fix the build error');
    });

    it('returns null when 0 entered (custom prompt)', async () => {
      mockGetRecent.mockResolvedValueOnce(['some prompt']);

      const promise = mode.selectPrompt();
      await vi.waitFor(() => expect(mockQuestion).toHaveBeenCalled());
      answerQuestion('0');

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  // ---- enterCustomPrompt ----

  describe('enterCustomPrompt()', () => {
    it('returns entered text', async () => {
      const promise = mode.enterCustomPrompt();
      answerQuestion('my custom prompt text');

      const result = await promise;
      expect(result).toBe('my custom prompt text');
    });

    it('returns default when empty input', async () => {
      const promise = mode.enterCustomPrompt('default value');
      answerQuestion('   ');

      const result = await promise;
      expect(result).toBe('default value');
    });
  });

  // ---- selectProvider ----

  describe('selectProvider()', () => {
    it('returns selected provider', async () => {
      // Provider list: lmstudio(1), minimax(2), ollama(3), openai(4), hybrid(5)
      const promise = mode.selectProvider();
      answerQuestion('3');

      const result = await promise;
      expect(result).toBe('ollama');
    });

    it('returns lmstudio when invalid number', async () => {
      const promise = mode.selectProvider();
      answerQuestion('99');

      const result = await promise;
      expect(result).toBe('lmstudio');
    });
  });

  // ---- run ----

  describe('run()', () => {
    it('throws when no prompt provided', async () => {
      // selectPrompt: no recent → returns null without calling question
      // enterCustomPrompt: question called → answer empty
      mockGetRecent.mockResolvedValueOnce([]);

      const promise = mode.run();
      // Wait for enterCustomPrompt's question to be called
      await vi.waitFor(() => expect(mockQuestion).toHaveBeenCalled());
      answerQuestion('');

      await expect(promise).rejects.toThrow('No prompt provided');
    });
  });

  // ---- close ----

  describe('close()', () => {
    it('closes readline', () => {
      mode.close();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });
});
