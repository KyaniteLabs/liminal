#!/usr/bin/env node
/** Start the Bubble Tea TUI with the active configured bridge provider. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMClient } from '../dist/llm/LLMClient.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig } from '../dist/tui-bridge/BridgeLauncherConfig.js';
import { TuiBridgeServer } from '../dist/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../dist/tui-bridge/TuiBridgeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bridgeOnly = process.argv.includes('--bridge-only');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || process.env.LIMINAL_BRIDGE_PORT || 3000);

const providerConfig = resolveBridgeProviderConfig();
applyBridgeProviderEnv(process.env, providerConfig);

const llm = new LLMClient({
  role: 'harness',
  baseUrl: providerConfig.baseUrl,
  model: providerConfig.model,
  apiKey: providerConfig.apiKey,
  temperature: 0.5,
  maxTokens: 4096,
});

const bridge = new TuiBridgeService();
const server = new TuiBridgeServer(bridge, { port, host: 'localhost', llm });
await server.start();
console.log(`Bubble Tea bridge: ${server.address}`);
console.log(`Harness provider/model: ${providerConfig.provider}/${providerConfig.model}`);

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
