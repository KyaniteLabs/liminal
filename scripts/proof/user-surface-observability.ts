#!/usr/bin/env tsx
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../gui/server.js';
import { LLMClient } from '../../src/llm/LLMClient.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import type { TuiBridgeEvent } from '../../src/tui-bridge/types.js';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'user-surface-observability.json');
const prompt = 'Create a Tone.js browser synth drone with a visible start button';
const proofModelName = 'liminal-observability-proof-model';
const proofToneHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Tone.js Patch</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
</head>
<body>
<button id="start">Start proof drone</button>
<script>
const synth = new Tone.Synth().toDestination();
Tone.Transport.bpm.value = 92;
document.getElementById('start').addEventListener('click', async () => {
  await Tone.start();
  synth.triggerAttackRelease('C4', '8n');
  Tone.Transport.start();
});
</script>
</body>
</html>`;

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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function startProofModel(): Promise<{ server: Server; port: number; baseUrl: string; requests: unknown[] }> {
  const requests: unknown[] = [];
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void (async () => {
        if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
          writeJson(res, 404, { error: 'not found' });
          return;
        }

        requests.push(await readJsonBody(req));
        writeJson(res, 200, {
          id: 'chatcmpl-liminal-observability-proof',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: proofModelName,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: proofToneHtml },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 12, completion_tokens: 64, total_tokens: 76 },
        });
      })().catch((err) => {
        writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({
          server,
          port: address.port,
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          requests,
        });
      } else {
        reject(new Error('Failed to allocate proof model port'));
      }
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
    while (Date.now() - started <= 15_000) {
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
const oldEnv = {
  configPath: process.env.LIMINAL_CONFIG_PATH,
  llmBaseUrl: process.env.LIMINAL_LLM_BASE_URL,
  llmModel: process.env.LIMINAL_LLM_MODEL,
  llmApiKey: process.env.LIMINAL_LLM_API_KEY,
};
let bridgeServer: TuiBridgeServer | undefined;
let guiServer: Server | undefined;
let proofModel: Awaited<ReturnType<typeof startProofModel>> | undefined;

try {
  proofModel = await startProofModel();
  process.env.LIMINAL_CONFIG_PATH = path.join(tmpDir, 'config.json');
  process.env.LIMINAL_LLM_BASE_URL = proofModel.baseUrl;
  process.env.LIMINAL_LLM_MODEL = proofModelName;
  process.env.LIMINAL_LLM_API_KEY = 'liminal-local-proof-key';

  const bridge = new TuiBridgeService();
  const llm = new LLMClient({
    baseUrl: proofModel.baseUrl,
    model: proofModelName,
    apiKey: 'liminal-local-proof-key',
  });
  bridgeServer = new TuiBridgeServer(bridge, { port: 0, host: '127.0.0.1', llm });
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
    body: JSON.stringify({ mode: 'chat', text: prompt, clientIntent: 'creative', executionMode: 'draft', timeoutMinutes: 1 }),
  });
  const inputBody = await inputRes.json() as { reviewRequired?: boolean };
  const promptEvents = await readSseEvents(eventsUrl, ['response.started']);
  const lastPromptEventId = promptEvents.at(-1)?.id ?? 0;

  const expectedTypes = [
    'generation.route.selected',
    'generation.attempt.started',
    'generation.complete',
    'artifact.found',
    'preview.completed',
    'preview.verified',
    'session.turn',
  ];
  const observabilityEvents = await readSseEvents(eventsUrl, expectedTypes, { 'Last-Event-ID': String(lastPromptEventId) });

  const previewRun = await fetch(`${guiUrl}/api/preview/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: proofToneHtml, version: 77 }),
  });
  const preview = await fetch(`${guiUrl}/preview?version=77`);
  const previewHtml = await preview.text();
  const artifactEvent = observabilityEvents.find((item) => item.event.type === 'artifact.found');
  const artifactPath = artifactEvent?.event.type === 'artifact.found' ? artifactEvent.event.artifactPath : undefined;

  const checks = {
    submittedNaturalLanguagePrompt: inputRes.ok && inputBody.reviewRequired === false,
    proofModelCalled: proofModel.requests.length > 0,
    routeToPreviewOrder: eventOrder(observabilityEvents, expectedTypes),
    routeSelected: observabilityEvents.some((item) => item.event.type === 'generation.route.selected' && item.event.domain === 'tone'),
    attemptStarted: observabilityEvents.some((item) => item.event.type === 'generation.attempt.started' && item.event.domain === 'tone'),
    generationComplete: observabilityEvents.some((item) => item.event.type === 'generation.complete' && item.event.executionMode === 'draft'),
    artifactFound: Boolean(artifactPath),
    previewCompleted: observabilityEvents.some((item) => item.event.type === 'preview.completed' && item.event.previewType === 'music'),
    previewVerified: observabilityEvents.some((item) => item.event.type === 'preview.verified' && item.event.previewType === 'music'),
    sessionTurnRecorded: observabilityEvents.some((item) => item.event.type === 'session.turn' && item.event.delegatedTo === 'draft-generator'),
    guiPreviewRun: previewRun.ok,
    guiPreviewHtml: preview.ok && previewHtml.includes('Start proof drone'),
  };
  const passed = Object.values(checks).every(Boolean);
  const result = {
    generatedAt: new Date().toISOString(),
    proofMode: 'runtime draft generation path with local OpenAI-compatible proof model',
    bridgeUrl,
    guiUrl,
    proofModelBaseUrl: proofModel.baseUrl,
    proofModelRequestCount: proofModel.requests.length,
    sessionId: session.sessionId,
    prompt,
    checks,
    events: observabilityEvents.map((item) => ({
      id: item.id,
      type: item.event.type,
      domain: 'domain' in item.event ? item.event.domain : undefined,
      previewType: 'previewType' in item.event ? item.event.previewType : undefined,
    })),
    artifacts: { artifactPath },
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
  await closeServer(proofModel?.server);
  if (oldEnv.configPath === undefined) delete process.env.LIMINAL_CONFIG_PATH;
  else process.env.LIMINAL_CONFIG_PATH = oldEnv.configPath;
  if (oldEnv.llmBaseUrl === undefined) delete process.env.LIMINAL_LLM_BASE_URL;
  else process.env.LIMINAL_LLM_BASE_URL = oldEnv.llmBaseUrl;
  if (oldEnv.llmModel === undefined) delete process.env.LIMINAL_LLM_MODEL;
  else process.env.LIMINAL_LLM_MODEL = oldEnv.llmModel;
  if (oldEnv.llmApiKey === undefined) delete process.env.LIMINAL_LLM_API_KEY;
  else process.env.LIMINAL_LLM_API_KEY = oldEnv.llmApiKey;
  await fs.rm(tmpDir, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
