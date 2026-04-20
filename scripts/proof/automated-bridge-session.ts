#!/usr/bin/env tsx
/**
 * Automated Bubble Tea bridge session recorder.
 *
 * Spawns the bridge in --bridge-only mode, drives scripted interactions
 * via HTTP API, collects SSE events, and writes a Markdown transcript
 * to .omx/proof/tui-recordings/.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PROOF_DIR = path.join(ROOT, '.omx/proof/tui-recordings');
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3001);
const BRIDGE_BIN = 'node';
const BRIDGE_SCRIPT = path.join(ROOT, 'scripts/start-bubbletea-tui.mjs');
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 120_000);

interface SessionStatus {
  id: string;
  provider?: string;
  model?: string;
  [key: string]: unknown;
}

interface Step {
  label: string;
  input: string;
  waitMs: number;
}

const SCRIPTED_STEPS: Step[] = [
  { label: 'Status check', input: '/status', waitMs: 3_000 },
  { label: 'Creative prompt', input: 'Create a calming blue particle system with gentle drifting motion', waitMs: 15_000 },
  { label: 'Help command', input: '/help', waitMs: 3_000 },
  { label: 'Tasks list', input: '/tasks', waitMs: 3_000 },
];

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  process.stderr.write(`[${ts}] ${msg}\n`);
}

function httpPost(url: string, body: unknown): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(url: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data }));
    }).on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function waitForBridge(maxRetries = 20, intervalMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await httpGet(`http://127.0.0.1:${BRIDGE_PORT}/api/tui/session/nonexistent/status`);
      // 404 means the server is up but session doesn't exist — that's fine
      if (res.status === 404 || res.status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(intervalMs);
  }
  return false;
}

async function createSession(): Promise<SessionStatus> {
  const { status, data } = await httpPost(`http://127.0.0.1:${BRIDGE_PORT}/api/tui/session`, {});
  if (status !== 201) throw new Error(`Failed to create session: ${status} ${data}`);
  return JSON.parse(data);
}

async function collectSSE(sessionId: string, events: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${BRIDGE_PORT}/api/tui/session/${sessionId}/events`, (res) => {
      if (res.statusCode !== 200) {
        resolve();
        return;
      }
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            events.push(line.slice(6));
          }
        }
      });
      res.on('end', resolve);
      res.on('error', reject);
    }).on('error', resolve); // Don't fail on SSE errors
  });
}

async function submitInput(sessionId: string, text: string): Promise<unknown> {
  const { status, data } = await httpPost(
    `http://127.0.0.1:${BRIDGE_PORT}/api/tui/session/${sessionId}/input`,
    { text },
  );
  if (status !== 200) {
    log(`  Warning: input returned ${status}: ${data.slice(0, 200)}`);
    return null;
  }
  try { return JSON.parse(data); } catch { return data; }
}

function writeTranscript(
  session: SessionStatus,
  results: { step: Step; response: unknown; durationMs: number }[],
  events: string[],
  error?: string,
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `bridge-session-${timestamp}.md`;
  const filepath = path.join(PROOF_DIR, filename);

  const lines: string[] = [
    `# Automated Bridge Session Transcript`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**Session ID:** ${session.id}`,
    `**Provider:** ${session.provider || 'unknown'}`,
    `**Model:** ${session.model || 'unknown'}`,
    `**Bridge Port:** ${BRIDGE_PORT}`,
    error ? `**Error:** ${error}` : `**Status:** Complete`,
    ``,
    `## Scripted Steps`,
    ``,
  ];

  for (const { step, response, durationMs } of results) {
    lines.push(`### ${step.label}`);
    lines.push(`- **Input:** \`${step.input}\``);
    lines.push(`- **Wait:** ${step.waitMs}ms`);
    lines.push(`- **Duration:** ${durationMs}ms`);
    lines.push(`- **Response:**`);
    lines.push('```json');
    lines.push(JSON.stringify(response, null, 2).slice(0, 2000));
    lines.push('```');
    lines.push('');
  }

  lines.push('## SSE Events');
  lines.push('');
  lines.push(`Total events collected: ${events.length}`);
  lines.push('');
  const sampleEvents = events.slice(0, 50);
  for (const evt of sampleEvents) {
    try {
      const parsed = JSON.parse(evt);
      const type = parsed.type || parsed.event || 'unknown';
      const summary = typeof parsed.data === 'string'
        ? parsed.data.slice(0, 120)
        : JSON.stringify(parsed.data).slice(0, 120);
      lines.push(`- \`${type}\`: ${summary}`);
    } catch {
      lines.push(`- \`${evt.slice(0, 120)}\``);
    }
  }
  if (events.length > 50) {
    lines.push(`- ... and ${events.length - 50} more events`);
  }

  fs.writeFileSync(filepath, lines.join('\n'));
  log(`Transcript written to ${filepath}`);
  return filepath;
}

async function main() {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  log('Starting automated bridge session recorder');

  // 1. Build first
  log('Building project...');
  const build = spawn('pnpm', ['build'], { cwd: ROOT, stdio: 'pipe' });
  const buildResult = await new Promise<number>(r => build.on('exit', r));
  if (buildResult !== 0) {
    log('Build failed, aborting');
    process.exit(1);
  }
  log('Build succeeded');

  // 2. Spawn bridge in --bridge-only mode
  log(`Starting bridge on port ${BRIDGE_PORT}...`);
  const bridgeProc = spawn(BRIDGE_BIN, [BRIDGE_SCRIPT, '--bridge-only', `--port=${BRIDGE_PORT}`], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env, LIMINAL_BRIDGE_PORT: String(BRIDGE_PORT) },
  });

  bridgeProc.stderr?.on('data', (d: Buffer) => {
    for (const line of d.toString().split('\n')) {
      if (line.trim()) log(`[bridge] ${line.trim()}`);
    }
  });

  // Ensure cleanup
  const cleanup = () => {
    log('Cleaning up bridge process...');
    try { bridgeProc.kill('SIGTERM'); } catch { /* already dead */ }
    setTimeout(() => {
      try { bridgeProc.kill('SIGKILL'); } catch { /* */ }
      process.exit(0);
    }, 3000);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 3. Wait for bridge to be ready
  log('Waiting for bridge to start...');
  const bridgeReady = await waitForBridge();
  if (!bridgeReady) {
    log('Bridge did not start in time');
    cleanup();
    process.exit(1);
  }
  log('Bridge is ready');

  // 4. Create session
  let session: SessionStatus;
  try {
    session = await createSession();
    log(`Session created: ${session.id}`);
  } catch (err) {
    log(`Failed to create session: ${err}`);
    cleanup();
    process.exit(1);
  }

  // 5. Start SSE collection in background
  const sseEvents: string[] = [];
  const ssePromise = collectSSE(session.id, sseEvents);

  // 6. Drive scripted steps
  const results: { step: Step; response: unknown; durationMs: number }[] = [];
  const overallStart = Date.now();

  for (const step of SCRIPTED_STEPS) {
    if (Date.now() - overallStart > TIMEOUT_MS) {
      log(`Overall timeout reached (${TIMEOUT_MS}ms), stopping`);
      break;
    }

    log(`Step: ${step.label} — "${step.input}"`);
    const start = Date.now();

    let response: unknown;
    try {
      response = await submitInput(session.id, step.input);
    } catch (err) {
      response = { error: String(err) };
    }

    const durationMs = Date.now() - start;
    results.push({ step, response, durationMs });
    log(`  Done in ${durationMs}ms`);

    if (step.waitMs > 0) {
      log(`  Waiting ${step.waitMs}ms...`);
      await sleep(step.waitMs);
    }
  }

  // 7. Allow final SSE events to arrive
  await sleep(2_000);

  // 8. Write transcript
  const transcriptPath = writeTranscript(session, results, sseEvents);

  // 9. Summary
  const totalMs = Date.now() - overallStart;
  log(`Session complete in ${totalMs}ms`);
  log(`Steps: ${results.length}, SSE events: ${sseEvents.length}`);
  log(`Transcript: ${transcriptPath}`);

  cleanup();
}

main().catch((err) => {
  log(`Fatal error: ${err}`);
  process.exit(1);
});
