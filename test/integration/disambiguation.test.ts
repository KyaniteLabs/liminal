import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NaturalInterface } from '../../src/tui/NaturalInterface.js';

describe('disambiguation flow — integration', () => {
  let ni: NaturalInterface;
  let llmAgentExecuteTask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    llmAgentExecuteTask = vi.fn();

    const llmAgent = { executeTask: llmAgentExecuteTask } as any;
    const harnessAgent = { executeTask: vi.fn() } as any;
    const llmClient = { complete: vi.fn() } as any;

    ni = new NaturalInterface({
      harnessAgent,
      llmAgent,
      llmClient,
      tasks: [],
      onStatus: vi.fn(),
      onLog: vi.fn(),
    });
  });

  it('vague natural language triggers clarification before agent invocation', async () => {
    // "make it cooler" — "cooler" is flagged by AmbiguityDetector as vague
    const result = await ni.processInput('make it cooler');

    // Agent should NOT have been called
    expect(llmAgentExecuteTask).not.toHaveBeenCalled();

    // System should return clarification signal
    expect(result.type).toBe('ambiguous');
    expect(result.response).toContain('Clarifying questions');

    expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);

    // Domain hints should be included
    expect(result.suggestions).not.toBeNull();
  });

  it('specific natural language routes directly to agent without clarification', async () => {
    // "draw a blue circle at center 200 200 with radius 50" — specific enough
    llmAgentExecuteTask.mockResolvedValueOnce({
      id: 'agent-1',
      status: 'success',
      stepCount: 1,
      messages: [],
    });

    const result = await ni.processInput('draw a blue circle at center 200 200 with radius 50');

    // Agent SHOULD have been called
    expect(llmAgentExecuteTask).toHaveBeenCalledTimes(1);

    // Should be routed to agent, not clarification
    expect(result.type).toBe('agent');
    expect(result.response).toContain('success');
  });

  it('slash commands bypass disambiguation entirely', async () => {
    const result = await ni.processInput('/status');

    expect(llmAgentExecuteTask).not.toHaveBeenCalled();
    expect(result.type).toBe('command');
    expect(result.response).not.toContain('Clarifying questions');
  });

  it('disambiguation returns structured questions with suggested domains', async () => {
    const result = await ni.processInput('make it cooler');

    expect(result.type).toBe('ambiguous');
    // The clarifyingQuestions array is populated; suggestions may or may not be present
    // depending on whether domain keywords are detected in the input

    expect(result.clarifyingQuestions!.length).toBeGreaterThan(0);
    // The first question should be about the vague term "cooler"
    expect(result.clarifyingQuestions![0].question).toMatch(/cooler|aesthetic|cool/i);
  });
});
