/**
 * M10: Runtime Health Monitor
 * 
 * Monitors code execution over time to detect:
 * - Memory leaks (growing heap usage)
 * - Frame rate degradation
 * - Console errors after startup
 * - Infinite accumulation (objects never cleaned up)
 * 
 * Requires Puppeteer to run code in headless browser.
 */

import puppeteer from 'puppeteer';
import { getChromeArgs } from '../security/SandboxConfig.js';
import { generateHTML } from '../utils/generateHTML.js';

export interface RuntimeHealthResult {
  healthy: boolean;
  duration: number;  // How long it ran (ms)
  checks: {
    memoryLeak: boolean;
    frameRateStable: boolean;
    noConsoleErrors: boolean;
    noInfiniteAccumulation: boolean;
  };
  metrics: {
    initialMemoryMB: number;
    finalMemoryMB: number;
    memoryGrowthMB: number;
    avgFPS: number;
    minFPS: number;
    consoleErrorCount: number;
    objectCountGrowth: number;
  };
  issues: string[];
}

export interface RuntimeHealthOptions {
  durationMs?: number;      // How long to monitor (default: 5000ms)
  sampleIntervalMs?: number; // How often to sample (default: 500ms)
  memoryLeakThresholdMB?: number;  // Memory growth threshold (default: 50MB)
  minAcceptableFPS?: number;  // Minimum acceptable FPS (default: 10)
  disableSandbox?: boolean;
}

const DEFAULT_OPTIONS: Required<RuntimeHealthOptions> = {
  durationMs: 5000,
  sampleIntervalMs: 500,
  memoryLeakThresholdMB: 50,
  minAcceptableFPS: 10,
  disableSandbox: false,
};

export class RuntimeHealthMonitor {
  private options: Required<RuntimeHealthOptions>;

  constructor(options?: RuntimeHealthOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Monitor code health over time
   */
  async monitor(code: string, _domain: string): Promise<RuntimeHealthResult> {
    const browser = await puppeteer.launch({
      headless: true,
      args: getChromeArgs({ forceDisableSandbox: this.options.disableSandbox }),
    });

    const issues: string[] = [];
    const memorySamples: number[] = [];
    const fpsSamples: number[] = [];
    let consoleErrorCount = 0;
    let initialObjectCount = 0;
    let finalObjectCount = 0;

    try {
      const page = await browser.newPage();

      // Track console errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrorCount++;
        }
      });

      page.on('pageerror', () => {
        consoleErrorCount++;
      });

      // Inject performance tracker
      await page.evaluateOnNewDocument(() => {
        // @ts-expect-error
        window.__liminalMetrics = {
          frameCount: 0,
          lastFrameTime: performance.now(),
          fpsSamples: [] as number[],
          objectCounts: [] as number[],
        };

        // Track FPS
        function trackFrame() {
          // @ts-expect-error
          const metrics = window.__liminalMetrics;
          const now = performance.now();
          const elapsed = now - metrics.lastFrameTime;
          const fps = 1000 / elapsed;
          metrics.fpsSamples.push(fps);
          metrics.lastFrameTime = now;
          metrics.frameCount++;
          requestAnimationFrame(trackFrame);
        }
        requestAnimationFrame(trackFrame);

        // Track object count (rough approximation)
        setInterval(() => {
          // @ts-expect-error
          const metrics = window.__liminalMetrics;
          // Count various object types that might accumulate
          let count = 0;
          if (typeof window.p5 !== 'undefined') {
            // @ts-expect-error
            count += Object.keys(window).filter(k => k.startsWith('_')).length;
          }
          metrics.objectCounts.push(count);
        }, 1000);
      });

      // Generate and load HTML
      const html = generateHTML({
        code,
        title: 'Runtime Health Check',
        bodyStyle: 'margin: 0; padding: 0; overflow: hidden;',
        fullscreen: true,
      });

      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for canvas to appear
      await page.waitForSelector('canvas', { timeout: 10000 });
      
