/**
 * SandboxRunner - Runs p5.js code in a safe, isolated headless browser
 *
 * Uses Puppeteer: launch page, inject p5 and sketch, run with timeout, no file/network
 * access (only p5 CDN allowed), then close. Same interface for preview and living run.
 */

import puppeteer, { Browser } from 'puppeteer';

export interface SandboxResult {
  stdout?: string;
  error?: string;
  completed: boolean;
}

export interface SandboxOptions {
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const P5_CDN =
  'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';

function generateHTML(code: string): string {
  const escaped = code.replace(/<\/script>/gi, '<\\/script>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sandbox</title>
  <style>body { margin: 0; padding: 0; overflow: hidden; } canvas { display: block; }</style>
  <script src="${P5_CDN}"></script>
</head>
<body>
  <script>${escaped}</script>
</body>
</html>`;
}

/**
 * Run p5.js code in an isolated headless page with timeout and no file/network access.
 * Use for preview and living run; no callback.
 */
export async function runInSandbox(
  code: string,
  options?: SandboxOptions
): Promise<SandboxResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    // Restrict network: only allow p5 CDN
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (
        url.startsWith('https://cdnjs.cloudflare.com/') &&
        url.includes('p5')
      ) {
        req.continue();
      } else {
        req.abort();
      }
    });

    const html = generateHTML(code);
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForSelector('canvas', { timeout: Math.min(10000, timeoutMs) });
    await new Promise((r) => setTimeout(r, 300));

    return { completed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { completed: false, error: message };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
