/**
 * SandboxRunner - Runs p5.js code in a safe, isolated headless browser
 *
 * Uses Puppeteer: launch page, inject p5 and sketch, run with timeout, no file/network
 * access (only p5 CDN allowed), then close. Same interface for preview and living run.
 */

import puppeteer, { Browser } from 'puppeteer';
import { generateHTML } from '../utils/generateHTML.js';
import { getChromeArgs } from '../security/SandboxConfig.js';

export interface SandboxResult {
  stdout?: string;
  error?: string;
  completed: boolean;
}

export interface SandboxOptions {
  timeoutMs?: number;
  /** Only works if LIMINAL_DISABLE_SANDBOX=true */
  disableSandbox?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Run p5.js code in an isolated headless page with timeout and no file/network access.
 * Use for preview and living run; no callback.
 */
export async function runInSandbox(
  code: string,
  options?: SandboxOptions
): Promise<SandboxResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const disableSandbox = options?.disableSandbox ?? false;
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: getChromeArgs({ forceDisableSandbox: disableSandbox }),
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
        void req.continue();
      } else {
        void req.abort();
      }
    });

    const html = generateHTML({
      code,
      title: 'Sandbox',
      bodyStyle: 'margin: 0; padding: 0; overflow: hidden;',
      fullscreen: true,
    });
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForSelector('canvas', { timeout: Math.min(10000, timeoutMs) });
    await new Promise((r) => setTimeout(r, 300));

    return { completed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { completed: false, error: message };
  } finally {
    if (browser) {
      await browser.close().catch((err) => {
        console.warn('[SandboxRunner] Failed to close browser:', err instanceof Error ? err.message : err);
      });
    }
  }
}
