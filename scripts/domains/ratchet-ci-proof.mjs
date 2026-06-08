#!/usr/bin/env node
import { createServer } from 'node:http';

import { runCli } from './gauntlet.mjs';

const PROOF_MODEL = 'sinter-domain-ratchet-proof-model';
const ENV_KEYS = [
  'LIMINAL_LLM_PROVIDER',
  'LIMINAL_LLM_BASE_URL',
  'LIMINAL_LLM_MODEL',
  'LIMINAL_LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_MODEL',
  'LLM_API_KEY',
];

const p5Proof = `let t = 0;
function setup() {
  createCanvas(640, 420);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
}
function draw() {
  background(210, 28, 14);
  t += 0.02;
  for (let i = 0; i < 28; i++) {
    const a = t + i * 0.42;
    fill((i * 18 + frameCount) % 360, 78, 96, 82);
    circle(width / 2 + cos(a) * (90 + i * 4), height / 2 + sin(a * 1.4) * 120, 24 + (i % 5) * 6);
  }
  fill(48, 80, 98);
  textSize(24);
  text('ratchet proof p5 frame ' + frameCount, 24, 42);
}`;

const revideoProof = `import { makeScene2D, Txt, Rect, Circle } from "@revideo/2d";
import { createRef, waitFor, all } from "@revideo/core";

export default makeScene2D("RatchetProofScene", function* (view) {
  const title = createRef<Txt>();
  const pulse = createRef<Circle>();
  view.add(
    <Rect width={1920} height={1080} fill={"#07111f"}>
      <Circle ref={pulse} width={220} height={220} fill={"#ffd166"} x={-360} />
      <Txt ref={title} text={"Domain ratchet proof"} fill={"#f8fafc"} fontSize={82} y={220} />
    </Rect>
  );
  yield* all(
    title().opacity(1, 0.6),
    pulse().scale(1.35, 0.8),
  );
  yield* waitFor(0.7);
  yield* pulse().x(360, 0.8);
});`;

const asciiProof = String.raw`
        /\        /\        /\
       /  \______/  \______/  \
      /  #   #   #   #   #    \
     /__________________________\
     |  R A T C H E T   P A S S |
     |  @@@  ###  ***  +++  === |
     |__|||__|||__|||__|||__|||_|
`;

const textgenProof = `
T
          H R
         E S H
        O L D
       M A C H I N E
      learns its name
     by counting the doors
    it refuses to fake.

ratchet proof textgen output stays raw, multi-line, and long enough to validate.
`;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function promptFromBody(body) {
  if (!Array.isArray(body?.messages)) return JSON.stringify(body ?? {});
  return body.messages
    .map((message) => typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? ''))
    .join('\n');
}

function contentForPrompt(prompt) {
  if (/target creative domain:\s*revideo\b|generate revideo code|@revideo/i.test(prompt)) return revideoProof;
  if (/target creative domain:\s*ascii\b|ascii art/i.test(prompt)) return asciiProof;
  if (/target creative domain:\s*textgen\b|concrete[- ]poetry/i.test(prompt)) return textgenProof;
  if (/target creative domain:\s*p5\b|p5\.js/i.test(prompt)) return p5Proof;
  return 'ratchet proof model intentionally returns only locked-domain artifacts';
}

function startProofModel() {
  const requests = [];
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const server = createServer((req, res) => {
      void (async () => {
        if (req.method === 'GET' && (req.url === '/v1/models' || req.url === '/models')) {
          writeJson(res, 200, { object: 'list', data: [{ id: PROOF_MODEL, object: 'model' }] });
          return;
        }
        if (req.method !== 'POST' || (req.url !== '/v1/chat/completions' && req.url !== '/chat/completions')) {
          writeJson(res, 404, { error: 'not found' });
          return;
        }

        const body = await readJsonBody(req);
        requests.push(body);
        const content = contentForPrompt(promptFromBody(body));
        writeJson(res, 200, {
          id: `chatcmpl-domain-ratchet-${requests.length}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: PROOF_MODEL,
          choices: [{
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 32, completion_tokens: 256, total_tokens: 288 },
        });
      })().catch((error) => {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to allocate domain ratchet proof model port'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        requests,
        close: () => new Promise((closeResolve) => {
          const timer = setTimeout(closeResolve, 250);
          server.close(() => {
            clearTimeout(timer);
            closeResolve();
          });
          server.closeIdleConnections?.();
          server.closeAllConnections?.();
          for (const socket of sockets) socket.destroy();
        }),
      });
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.on('error', reject);
  });
}

async function main() {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const proof = await startProofModel();
  try {
    process.env.LIMINAL_LLM_PROVIDER = 'openai';
    process.env.LIMINAL_LLM_BASE_URL = proof.baseUrl;
    process.env.LIMINAL_LLM_MODEL = PROOF_MODEL;
    process.env.LIMINAL_LLM_API_KEY = 'sinter-domain-ratchet-proof-key';
    process.env.LLM_BASE_URL = proof.baseUrl;
    process.env.LLM_MODEL = PROOF_MODEL;
    process.env.LLM_API_KEY = 'sinter-domain-ratchet-proof-key';
    const exitCode = await runCli(['--all', '--ratchet']);
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await proof.close();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

main().then(() => {
  process.exit(process.exitCode ?? 0);
}).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
