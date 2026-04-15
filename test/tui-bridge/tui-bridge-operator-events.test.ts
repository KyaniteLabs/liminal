import { beforeEach, describe, expect, it } from 'vitest';
import { createServer as createNetServer } from 'node:net';
import http from 'node:http';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate port'));
        return;
      }
      const { port } = address;
      server.close((err) => err ? reject(err) : resolve(port));
    });
    server.on('error', reject);
  });
}

async function readSSEEventsOverHttp(
  port: number,
  sessionId: string,
  expectedCount: number,
  headers: Record<string, string> = {},
): Promise<Record<string, unknown>[]> {
  return await new Promise((resolve, reject) => {
    const events: Record<string, unknown>[] = [];
    let buffer = '';

    const req = http.request({
      host: '127.0.0.1',
      port,
      path: `/api/tui/session/${sessionId}/events`,
      method: 'GET',
      headers: { Accept: 'text/event-stream', ...headers },
    });

    req.on('response', (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        while (buffer.includes('\n\n')) {
          const idx = buffer.indexOf('\n\n');
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = raw.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          events.push(JSON.parse(dataLine.slice(6)) as Record<string, unknown>);
          if (events.length >= expectedCount) {
            req.destroy();
            res.destroy();
            resolve(events);
            return;
          }
        }
      });
      res.on('error', reject);
      res.on('end', () => {
        if (events.length < expectedCount) {
          reject(new Error(`stream ended after ${events.length} events`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('TuiBridge operator events', () => {
  let service: TuiBridgeService;

  beforeEach(() => {
    service = new TuiBridgeService();
  });

  it('publishes typed operator events into the session event stream', () => {
    const session = service.createSession();

    service.publishEvent(session.sessionId, {
      type: 'phase.changed',
      phase: 'Edit',
      stepCurrent: 2,
      stepTotal: 5,
      activeFile: 'src/auth.ts',
      objective: 'Patch auth flow',
    });
    service.publishEvent(session.sessionId, {
      type: 'tool.started',
      toolName: 'editFile',
      thought: 'Apply minimal auth patch',
      argsSummary: 'src/auth.ts',
      stepNum: 2,
    });
    service.publishEvent(session.sessionId, {
      type: 'files.changed',
      files: [{ path: 'src/auth.ts', status: 'modified', isLatest: true }],
    });
    service.publishEvent(session.sessionId, {
      type: 'verification.completed',
      command: 'vitest auth',
      success: true,
      outputTail: '1 passed',
      jobId: 'verify-1',
      duration: 1400,
    });
    service.publishEvent(session.sessionId, {
      type: 'artifact.found',
      artifactLabel: 'Transcript',
      artifactPath: '.omx/logs/auth.md',
    });

    const events = service.getEvents(session.sessionId);
    expect(events.map((event) => event.type)).toEqual([
      'phase.changed',
      'tool.started',
      'files.changed',
      'verification.completed',
      'artifact.found',
    ]);
    expect(events[0]).toMatchObject({
      sessionId: session.sessionId,
      type: 'phase.changed',
      phase: 'Edit',
      stepCurrent: 2,
      stepTotal: 5,
    });
    expect(events[1]).toMatchObject({
      sessionId: session.sessionId,
      type: 'tool.started',
      toolName: 'editFile',
      stepNum: 2,
    });
    expect(events[2]).toMatchObject({
      sessionId: session.sessionId,
      type: 'files.changed',
      files: [{ path: 'src/auth.ts', status: 'modified', isLatest: true }],
    });
    expect(events[3]).toMatchObject({
      sessionId: session.sessionId,
      type: 'verification.completed',
      command: 'vitest auth',
      success: true,
      jobId: 'verify-1',
    });
    expect(events[4]).toMatchObject({
      sessionId: session.sessionId,
      type: 'artifact.found',
      artifactLabel: 'Transcript',
      artifactPath: '.omx/logs/auth.md',
    });
  });

  it('streams operator events over the real SSE bridge endpoint', async () => {
    const port = await getFreePort();
    const server = new TuiBridgeServer(service, { host: '127.0.0.1', port });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      service.publishEvent(session.sessionId, {
        type: 'tool.started',
        toolName: 'readFile',
        thought: 'Inspect current auth flow',
        argsSummary: 'src/auth.ts',
        stepNum: 1,
      });
      service.publishEvent(session.sessionId, {
        type: 'verification.started',
        command: 'go test ./internal/app',
        jobId: 'job-7',
      });
      service.publishEvent(session.sessionId, {
        type: 'artifact.found',
        artifactLabel: 'Transcript',
        artifactPath: '.omx/logs/session.log',
      });

      const events = await readSSEEventsOverHttp(port, session.sessionId, 3);
      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({
        sessionId: session.sessionId,
        type: 'tool.started',
        toolName: 'readFile',
        stepNum: 1,
      });
      expect(events[1]).toMatchObject({
        sessionId: session.sessionId,
        type: 'verification.started',
        command: 'go test ./internal/app',
        jobId: 'job-7',
      });
      expect(events[2]).toMatchObject({
        sessionId: session.sessionId,
        type: 'artifact.found',
        artifactLabel: 'Transcript',
      });
    } finally {
      await server.stop();
    }
  }, 10000);

  it('reconnects without replaying events older than Last-Event-ID', async () => {
    const port = await getFreePort();
    const server = new TuiBridgeServer(service, { host: '127.0.0.1', port });
    await server.start();

    try {
      const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
      const session = await createRes.json() as { sessionId: string };

      service.publishEvent(session.sessionId, {
        type: 'tool.started',
        toolName: 'readFile',
        thought: 'first',
        argsSummary: 'a.ts',
        stepNum: 1,
      });
      service.publishEvent(session.sessionId, {
        type: 'artifact.found',
        artifactLabel: 'Transcript',
        artifactPath: '.omx/logs/one.log',
      });

      const initial = await readSSEEventsOverHttp(port, session.sessionId, 2);
      expect(initial).toHaveLength(2);

      service.publishEvent(session.sessionId, {
        type: 'verification.completed',
        command: 'npm run build',
        success: true,
        outputTail: 'ok',
        jobId: 'job-9',
        duration: 1200,
      });

      const resumed = await readSSEEventsOverHttp(port, session.sessionId, 1, { 'Last-Event-ID': '2' });
      expect(resumed).toHaveLength(1);
      expect(resumed[0]).toMatchObject({
        type: 'verification.completed',
        command: 'npm run build',
        jobId: 'job-9',
      });
    } finally {
      await server.stop();
    }
  }, 10000);
});
