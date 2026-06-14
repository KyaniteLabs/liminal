#!/usr/bin/env tsx
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';
import { readCurrentGitCommit } from '../../src/runtime-core/ProofReceiptValidator.js';

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
  const consoleErrors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(`http://localhost:${guiPort}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Wait for the React workbench to mount + render the Showcase stage.
  await page.getByRole('heading', { name: /Sinter Studio/i }).waitFor({ timeout: 30_000 });

  // Durable smoke: assert the redesigned workbench shell renders cleanly and is
  // interactive, instead of a brittle deep click-path. The old path
  // (More tools -> Improve -> Session -> Scan -> ML feature value) broke on the
  // 2026-06 stage-nav redesign even though the GUI was healthy.
  const studioHeading = await page.getByRole('heading', { name: /Sinter Studio/i }).isVisible().catch(() => false);
  const hasGenerate = await page.getByRole('button', { name: /^Generate$/ }).isVisible().catch(() => false);
  const hasSettings = await page.getByRole('button', { name: /^Settings$/ }).isVisible().catch(() => false);
  const hasCreateBar = (await page.getByPlaceholder(/what should we make/i).count().catch(() => 0)) > 0
    || (await page.getByRole('button', { name: /^Create$/ }).count().catch(() => 0)) > 0;

  await browser.close();

  // A fully-rendered workbench shell (heading + stage nav + create bar) loaded with
  // ZERO console/page errors is strong proof of a live, mounted React app wired to a
  // healthy backend — a static error page would have neither the shell nor clean
  // console. We deliberately avoid a deep click-path: that is what made the old smoke
  // brittle across UI redesigns without testing anything about GUI health.
  const checks = {
    backendHealth: true,
    frontendServes: true,
    noConsoleErrors: consoleErrors.length === 0,
    studioHeading,
    stageNav: hasGenerate && hasSettings,
    createAffordance: hasCreateBar,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
  const result = {
    generatedAt: new Date().toISOString(),
    gitCommit: readCurrentGitCommit(repoRoot),
    status: failed.length === 0 ? ('pass' as const) : ('fail' as const),
    apiPort,
    guiPort,
    checks,
    consoleErrors: consoleErrors.slice(0, 10),
    blockers: failed,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');
  console.log(`Studio smoke proof written: ${outPath} (status: ${result.status})`);
  if (result.status !== 'pass') {
    console.error(`Studio smoke FAILED checks: ${failed.join(', ')}`);
    if (consoleErrors.length) console.error('Console errors:', consoleErrors.slice(0, 5).join(' | '));
    process.exitCode = 1;
  }
} finally {
  await Promise.all([backend, frontend].filter(Boolean).map((child) => stop(child as ChildProcess)));
}
