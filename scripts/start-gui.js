#!/usr/bin/env node
/**
 * Start GUI backend (in background) then Vite frontend (foreground).
 * Backend stays running until you Ctrl+C (then both exit).
 * Usage: node scripts/start-gui.js
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const backend = spawn('node', ['gui/start.js'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: '5174' },
});

let frontend;

backend.stdout?.on('data', (d) => process.stdout.write(d));
backend.stderr?.on('data', (d) => process.stderr.write(d));
backend.on('error', (err) => {
  console.error('Backend failed to start:', err.message);
  process.exit(1);
});
backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('Backend exited with code', code);
    if (frontend) frontend.kill('SIGTERM');
    process.exit(code);
  }
});

// Wait for backend to be ready then start Vite
function startFrontend() {
  frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(root, 'gui'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  });
  frontend.on('exit', (code) => {
    backend.kill('SIGTERM');
    process.exit(code ?? 0);
  });
}

// Give backend time to bind
setTimeout(startFrontend, 800);

process.on('SIGINT', () => {
  if (frontend) frontend.kill('SIGINT');
  backend.kill('SIGTERM');
  process.exit(0);
});
process.on('SIGTERM', () => {
  if (frontend) frontend.kill('SIGTERM');
  backend.kill('SIGTERM');
  process.exit(0);
});
