/**
 * SandboxRunner - Runs p5.js code in a safe, isolated headless browser
 *
 * Uses Puppeteer: launch page, inject p5 and sketch, run with timeout, no file/network
 * access (only p5 CDN allowed), then close. Same interface for preview and living run.
 */

import puppeteer, { Browser } from 'puppeteer';
import { generateHTML } from '../utils/generateHTML.js';
import { getChromeArgs } from '../security/SandboxConfig.js';
import { Logger } from '../utils/Logger.js';
import { getLocalP5ScriptForUrl } from '../utils/browserAssetFallbacks.js';


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
 * Force-close a Puppeteer browser by killing its Chromium process.
 *
 * When user code (e.g., `while(true){}`) blocks the page's main thread,
 * `browser.close()` can hang indefinitely because Puppeteer waits for CDP
 * responses from pages that can't respond. `process.kill()` sends SIGKILL
 * directly from Node.js — no CDP cooperation needed.
 */
let wasKilled = false;

function forceKillBrowser(browser: Browser): void {
  const proc = browser.process();
  if (proc?.pid) {
    try {
      process.kill(proc.pid, 'SIGKILL');
      wasKilled = true;
    } catch (err) {
      // Process may already be dead - log for debugging
      Logger.debug('SandboxRunner', 'Failed to kill browser process:', err);
    }
  } else {
    // Fallback: try graceful close (may hang, but no PID available)
    void browser.close().catch((err) => {
      if (!wasKilled) {
        Logger.debug('SandboxRunner', 'Failed to close browser:', err);
      }
    });
  }
}

/**
 * Run p5.js code in an isolated headless page with timeout and no file/network access.
 * Use for preview and living run; no callback.
 *
 * Uses Promise.race() with a manual timeout to guarantee we return within timeoutMs
 * even when user code (e.g., while(true){}) blocks the page's main thread and
 * prevents Puppeteer's internal timeout from firing.
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

    // Restrict network: only allow generated p5 script requests, fulfilled locally.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      void (async () => {
        const localScript = await getLocalP5ScriptForUrl(req.url());
        if (localScript) {
          await req.respond({
            status: 200,
            contentType: 'application/javascript; charset=utf-8',
            body: localScript,
          });
          return;
        }

        await req.abort();
      })().catch((err) => {
        Logger.debug('SandboxRunner', 'Request handling failed:', err);
        void req.abort().catch((abortErr) => {
          Logger.debug('SandboxRunner', 'Request abort failed:', abortErr);
        });
      });
    });

    const html = generateHTML({
      code,
      title: 'Sandbox',
      bodyStyle: 'margin: 0; padding: 0; overflow: hidden;',
      fullscreen: true,
    });

    // Race page loading against a manual timeout. When user code blocks the
    // page's main thread (e.g. while(true){}), Puppeteer's built-in setContent
    // timeout may not fire. The manual timeout guarantees we always return.
    const loadPromise = page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    // Prevent unhandled rejection: if the manual timeout fires and kills the
    // browser, loadPromise will reject. Log it for debugging but don't propagate.
    loadPromise.catch((err) => {
      Logger.debug('SandboxRunner', 'Load promise rejected (browser may have been killed):', err);
    });

    const manualTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Sandbox timeout: execution exceeded ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([loadPromise, manualTimeout]);
    await page.waitForSelector('canvas', { timeout: Math.min(10000, timeoutMs) });
    await new Promise((r) => setTimeout(r, 300));

    return { completed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { completed: false, error: message };
  } finally {
    if (browser) {
      forceKillBrowser(browser);
    }
  }
}
