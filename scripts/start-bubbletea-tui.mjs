#!/usr/bin/env node
/** Start the Bubble Tea TUI with the active configured bridge provider. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LLMClient } from '../dist/llm/LLMClient.js';
import { eventBus } from '../dist/core/EventBus.js';
import { applyBridgeProviderEnv, resolveBridgeProviderConfig } from '../dist/tui-bridge/BridgeLauncherConfig.js';
import { TuiBridgeServer } from '../dist/tui-bridge/TuiBridgeServer.js';
import { TuiBridgeService } from '../dist/tui-bridge/TuiBridgeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bridgeOnly = process.argv.includes('--bridge-only');
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || process.env.LIMINAL_BRIDGE_PORT || 3000);
if (!process.env.LIMINAL_LOG_LEVEL) process.env.LIMINAL_LOG_LEVEL = 'info';
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function inspectArg(arg) {
  if (arg instanceof Error) return arg.stack || arg.message;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function routeBridgeConsoleToFile(logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const write = (level, args) => {
    stream.write(`[${new Date().toISOString()}] ${level} ${args.map(inspectArg).join(' ')}\n`);
  };

  console.log = (...args) => write('INFO', args);
  console.info = (...args) => write('INFO', args);
  console.warn = (...args) => write('WARN', args);
  console.error = (...args) => write('ERROR', args);
  console.debug = (...args) => write('DEBUG', args);

  return stream;
}

const providerConfig = resolveBridgeProviderConfig();
applyBridgeProviderEnv(process.env, providerConfig);
if (!bridgeOnly) eventBus.enableTuiMode();

const llm = new LLMClient({
  role: 'harness',
  baseUrl: providerConfig.baseUrl,
  model: providerConfig.model,
  apiKey: providerConfig.apiKey,
  temperature: 0.5,
  maxTokens: 4096,
});

const bridge = new TuiBridgeService();
const server = new TuiBridgeServer(bridge, { port, host: '127.0.0.1', llm });
await server.start();
const bridgeLogFile = path.join(ROOT, '.omx', 'logs', 'bubbletea-bridge.log');
originalConsole.log(`Bubble Tea bridge: ${server.address}`);
originalConsole.log(`Harness provider/model: ${providerConfig.provider}/${providerConfig.model}`);
originalConsole.log(`Bridge logs: ${bridgeLogFile}`);
originalConsole.log(`Bridge log level: ${process.env.LIMINAL_LOG_LEVEL}`);

let child;
let bridgeLogStream;
if (!bridgeOnly) {
  bridgeLogStream = routeBridgeConsoleToFile(bridgeLogFile);
  const binary = path.join(ROOT, 'bubbletea', 'liminal-tui');
  const env = {
    ...process.env,
    LIMINAL_ROOT: ROOT,
    LIMINAL_BRIDGE_URL: server.address,
    LIMINAL_TUI_TRANSCRIPT_PATH: path.join(ROOT, '.omx', 'logs', 'bubbletea-transcript.md'),
  };
  if (process.env.LIMINAL_TUI_USE_BINARY === '1' && fs.existsSync(binary)) {
    child = spawn(binary, { cwd: path.join(ROOT, 'bubbletea'), env, stdio: 'inherit' });
  } else {
    child = spawn('go', ['run', '.'], { cwd: path.join(ROOT, 'bubbletea'), env, stdio: 'inherit' });
  }
  child.on('exit', async (code) => {
    await server.stop().catch(() => {});
    bridgeLogStream?.end();
    process.exit(code ?? 0);
  });
}

async function shutdown() {
  if (child && !child.killed) child.kill('SIGTERM');
  await server.stop().catch(() => {});
  if (!bridgeOnly) eventBus.disableTuiMode();
  bridgeLogStream?.end();
  process.exit(0);
}
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