      // Get initial metrics
      const initialMetrics = await page.metrics();
      initialObjectCount = await page.evaluate(() => {
        // @ts-expect-error
        return window.__liminalMetrics?.objectCounts?.slice(-1)[0] || 0;
      });
      memorySamples.push(initialMetrics.JSHeapUsedSize / 1024 / 1024);

      // Monitor over time
      const startTime = Date.now();
      const sampleCount = Math.floor(this.options.durationMs / this.options.sampleIntervalMs);
      
      for (let i = 0; i < sampleCount; i++) {
        await new Promise(r => setTimeout(r, this.options.sampleIntervalMs));
        
        const metrics = await page.metrics();
        memorySamples.push(metrics.JSHeapUsedSize / 1024 / 1024);

        // Get FPS samples from page
        const pageFps = await page.evaluate(() => {
          // @ts-expect-error
          const samples = window.__liminalMetrics?.fpsSamples || [];
          // @ts-expect-error
          window.__liminalMetrics.fpsSamples = []; // Reset for next interval
          return samples;
        });
        fpsSamples.push(...pageFps);
      }

      // Get final metrics
      const _finalMetrics = await page.metrics();
      finalObjectCount = await page.evaluate(() => {
        // @ts-expect-error
        return window.__liminalMetrics?.objectCounts?.slice(-1)[0] || 0;
      });

      // Calculate results
      const initialMemory = memorySamples[0];
      const finalMemory = memorySamples[memorySamples.length - 1];
      const memoryGrowth = finalMemory - initialMemory;
      const avgFPS = fpsSamples.length > 0 
        ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length 
        : 0;
      const minFPS = fpsSamples.length > 0 
        ? Math.min(...fpsSamples) 
        : 0;
      const objectCountGrowth = finalObjectCount - initialObjectCount;

      // Check for issues
      const memoryLeak = memoryGrowth > this.options.memoryLeakThresholdMB;
      const frameRateStable = minFPS >= this.options.minAcceptableFPS;
      const noConsoleErrors = consoleErrorCount === 0;
      const noInfiniteAccumulation = objectCountGrowth < 100; // Arbitrary threshold

      if (memoryLeak) {
        issues.push(`Memory leak detected: ${memoryGrowth.toFixed(1)}MB growth over ${this.options.durationMs}ms`);
      }
      if (!frameRateStable) {
        issues.push(`Frame rate unstable: min FPS was ${minFPS.toFixed(1)}`);
      }
      if (!noConsoleErrors) {
        issues.push(`Console errors detected: ${consoleErrorCount} errors`);
      }
      if (!noInfiniteAccumulation) {
        issues.push(`Object accumulation detected: ${objectCountGrowth} objects created`);
      }

      return {
        healthy: !memoryLeak && frameRateStable && noConsoleErrors && noInfiniteAccumulation,
        duration: Date.now() - startTime,
        checks: {
          memoryLeak: !memoryLeak,
          frameRateStable,
          noConsoleErrors,
          noInfiniteAccumulation,
        },
        metrics: {
          initialMemoryMB: initialMemory,
          finalMemoryMB: finalMemory,
          memoryGrowthMB: memoryGrowth,
          avgFPS,
          minFPS,
          consoleErrorCount,
          objectCountGrowth,
        },
        issues,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`Monitoring error: ${message}`);
      
      return {
        healthy: false,
        duration: 0,
        checks: {
          memoryLeak: false,
          frameRateStable: false,
          noConsoleErrors: false,
          noInfiniteAccumulation: false,
        },
        metrics: {
          initialMemoryMB: 0,
          finalMemoryMB: 0,
          memoryGrowthMB: 0,
          avgFPS: 0,
          minFPS: 0,
          consoleErrorCount,
          objectCountGrowth: 0,
        },
        issues,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Quick health check - runs for shorter duration
   */
  async quickCheck(code: string, domain: string): Promise<RuntimeHealthResult> {
    const originalDuration = this.options.durationMs;
    this.options.durationMs = 2000; // 2 second quick check
    const result = await this.monitor(code, domain);
    this.options.durationMs = originalDuration;
    return result;
  }
}
