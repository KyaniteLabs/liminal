#!/usr/bin/env tsx
import { createServer, type Server } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../gui/server.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'user-surfaces-e2e.json');

function startExpress(app: ReturnType<typeof createApp>): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve({ server, port: address.port });
      else reject(new Error('Failed to allocate GUI proof port'));
    });
    server.on('error', reject);
  });
}

async function closeServer(server?: Server): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function readSseUntil(url: string, predicate: (block: string) => boolean, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream', ...headers } });
  if (!res.body) throw new Error(`No SSE body from ${url}`);
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
    await reader.cancel().catch(() => undefined);
  }
}

function eventId(block: string): number {
  const match = block.match(/^id: (\d+)/m);
  return match ? Number(match[1]) : 0;
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-user-surfaces-proof-'));
const oldConfigPath = process.env.LIMINAL_CONFIG_PATH;
let bridgeServer: TuiBridgeServer | undefined;
let guiServer: Server | undefined;

try {
  process.env.LIMINAL_CONFIG_PATH = path.join(tmpDir, 'config.json');
  bridgeServer = new TuiBridgeServer(new TuiBridgeService(), { port: 0, host: '127.0.0.1' });
  await bridgeServer.start();
  const bridgeUrl = bridgeServer.address;
  const gui = await startExpress(createApp(process.env.LIMINAL_CONFIG_PATH));
  guiServer = gui.server;
  const guiUrl = `http://127.0.0.1:${gui.port}`;

  const session = await (await fetch(`${bridgeUrl}/api/tui/session`, { method: 'POST' })).json() as { sessionId: string };
  const eventsUrl = `${bridgeUrl}/api/tui/session/${session.sessionId}/events`;

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'chat', text: 'hello bridge', clientIntent: 'chat' }),
  });
  const promptEvent = await readSseUntil(eventsUrl, (block) => block.includes('response.started'));
  let lastEventId = eventId(promptEvent);

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/cancel`, { method: 'POST' });
  const stopEvent = await readSseUntil(eventsUrl, (block) => block.includes('Generation stopped by operator'), { 'Last-Event-ID': String(lastEventId) });
  lastEventId = eventId(stopEvent);

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'action', text: 'Review harmless action', clientIntent: 'action' }),
  });
  const reviewEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.review_required'), { 'Last-Event-ID': String(lastEventId) });
  lastEventId = eventId(reviewEvent);
  const statusAfterReview = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json() as { pendingAction: { id: string } };
  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${statusAfterReview.pendingAction.id}/cancel`, { method: 'POST' });
  const cancelEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.cancelled'), { 'Last-Event-ID': String(lastEventId) });
  lastEventId = eventId(cancelEvent);

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'action', text: 'Confirm harmless action', clientIntent: 'action' }),
  });
  const statusBeforeConfirm = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json() as { pendingAction: { id: string } };
  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${statusBeforeConfirm.pendingAction.id}/confirm`, { method: 'POST' });
  const confirmEvent = await readSseUntil(eventsUrl, (block) => block.includes('action.confirmed'), { 'Last-Event-ID': String(lastEventId) });

  const code = 'function setup(){ createCanvas(120,80); } function draw(){ background(20); }';
  const previewRun = await fetch(`${guiUrl}/api/preview/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, version: 42 }),
  });
  const preview = await fetch(`${guiUrl}/preview?version=42`);
  const previewHtml = await preview.text();

  const checks = {
    promptStream: promptEvent.includes('response.started'),
    stop: stopEvent.includes('Generation stopped by operator'),
    review: reviewEvent.includes('action.review_required'),
    cancel: cancelEvent.includes('action.cancelled'),
    confirm: confirmEvent.includes('action.confirmed'),
    previewRun: previewRun.ok,
    previewHtml: preview.ok && previewHtml.includes(code),
    previewCsp: (preview.headers.get('Content-Security-Policy') || '').includes("connect-src 'none'"),
  };
  const passed = Object.values(checks).every(Boolean);
  const result = {
    generatedAt: new Date().toISOString(),
    bridgeUrl,
    guiUrl,
    sessionId: session.sessionId,
    checks,
    samples: { promptEvent, stopEvent, reviewEvent, cancelEvent, confirmEvent },
    passed,
  };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  if (!passed) {
    console.error(`User-surface proof failed: ${outPath}`);
    process.exit(1);
  }
  console.log(`User-surface proof written: ${outPath}`);
} finally {
  await bridgeServer?.stop().catch(() => undefined);
  await closeServer(guiServer);
  if (oldConfigPath === undefined) delete process.env.LIMINAL_CONFIG_PATH;
  else process.env.LIMINAL_CONFIG_PATH = oldConfigPath;
  await fs.rm(tmpDir, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
