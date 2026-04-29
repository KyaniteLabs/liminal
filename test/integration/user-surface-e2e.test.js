import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';

function startExpress(app) {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    server.on('error', reject);
  });
}

async function readSseUntil(url, predicate, headers = {}) {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream', ...headers } });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const started = Date.now();
  try {
    while (Date.now() - started <= 3000) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        if (predicate(block)) return block;
      }
    }
    throw new Error(`Timed out waiting for matching SSE block from ${url}`);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function eventId(block) {
  const match = block.match(/^id: (\d+)/m);
  return match ? Number(match[1]) : 0;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

describe('non-visual GUI/TUI surface E2E contract', () => {
  let bridgeServer;
  let bridgeUrl;
  let guiServer;
  let guiPort;
  let tmpDir;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-surfaces-e2e-'));
    process.env.LIMINAL_CONFIG_PATH = path.join(tmpDir, 'config.json');

    const bridge = new TuiBridgeService();
    bridgeServer = new TuiBridgeServer(bridge, { port: 0, host: '127.0.0.1' });
    await bridgeServer.start();
    bridgeUrl = bridgeServer.address;

    const { createApp } = await import('../../gui/server.js');
    const started = await startExpress(createApp(process.env.LIMINAL_CONFIG_PATH));
    guiServer = started.server;
    guiPort = started.port;
  }, 30_000);

  afterAll(async () => {
    await bridgeServer?.stop();
    await closeServer(guiServer);
    delete process.env.LIMINAL_CONFIG_PATH;
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('proves prompt streaming, stop, confirm/cancel, SSE replay, and GUI preview without screenshots', async () => {
    const sessionRes = await fetch(`${bridgeUrl}/api/tui/session`, { method: 'POST' });
    const session = await sessionRes.json();
    const eventsUrl = `${bridgeUrl}/api/tui/session/${session.sessionId}/events`;

    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'chat', text: 'hello bridge', clientIntent: 'chat' }),
    });
    const promptEvent = await readSseUntil(eventsUrl, (block) => block.includes('response.started'));
    expect(promptEvent).toContain('id: 1');
    expect(promptEvent).toContain('response.started');
    let lastEventId = eventId(promptEvent);

    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/cancel`, { method: 'POST' });
    const stopEvent = await readSseUntil(eventsUrl, (block) => block.includes('Generation stopped by operator'), { 'Last-Event-ID': String(lastEventId) });
    expect(stopEvent).toContain('Generation stopped by operator');
    lastEventId = eventId(stopEvent);

    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'action', text: 'Review this harmless action', clientIntent: 'action' }),
    });
    const reviewEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.review_required'), { 'Last-Event-ID': String(lastEventId) });
    expect(reviewEvent).toContain('action.review_required');
    lastEventId = eventId(reviewEvent);
    const statusAfterReview = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json();
    const cancelId = statusAfterReview.pendingAction.id;
    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${cancelId}/cancel`, { method: 'POST' });
    const cancelledEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.cancelled'), { 'Last-Event-ID': String(lastEventId) });
    expect(cancelledEvent).toContain('action.cancelled');
    lastEventId = eventId(cancelledEvent);

    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'action', text: 'Confirm this harmless action', clientIntent: 'action' }),
    });
    const statusBeforeConfirm = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json();
    const confirmId = statusBeforeConfirm.pendingAction.id;
    await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${confirmId}/confirm`, { method: 'POST' });
    const confirmedEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.confirmed'), { 'Last-Event-ID': String(lastEventId) });
    expect(confirmedEvent).toContain('action.confirmed');

    const code = 'function setup(){ createCanvas(120,80); } function draw(){ background(20); }';
    const previewRun = await fetch(`http://127.0.0.1:${guiPort}/api/preview/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, version: 42 }),
    });
    expect(previewRun.status).toBe(200);
    const previewRes = await fetch(`http://127.0.0.1:${guiPort}/preview?version=42`);
    const previewHtml = await previewRes.text();
    expect(previewRes.status).toBe(200);
    expect(previewHtml).toContain(code);
    expect(previewRes.headers.get('Content-Security-Policy')).toContain("connect-src 'none'");
  });
});
