#!/usr/bin/env tsx
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'studio-smoke.json');

async function getPorts(count: number): Promise<number[]> {
  const servers: net.Server[] = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = net.createServer();
      servers.push(server);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
    }

    return servers.map((server) => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to allocate port');
      }
      return address.port;
    });
  } finally {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
  }
}

function waitFor(url: string, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
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

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

const [apiPort, guiPort] = await getPorts(2);
let backend: ChildProcess | undefined;
let frontend: ChildProcess | undefined;

try {
  backend = spawn(process.execPath, ['gui/start.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(apiPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  frontend = spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', String(guiPort)], {
    cwd: path.join(repoRoot, 'gui'),
    env: { ...process.env, VITE_API_TARGET: `http://localhost:${apiPort}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitFor(`http://localhost:${apiPort}/api/health`);
  await waitFor(`http://localhost:${guiPort}/`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://localhost:${guiPort}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByRole('button', { name: /^Improve$/ }).click();
  await page.getByRole('button', { name: /^Scan$/ }).click();
  await page.getByText('Prove or hide ML feature value').waitFor({ timeout: 30_000 });
  await page.getByText('ML labels').waitFor({ timeout: 30_000 });
  const body = await page.locator('body').innerText();
  await browser.close();

  const result = {
    generatedAt: new Date().toISOString(),
    apiPort,
    guiPort,
    checks: {
      health: true,
      improveLane: body.includes('Improve'),
      proposal: body.includes('Prove or hide ML feature value'),
      mlLabels: body.includes('ML labels'),
    },
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  console.log(`Studio smoke proof written: ${outPath}`);
} finally {
  await Promise.all([backend, frontend].filter(Boolean).map((child) => stop(child as ChildProcess)));
}
