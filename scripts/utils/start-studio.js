#!/usr/bin/env node
/**
 * Start Liminal Studio: GUI backend plus Vite frontend.
 * Canonical repo command: pnpm gui
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const apiPort = Number(process.env.PORT || process.env.LIMINAL_STUDIO_API_PORT) || 5174;
const guiPort = Number(process.env.LIMINAL_STUDIO_GUI_PORT) || 5173;
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function waitFor(url, timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // keep polling
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 250);
    };
    void tick();
  });
}

function stop(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill('SIGTERM');
}

let frontend;
const backend = spawn(process.execPath, ['gui/start.js'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(apiPort) },
});

backend.stdout?.on('data', (data) => process.stdout.write(data));
backend.stderr?.on('data', (data) => process.stderr.write(data));
backend.on('error', (err) => {
  console.error('Studio backend failed to start:', err.message);
  process.exit(1);
});
backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('Studio backend exited with code', code);
    stop(frontend);
    process.exit(code);
  }
});

try {
  await waitFor(`http://localhost:${apiPort}/api/health`);
  console.log(`Liminal Studio frontend: http://localhost:${guiPort}`);
  frontend = spawn(npmCmd, ['run', 'dev', '--', '--host', 'localhost', '--port', String(guiPort)], {
    cwd: path.join(root, 'gui'),
    stdio: 'inherit',
    env: { ...process.env, VITE_API_TARGET: `http://localhost:${apiPort}` },
  });
  frontend.on('exit', (code) => {
    stop(backend);
    process.exit(code ?? 0);
  });
  frontend.on('error', (err) => {
    console.error('Studio frontend failed to start:', err.message);
    stop(backend);
    process.exit(1);
  });
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  stop(backend);
  process.exit(1);
}

process.on('SIGINT', () => {
  stop(frontend);
  stop(backend);
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop(frontend);
  stop(backend);
  process.exit(0);
});
