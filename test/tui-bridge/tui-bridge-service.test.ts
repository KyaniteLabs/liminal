import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { mockRalphRun } = vi.hoisted(() => ({
  mockRalphRun: vi.fn(async () => ({
    code: 'generated output',
    iterations: 1,
    finalScore: 0.9,
    duration: 100,
    reason: 'ok',
    model: 'test-model',
  })),
}));

const { mockPreviewRoute, mockPreviewFile, mockReopenLast, mockAudioPlay, mockWaveform } = vi.hoisted(() => ({
  mockPreviewRoute: vi.fn(async () => ({ target: 'terminal', reason: 'code file', terminalType: 'code' })),
  mockPreviewFile: vi.fn(async (filePath: string) => `http://localhost:3456/preview/${filePath.split('/').pop()}`),
  mockReopenLast: vi.fn(async () => 'http://localhost:3456/preview/last.html'),
  mockAudioPlay: vi.fn(async () => ({ success: true })),
  mockWaveform: vi.fn(() => '▁▂▃▄'),
}));

const { mockHarnessExecuteTask } = vi.hoisted(() => ({
  mockHarnessExecuteTask: vi.fn(async () => ({ status: 'success' })),
}));

const { mockAgentExecuteTask } = vi.hoisted(() => ({
  mockAgentExecuteTask: vi.fn(async () => ({ status: 'success' })),
}));

vi.mock('../../src/core/RalphLoop.js', () => ({
  RalphLoop: {
    run: mockRalphRun,
  },
}));

vi.mock('../../src/tui/preview/PreviewRouter.js', () => ({
  previewRouter: {
    route: mockPreviewRoute,
  },
}));

vi.mock('../../src/tui/preview/BrowserLauncher.js', () => ({
  browserLauncher: {
    previewFile: mockPreviewFile,
    reopenLast: mockReopenLast,
  },
}));

vi.mock('../../src/tui/preview/AudioPlayer.js', () => ({
  audioPlayer: {
    play: mockAudioPlay,
    getWaveform: mockWaveform,
  },
}));

vi.mock('../../src/harness/index.js', () => ({
  createHarnessAgent: () => ({
    executeTask: mockHarnessExecuteTask,
  }),
  createLLMModeAgent: () => ({
    executeTask: mockAgentExecuteTask,
  }),
}));

import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import { Domain } from '../../src/types/domains.js';

describe('TuiBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a session with default chat mode', () => {
    const service = new TuiBridgeService();
    const status = service.createSession();

    expect(status.sessionId).toBeDefined();
    expect(status.mode).toBe('chat');
    expect(status.trust.level).toBe('untrusted');
  });

  it('creates a review-required action for action-like input', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    const result = await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Delete the file',
      clientIntent: 'action',
    });

    expect(result.reviewRequired).toBe(true);
    expect(service.getStatus(session.sessionId).pendingAction?.title).toContain('Delete');
  });

  it('emits active response events without committing until completion', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'Hello bridge',
      clientIntent: 'chat',
    });

    const events = service.getEvents(session.sessionId);
    expect(events.map(e => e.type)).toContain('response.started');
    expect(events.map(e => e.type)).toContain('response.delta');
    expect(events.map(e => e.type)).toContain('response.completed');
    expect(events.map(e => e.type)).toContain('response.committed');
  });

  it('confirms a pending action and clears it', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Run risky change',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id);

    expect(service.getStatus(session.sessionId).pendingAction).toBeUndefined();
    expect(service.getEvents(session.sessionId).map(e => e.type)).toContain('action.confirmed');
  });

  it('executes confirmed preview actions after approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const tempFile = path.join(os.tmpdir(), `tui-bridge-preview-${Date.now()}.ts`);
    await fs.writeFile(tempFile, 'const value = 1;\nconsole.log(value);\n', 'utf-8');

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: `/preview ${tempFile}`,
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id);

    const events = service.getEvents(session.sessionId);
    expect(mockPreviewRoute).toHaveBeenCalledWith(tempFile);
    expect(events.map(e => e.type)).toContain('preview.started');
    expect(events.map(e => e.type)).toContain('preview.completed');
  });

  it('executes confirmed browser actions after approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: '/browser test/preview.html',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id);

    expect(mockPreviewFile).toHaveBeenCalledWith('test/preview.html');
    expect(service.getEvents(session.sessionId).some(
      (event) => event.type === 'activity.updated' && event.message.includes('Opened in browser')
    )).toBe(true);
  });

  it('executes confirmed play actions after approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: '/play test/song.mp3',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id);

    expect(mockAudioPlay).toHaveBeenCalledWith('test/song.mp3');
    expect(service.getEvents(session.sessionId).some(
      (event) => event.type === 'preview.completed' && event.previewType === 'music'
    )).toBe(true);
  });

  it('executes confirmed agent actions after approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: '/agent fix this',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id, llm);

    expect(mockAgentExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
      description: 'fix this',
      approved: true,
      maxSteps: 15,
    }));
    expect(service.getEvents(session.sessionId).some(
      (event) => event.type === 'response.completed' && event.content.includes('Agent task SUCCESS')
    )).toBe(true);
  });

  it('executes confirmed run actions after approval', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: '/run M1',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    await service.confirmAction(session.sessionId, pending.id, llm);

    expect(mockHarnessExecuteTask).toHaveBeenCalledWith(expect.objectContaining({
      id: 'M1',
      approved: true,
    }));
    expect(service.getEvents(session.sessionId).some(
      (event) => event.type === 'response.completed' && event.content.includes('Task M1: SUCCESS')
    )).toBe(true);
  });

  it('cancels a pending action and clears it', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();

    await service.submitInput(session.sessionId, {
      mode: 'action',
      text: 'Run risky change',
      clientIntent: 'action',
    });

    const pending = service.getStatus(session.sessionId).pendingAction!;
    service.cancelAction(session.sessionId, pending.id);

    expect(service.getStatus(session.sessionId).pendingAction).toBeUndefined();
    expect(service.getEvents(session.sessionId).map(e => e.type)).toContain('action.cancelled');
  });

  it('routes three.js generation requests with three domain instead of p5', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'create a three.js particle scene',
      clientIntent: 'chat',
    }, llm);

    expect(mockRalphRun).toHaveBeenCalledWith(
      'create a three.js particle scene',
      expect.objectContaining({ collabDomain: Domain.THREE }),
    );
  });

  it('routes shader generation requests with shader domain instead of p5', async () => {
    const service = new TuiBridgeService();
    const session = service.createSession();
    const llm = { getConfig: () => ({ model: 'glm-5.1' }) } as any;

    await service.submitInput(session.sessionId, {
      mode: 'chat',
      text: 'generate a glsl shader with plasma noise',
      clientIntent: 'chat',
    }, llm);

    expect(mockRalphRun).toHaveBeenCalledWith(
      'generate a glsl shader with plasma noise',
      expect.objectContaining({ collabDomain: Domain.SHADER }),
    );
  });
});
