import { createServer as createNetServer } from 'node:net';
import { chromium } from 'playwright';
import { TuiBridgeService } from '../../src/tui-bridge/TuiBridgeService.js';
import { TuiBridgeServer } from '../../src/tui-bridge/TuiBridgeServer.js';

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate port'));
        return;
      }
      server.close((err) => err ? reject(err) : resolve(address.port));
    });
    server.on('error', reject);
  });
}

interface SmokeReceipt {
  status: 'pass' | 'fail';
  port: number;
  outText: string | null;
  consoleMessages: string[];
  pageErrors: string[];
  eventTypes: string[];
  previewCompleted: boolean;
  previewCompletedBytes: number;
}

const port = await getFreePort();
const service = new TuiBridgeService();
const server = new TuiBridgeServer(service, {
  host: '127.0.0.1',
  port,
  llm: { getConfig: () => ({ baseUrl: 'https://api.z.ai/api/anthropic', model: 'GLM-4.5-air' }) } as any,
});

let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let receipt: SmokeReceipt | undefined;

try {
  await server.start();
  const createRes = await fetch(`http://127.0.0.1:${port}/api/tui/session`, { method: 'POST' });
  const session = await createRes.json() as { sessionId: string };

  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--no-sandbox',
    ],
  });
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`http://127.0.0.1:${port}/api/tui/session/${session.sessionId}/mic-preview`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Start recording' }).click();
  await page.waitForFunction(
    () => document.querySelector('#out')?.textContent?.includes('Status: recording'),
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.waitForFunction(
    () => document.querySelector('#out')?.textContent?.includes('Status: stopped'),
    null,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(250);

  const outText = await page.locator('#out').textContent();
  const events = service.getEvents(session.sessionId);
  const previewCompleted = events.some((event) => event.type === 'preview.completed');
  const completedContent = String(events.find((event) => event.type === 'preview.completed')?.content ?? '');
  receipt = {
    status: pageErrors.length === 0 && previewCompleted && /RMS:|Peak:|Status: stopped/.test(outText ?? '') ? 'pass' : 'fail',
    port,
    outText,
    consoleMessages,
    pageErrors,
    eventTypes: events.map((event) => event.type),
    previewCompleted,
    previewCompletedBytes: completedContent.length,
  };
} finally {
  await browser?.close().catch(() => undefined);
  await server.stop().catch(() => undefined);
}

console.log(JSON.stringify(receipt, null, 2));
if (!receipt || receipt.status !== 'pass') process.exitCode = 1;
