import { describe, expect, it, vi } from 'vitest';
import { Status } from '../../src/types/status.js';

const { executeTask } = vi.hoisted(() => ({
  executeTask: vi.fn(async (task: { id: string; title: string }) => ({
    task,
    messages: [
      {
        role: 'assistant',
        content: '',
        toolCall: {
          tool: 'gitStatus',
          thought: 'Inspect the repository status',
          params: {},
          expectedResult: 'Git status summary',
        },
      },
      {
        role: 'tool',
        content: '',
        toolResult: { success: true, data: { status: 'clean' } },
      },
    ],
    status: Status.SUCCESS,
    startTime: new Date(0).toISOString(),
    endTime: new Date(10).toISOString(),
    stepCount: 1,
    backups: [],
    successfulInspectionCalls: 1,
    modifiedExtensions: new Set<string>(),
    exploredPaths: new Set<string>(),
    mutatedFiles: new Set<string>(),
    activeFocusIndex: 0,
    focusInspectionBudgetRemaining: 0,
    focusStatus: 'rejected',
    focusAdjacentFileUsed: false,
  })),
}));

vi.mock('../../src/harness/agent/index.js', () => ({
  createLLMModeAgent: () => ({ executeTask }),
}));

const { TuiBridgeService } = await import('../../src/tui-bridge/TuiBridgeService.js');

function fakeLlm() {
  return {
    getConfig: () => ({ model: 'test-model' }),
  };
}

async function waitFor<T>(read: () => T | undefined): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const value = read();
    if (value !== undefined) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for event');
}

describe('Bubble Tea operator routing', () => {
  it('requires review for ordinary text instead of routing to chat-only in assist mode', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const result = await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'hello, check the current repository',
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    expect(result.reviewRequired).toBe(true);
    expect(executeTask).not.toHaveBeenCalled();
    expect(service.getStatus(session.sessionId).pendingAction?.description)
      .toContain('hello, check the current repository');
    expect(service.getEvents(session.sessionId).map(event => event.type)).toContain('action.review_required');
  });

  it('routes ordinary text to the Meta-Harness tool lane after autopilot approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: '/autonomy autopilot',
      clientIntent: 'command',
    });

    await service.submitInput(
      session.sessionId,
      {
        mode: 'chat',
        text: 'hello, check the current repository',
        clientIntent: 'chat',
      },
      fakeLlm() as never,
    );

    const turn = await waitFor(() => service.getEvents(session.sessionId)
      .find(event => event.type === 'session.turn'));

    expect(executeTask).toHaveBeenCalledOnce();
    expect(turn).toMatchObject({
      type: 'session.turn',
      intent: 'direct',
      delegatedTo: 'conveyor',
    });
    expect(service.getEvents(session.sessionId).map(event => event.type)).toContain('task.queued');
  });
});
