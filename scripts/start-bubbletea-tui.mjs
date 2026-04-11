#!/usr/bin/env node
/** Start the Bubble Tea TUI with a GLM-backed bridge. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMClient } from '../dist/llm/LLMClient.js';
import { TuiBridgeServer } from '../dist/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../dist/tui-bridge/TuiBridgeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bridgeOnly = process.argv.includes('--bridge-only');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || process.env.LIMINAL_BRIDGE_PORT || 3000);

function loadGlmConfig() {
  const configPath = path.join(process.env.HOME || '', '.liminal', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const glm = config.providers?.glm;
  if (!glm?.apiKey) throw new Error('Missing providers.glm.apiKey in ~/.liminal/config.json');
  return {
    baseUrl: glm.baseUrl || 'https://api.z.ai/api/coding/paas/v4',
    model: glm.model || 'glm-5.1',
    apiKey: glm.apiKey,
  };
}

const glm = loadGlmConfig();
for (const [key, value] of Object.entries({
  GLM_API_KEY: glm.apiKey,
  LLM_PROVIDER: 'glm',
  LLM_BASE_URL: glm.baseUrl,
  LLM_MODEL: glm.model,
  LLM_API_KEY: glm.apiKey,
  HARNESS_BASE_URL: glm.baseUrl,
  HARNESS_MODEL: glm.model,
  HARNESS_API_KEY: glm.apiKey,
  EVALUATOR_BASE_URL: glm.baseUrl,
  EVALUATOR_MODEL: glm.model,
  EVALUATOR_API_KEY: glm.apiKey,
  LIMINAL_LLM_PROVIDER: 'glm',
  LIMINAL_LLM_BASE_URL: glm.baseUrl,
  LIMINAL_LLM_MODEL: glm.model,
  LIMINAL_LLM_API_KEY: glm.apiKey,
  LIMINAL_HARNESS_BASE_URL: glm.baseUrl,
  LIMINAL_HARNESS_MODEL: glm.model,
  LIMINAL_HARNESS_API_KEY: glm.apiKey,
  LIMINAL_EVALUATOR_BASE_URL: glm.baseUrl,
  LIMINAL_EVALUATOR_MODEL: glm.model,
  LIMINAL_EVALUATOR_API_KEY: glm.apiKey,
})) {
  process.env[key] = value;
}

const llm = new LLMClient({
  role: 'harness',
  baseUrl: glm.baseUrl,
  model: glm.model,
  apiKey: glm.apiKey,
  temperature: 0.5,
  maxTokens: 4096,
});

const bridge = new TuiBridgeService();
const server = new TuiBridgeServer(bridge, { port, host: 'localhost', llm });
await server.start();
console.log(`Bubble Tea bridge: ${server.address}`);
console.log(`Harness provider/model: glm/${glm.model}`);

let child;
if (!bridgeOnly) {
  const binary = path.join(ROOT, 'bubbletea', 'liminal-tui');
  const env = { ...process.env, LIMINAL_BRIDGE_URL: server.address };
  if (fs.existsSync(binary)) {
    child = spawn(binary, { cwd: path.join(ROOT, 'bubbletea'), env, stdio: 'inherit' });
  } else {
    child = spawn('go', ['run', '.'], { cwd: path.join(ROOT, 'bubbletea'), env, stdio: 'inherit' });
  }
  child.on('exit', async (code) => {
    await server.stop().catch(() => {});
    process.exit(code ?? 0);
  });
}

async function shutdown() {
  if (child && !child.killed) child.kill('SIGTERM');
  await server.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
