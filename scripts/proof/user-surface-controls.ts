#!/usr/bin/env tsx
import { createServer, type Server } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../gui/server.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import type { TuiBridgeEvent } from '../../src/tui-bridge/types.js';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'user-surface-controls.json');

function startExpress(app: ReturnType<typeof createApp>): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve({ server, port: address.port });
      else reject(new Error('Failed to allocate GUI controls proof port'));
    });
    server.on('error', reject);
  });
}

async function closeServer(server?: Server): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function readSseEvents(url: string, expectedTypes: string[], headers: Record<string, string> = {}): Promise<Array<{ id: number; event: TuiBridgeEvent }>> {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream', ...headers } });
  if (!res.body) throw new Error(`No SSE body from ${url}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: Array<{ id: number; event: TuiBridgeEvent }> = [];
  let buffer = '';
  const started = Date.now();
  try {
    while (Date.now() - started <= 5_000) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const id = Number(block.match(/^id: (\d+)/m)?.[1] || 0);
        const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
        if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6)) as TuiBridgeEvent;
        events.push({ id, event });
        const seenTypes = new Set(events.map((item) => item.event.type));
        if (expectedTypes.every((type) => seenTypes.has(type))) return events;
      }
    }
    throw new Error(`Timed out waiting for ${expectedTypes.join(', ')} from ${url}`);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sinter-user-surface-controls-'));
const oldConfigPath = process.env.LIMINAL_CONFIG_PATH;
const oldRuntimeEnv = {
  LIMINAL_LLM_PROVIDER: process.env.LIMINAL_LLM_PROVIDER,
  LIMINAL_LLM_BASE_URL: process.env.LIMINAL_LLM_BASE_URL,
  LIMINAL_LLM_MODEL: process.env.LIMINAL_LLM_MODEL,
  LIMINAL_HARNESS_BASE_URL: process.env.LIMINAL_HARNESS_BASE_URL,
  LIMINAL_HARNESS_MODEL: process.env.LIMINAL_HARNESS_MODEL,
  LIMINAL_EVALUATOR_BASE_URL: process.env.LIMINAL_EVALUATOR_BASE_URL,
  LIMINAL_EVALUATOR_MODEL: process.env.LIMINAL_EVALUATOR_MODEL,
};
let bridgeServer: TuiBridgeServer | undefined;
let guiServer: Server | undefined;

try {
  process.env.LIMINAL_CONFIG_PATH = path.join(tmpDir, 'config.json');
  process.env.LIMINAL_LLM_PROVIDER = 'glm';
  process.env.LIMINAL_LLM_BASE_URL = 'https://api.z.ai/api/anthropic';
  process.env.LIMINAL_LLM_MODEL = 'GLM-5v-turbo';
  process.env.LIMINAL_HARNESS_BASE_URL = 'https://api.openai.com/v1';
  process.env.LIMINAL_HARNESS_MODEL = 'gpt-5.4';
  process.env.LIMINAL_EVALUATOR_BASE_URL = 'https://openrouter.ai/api/v1';
  process.env.LIMINAL_EVALUATOR_MODEL = 'google/gemini-2.5-flash';
  const bridge = new TuiBridgeService();
  bridgeServer = new TuiBridgeServer(bridge, { port: 0, host: '127.0.0.1' });
  await bridgeServer.start();
  const bridgeUrl = bridgeServer.address;
  const gui = await startExpress(createApp(process.env.LIMINAL_CONFIG_PATH));
  guiServer = gui.server;
  const guiUrl = `http://127.0.0.1:${gui.port}`;

  const session = await (await fetch(`${bridgeUrl}/api/tui/session`, { method: 'POST' })).json() as {
    sessionId: string;
    roles?: Record<string, { provider?: string; model?: string }>;
  };
  const eventsUrl = `${bridgeUrl}/api/tui/session/${session.sessionId}/events`;

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/cancel`, { method: 'POST' });
  const stopEvents = await readSseEvents(eventsUrl, ['generation.cancelled', 'status.updated']);
  let lastEventId = stopEvents.at(-1)?.id ?? 0;

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'action', text: 'Review harmless action', clientIntent: 'action' }),
  });
  const reviewEvents = await readSseEvents(eventsUrl, ['action.review_required'], { 'Last-Event-ID': String(lastEventId) });
  lastEventId = reviewEvents.at(-1)?.id ?? lastEventId;
  const statusAfterReview = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json() as { pendingAction?: { id: string } };
  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${statusAfterReview.pendingAction?.id}/cancel`, { method: 'POST' });
  const actionCancelEvents = await readSseEvents(eventsUrl, ['action.cancelled', 'status.updated'], { 'Last-Event-ID': String(lastEventId) });
  lastEventId = actionCancelEvents.at(-1)?.id ?? lastEventId;

  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'action', text: 'Confirm harmless action', clientIntent: 'action' }),
  });
  const statusBeforeConfirm = await (await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/status`)).json() as { pendingAction?: { id: string } };
  await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/actions/${statusBeforeConfirm.pendingAction?.id}/confirm`, { method: 'POST' });
  const actionConfirmEvents = await readSseEvents(eventsUrl, ['action.confirmed', 'status.updated'], { 'Last-Event-ID': String(lastEventId) });

  bridge.publishEvent(session.sessionId, {
    type: 'preview.missing',
    previewType: 'image',
    artifactPath: '.omx/proof/live-previews/missing.html',
    reason: 'deterministic missing preview check',
  });
  const missingPreviewEvents = await readSseEvents(eventsUrl, ['preview.missing'], { 'Last-Event-ID': String(actionConfirmEvents.at(-1)?.id ?? lastEventId) });

  const code = 'function setup(){ createCanvas(120,80); } function draw(){ background(20); }';
  const previewRun = await fetch(`${guiUrl}/api/preview/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, version: 88 }),
  });
  const preview = await fetch(`${guiUrl}/preview?version=88`);
  const previewHtml = await preview.text();

  const eventTypes = [...stopEvents, ...reviewEvents, ...actionCancelEvents, ...actionConfirmEvents, ...missingPreviewEvents].map((item) => item.event.type);
  const checks = {
    roles: session.roles?.generator?.model === 'GLM-5v-turbo' &&
      session.roles?.harness?.model === 'gpt-5.4' &&
      session.roles?.evaluator?.model === 'google/gemini-2.5-flash',
    stop: eventTypes.includes('generation.cancelled'),
    reviewRequired: eventTypes.includes('action.review_required'),
    actionCancelled: eventTypes.includes('action.cancelled'),
    actionConfirmed: eventTypes.includes('action.confirmed'),
    statusClearsPending: [...actionCancelEvents, ...actionConfirmEvents].some((item) => item.event.type === 'status.updated' && (item.event as any).status?.pendingAction === undefined),
    missingPreview: eventTypes.includes('preview.missing'),
    guiPreviewRun: previewRun.ok,
    guiPreviewHtml: preview.ok && previewHtml.includes(code),
  };
  const passed = Object.values(checks).every(Boolean);
  const result = {
    generatedAt: new Date().toISOString(),
    proofMode: 'deterministic user-surface controls contract; no model call required',
    bridgeUrl,
    guiUrl,
    sessionId: session.sessionId,
    roles: session.roles,
    checks,
    events: eventTypes,
    passed,
  };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  if (!passed) {
    console.error(`User-surface controls proof failed: ${outPath}`);
    process.exit(1);
  }
  console.log(`User-surface controls proof written: ${outPath}`);
} finally {
  await bridgeServer?.stop().catch(() => undefined);
  await closeServer(guiServer);
  if (oldConfigPath === undefined) delete process.env.LIMINAL_CONFIG_PATH;
  else process.env.LIMINAL_CONFIG_PATH = oldConfigPath;
  for (const [key, value] of Object.entries(oldRuntimeEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
