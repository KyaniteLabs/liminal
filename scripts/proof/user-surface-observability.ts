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
const outPath = path.join(outDir, 'user-surface-observability.json');
const prompt = 'Create a p5 sketch of fireflies orbiting a moonlit willow tree';

function startExpress(app: ReturnType<typeof createApp>): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve({ server, port: address.port });
      else reject(new Error('Failed to allocate GUI observability proof port'));
    });
    server.on('error', reject);
  });
}

async function closeServer(server?: Server): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function readSseEvents(
  url: string,
  expectedTypes: string[],
  headers: Record<string, string> = {},
): Promise<Array<{ id: number; event: TuiBridgeEvent }>> {
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

function eventOrder(events: Array<{ event: TuiBridgeEvent }>, types: string[]): boolean {
  let cursor = -1;
  for (const type of types) {
    const next = events.findIndex((item, index) => index > cursor && item.event.type === type);
    if (next === -1) return false;
    cursor = next;
  }
  return true;
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-surface-observability-'));
const oldConfigPath = process.env.LIMINAL_CONFIG_PATH;
let bridgeServer: TuiBridgeServer | undefined;
let guiServer: Server | undefined;

try {
  process.env.LIMINAL_CONFIG_PATH = path.join(tmpDir, 'config.json');
  const bridge = new TuiBridgeService();
  bridgeServer = new TuiBridgeServer(bridge, { port: 0, host: '127.0.0.1' });
  await bridgeServer.start();
  const bridgeUrl = bridgeServer.address;
  const gui = await startExpress(createApp(process.env.LIMINAL_CONFIG_PATH));
  guiServer = gui.server;
  const guiUrl = `http://127.0.0.1:${gui.port}`;

  const session = await (await fetch(`${bridgeUrl}/api/tui/session`, { method: 'POST' })).json() as { sessionId: string };
  const eventsUrl = `${bridgeUrl}/api/tui/session/${session.sessionId}/events`;

  const inputRes = await fetch(`${bridgeUrl}/api/tui/session/${session.sessionId}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'chat', text: prompt, clientIntent: 'creative' }),
  });
  const inputBody = await inputRes.json() as { reviewRequired?: boolean };
  const promptEvents = await readSseEvents(eventsUrl, ['response.started']);
  const lastPromptEventId = promptEvents.at(-1)?.id ?? 0;

  const code = 'function setup(){ createCanvas(120,80); } function draw(){ background(8,12,24); fill(255,230,120); circle(60,40,12); }';
  const artifactPath = path.join('.omx', 'proof', 'live-previews', 'observability-p5.html');
  const imagePath = path.join('.omx', 'proof', 'live-previews', 'observability-p5.png');

  bridge.publishEvent(session.sessionId, {
    type: 'generation.route.selected',
    domain: 'p5',
    domains: ['p5', 'three'],
    executionMode: 'draft',
    candidateCount: 1,
    timeoutMinutes: 1,
    startedAt: new Date().toISOString(),
  });
  bridge.publishEvent(session.sessionId, {
    type: 'generation.attempt.started',
    domain: 'p5',
    attempt: 1,
    attemptTotal: 2,
    executionMode: 'draft',
    candidateCount: 1,
    timeoutMinutes: 1,
    startedAt: new Date().toISOString(),
  });
  bridge.publishEvent(session.sessionId, {
    type: 'artifact.found',
    artifactLabel: 'p5 HTML preview',
    artifactPath,
  });
  bridge.publishEvent(session.sessionId, {
    type: 'preview.completed',
    previewType: 'code',
    content: code,
  });
  bridge.publishEvent(session.sessionId, {
    type: 'preview.verified',
    previewType: 'code',
    artifactPath,
    checks: ['bridge event stream replayed', 'GUI preview route served code'],
  });

  const expectedTypes = [
    'generation.route.selected',
    'generation.attempt.started',
    'artifact.found',
    'preview.completed',
    'preview.verified',
  ];
  const observabilityEvents = await readSseEvents(eventsUrl, expectedTypes, { 'Last-Event-ID': String(lastPromptEventId) });

  const previewRun = await fetch(`${guiUrl}/api/preview/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, version: 77 }),
  });
  const preview = await fetch(`${guiUrl}/preview?version=77`);
  const previewHtml = await preview.text();

  const checks = {
    submittedNaturalLanguagePrompt: inputRes.ok && inputBody.reviewRequired === false,
    routeToPreviewOrder: eventOrder(observabilityEvents, expectedTypes),
    routeSelected: observabilityEvents.some((item) => item.event.type === 'generation.route.selected' && item.event.domain === 'p5'),
    attemptStarted: observabilityEvents.some((item) => item.event.type === 'generation.attempt.started'),
    artifactFound: observabilityEvents.some((item) => item.event.type === 'artifact.found'),
    previewCompleted: observabilityEvents.some((item) => item.event.type === 'preview.completed'),
    previewVerified: observabilityEvents.some((item) => item.event.type === 'preview.verified'),
    guiPreviewRun: previewRun.ok,
    guiPreviewHtml: preview.ok && previewHtml.includes(code),
  };
  const passed = Object.values(checks).every(Boolean);
  const result = {
    generatedAt: new Date().toISOString(),
    proofMode: 'deterministic bridge event contract; no model call required',
    bridgeUrl,
    guiUrl,
    sessionId: session.sessionId,
    prompt,
    checks,
    events: observabilityEvents.map((item) => ({ id: item.id, type: item.event.type })),
    artifacts: { artifactPath, imagePath },
    passed,
  };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  if (!passed) {
    console.error(`User-surface observability proof failed: ${outPath}`);
    process.exit(1);
  }
  console.log(`User-surface observability proof written: ${outPath}`);
} finally {
  await bridgeServer?.stop().catch(() => undefined);
  await closeServer(guiServer);
  if (oldConfigPath === undefined) delete process.env.LIMINAL_CONFIG_PATH;
  else process.env.LIMINAL_CONFIG_PATH = oldConfigPath;
  await fs.rm(tmpDir, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
