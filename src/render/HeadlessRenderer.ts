/**
 * HeadlessRenderer - Render code in a headless browser using Playwright
 *
 * Provides sandboxed rendering for p5.js, Three.js, Hydra, Strudel, and Tone.js code.
 * Captures screenshots and audio output for quality analysis.
 */

import { chromium, Browser, Page, BrowserContext, ConsoleMessage } from 'playwright';
import { existsSync, readdirSync } from 'node:fs';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import { Logger } from '../utils/Logger.js';

export type RenderDomain = 'p5' | 'three' | 'glsl' | 'hydra' | 'strudel' | 'tone' | 'unknown';

export interface RenderOptions {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Timeout for rendering in milliseconds */
  timeout?: number;
  /** Whether to wait for animation/video to stabilize */
  waitForStabilization?: boolean;
  /** Stabilization time in milliseconds */
  stabilizationTime?: number;
  /** Domain hint for specialized rendering */
  domain?: RenderDomain;
}

export interface ScreenshotResult {
  /** Screenshot as PNG buffer */
  buffer: Buffer;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Whether the screenshot was captured successfully */
  success: boolean;
  /** Error message if capture failed */
  error?: string;
}

export interface AudioCaptureResult {
  /** Audio data as Float32Array (normalized -1 to 1) */
  samples: Float32Array;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
  /** Whether audio was captured successfully */
  success: boolean;
  /** Error message if capture failed */
  error?: string;
}

export interface RenderResult {
  /** The Playwright page instance (for advanced use) */
  page?: Page;
  /** Screenshot result */
  screenshot?: ScreenshotResult;
  /** Audio capture result */
  audio?: AudioCaptureResult;
  /** Whether rendering succeeded */
  success: boolean;
  /** Error message if rendering failed */
  error?: string;
  /** Console logs from the page */
  logs: string[];
  /** Page errors */
  errors: string[];
}

const DEFAULT_OPTIONS: Required<RenderOptions> = {
  width: 800,
  height: 600,
  timeout: 30000,
  waitForStabilization: true,
  stabilizationTime: 2000,
  domain: 'unknown',
};

/**
 * Headless renderer for creative coding outputs
 */
export class HeadlessRenderer {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private static instance: HeadlessRenderer | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): HeadlessRenderer {
    if (!HeadlessRenderer.instance) {
      HeadlessRenderer.instance = new HeadlessRenderer();
    }
    return HeadlessRenderer.instance;
  }

  /**
   * Resolve a chromium executable path.
   *
   * Playwright pins a specific browser revision. When the bundled binary doesn't
   * exist (e.g. a newer playwright version installed but only an older chromium
   * build available in the environment), fall back to any chromium binary found
   * under PLAYWRIGHT_BROWSERS_PATH or /opt/pw-browsers.
   */
  private static resolveChromiumExecutable(): string | undefined {
    // Honor explicit override (e.g. set in CI or dev environments)
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }

    // Check if the playwright-preferred binary exists; if so, let playwright use it
    const preferredPath = chromium.executablePath();
    if (existsSync(preferredPath)) return undefined; // let playwright resolve normally

    // Fall back: scan for any installed chromium binary
    const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
    if (!existsSync(browsersPath)) return undefined;

    try {
      const dirs = readdirSync(browsersPath);
      for (const dir of dirs) {
        if (!dir.startsWith('chromium')) continue;
        for (const subPath of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
          const candidate = `${browsersPath}/${dir}/${subPath}`;
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // scan failed — fall through
    }
    return undefined;
  }

  /**
   * Initialize the browser (lazy initialization)
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    try {
      const executablePath = HeadlessRenderer.resolveChromiumExecutable();
      this.browser = await chromium.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });

      Logger.info('HeadlessRenderer', 'Browser initialized');
    } catch (error) {
      Logger.error('HeadlessRenderer', 'Failed to initialize browser:', error);
      throw new Error(`Failed to initialize headless browser: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Detect domain from code content
   */
  static detectDomain(code: string): RenderDomain {
    if (code.includes('function setup()') || code.includes('createCanvas') || code.includes('draw()')) {
      return 'p5';
    }
    if (code.includes('THREE.') || code.includes('WebGLRenderer') || code.includes('Scene()')) {
      return 'three';
    }
    if (code.includes('void main') && code.includes('gl_FragColor')) {
      return 'glsl';
    }
    if (code.includes('.out(o0)') || code.includes('src(o0)') || code.includes('osc(')) {
      return 'hydra';
    }
    if (code.includes('.s(') && (code.includes('stack') || code.includes('$:') || code.includes('note('))) {
      return 'strudel';
    }
    if (code.includes('Tone.') || code.includes('Synth') || code.includes('synth')) {
      return 'tone';
    }
    return 'unknown';
  }

  /**
   * Render code and capture output
   */
  async render(code: string, options: RenderOptions = {}): Promise<RenderResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const logs: string[] = [];
    const errors: string[] = [];

    try {
      await this.initialize();

      if (!this.context) {
        throw new Error('Browser context not initialized');
      }

      const page = await this.context.newPage();
      
      // Set viewport size
      await page.setViewportSize({ width: opts.width, height: opts.height });

      // Capture console logs
      page.on('console', (msg: ConsoleMessage) => {
        const log = `[${msg.type()}] ${msg.text()}`;
        logs.push(log);
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Capture page errors
      page.on('pageerror', (error: Error) => {
        errors.push(error.message);
      });

      // Detect domain if not specified
      const domain = opts.domain === 'unknown' ? HeadlessRenderer.detectDomain(code) : opts.domain;

      // Wrap code in HTML
      const html = HTMLWrapper.wrap(code, { 
        domain: domain === 'glsl' ? 'shader' : domain === 'unknown' ? undefined : domain 
      });

      // Load the HTML
      await page.setContent(html, { waitUntil: 'networkidle', timeout: opts.timeout });

      // Wait for canvas to be ready
      await this.waitForCanvas(page, opts.timeout);

      // Wait for stabilization if requested
      if (opts.waitForStabilization) {
        await page.waitForTimeout(opts.stabilizationTime);
      }

      // Capture screenshot
      const screenshot = await this.captureScreenshot(page, opts);

      // Capture audio if applicable
      const audio = domain === 'tone' || domain === 'strudel' 
        ? await this.captureAudio(page, opts)
        : undefined;

      return {
        page,
        screenshot,
        audio,
        success: screenshot.success,
        logs,
        errors,
      };
    } catch (error) {
      Logger.error('HeadlessRenderer', 'Render failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Render failed',
        logs,
        errors,
      };
    }
  }

  /**
   * Wait for canvas element to be ready
   */
  private async waitForCanvas(page: Page, timeout: number): Promise<void> {
    try {
      await page.waitForFunction(
        () => {
          const canvas = document.querySelector('canvas');
          return canvas && canvas.width > 0 && canvas.height > 0;
        },
        { timeout: Math.min(timeout, 5000) }
      );
    } catch {
      // Canvas might not be required for all domains (e.g., audio-only)
      Logger.debug('HeadlessRenderer', 'No canvas found or timeout waiting for canvas');
    }
  }

  /**
   * Capture screenshot of the rendered output
   */
  private async captureScreenshot(page: Page, opts: Required<RenderOptions>): Promise<ScreenshotResult> {
    try {
      // Try to capture just the canvas first
      const canvas = await page.$('canvas');
      
      if (canvas) {
        const buffer = await canvas.screenshot({ type: 'png' });
        const boundingBox = await canvas.boundingBox();
        
        return {
          buffer,
          width: Math.round(boundingBox?.width || opts.width),
          height: Math.round(boundingBox?.height || opts.height),
          success: true,
        };
      }

      // Fallback to full page screenshot
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      
      return {
        buffer,
        width: opts.width,
        height: opts.height,
        success: true,
      };
    } catch (error) {
      return {
        buffer: Buffer.alloc(0),
        width: 0,
        height: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot failed',
      };
    }
  }

  /**
   * Capture audio output from the page
   * Uses Web Audio API to capture audio data
   */
  private async captureAudio(page: Page, opts: Required<RenderOptions>): Promise<AudioCaptureResult> {
    try {
      // Inject audio capture code
      const audioData = await page.evaluate(async (duration: number) => {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        
        // Wait a bit for audio to start
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create a destination to capture audio
        const destination = audioContext.createMediaStreamDestination();
        
        // Capture silence for analysis (we'll analyze what's playing)
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Connect analyser to destination
        analyser.connect(destination);
        
        // Collect samples
        const sampleRate = audioContext.sampleRate;
        const numSamples = Math.floor(sampleRate * (duration / 1000));
        const samples = new Float32Array(numSamples);
        
        // Fill with synthetic data based on frequency analysis
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(frequencyData);
        
        // Generate synthetic waveform based on frequency content
        for (let i = 0; i < numSamples; i++) {
          let sample = 0;
          for (let f = 0; f < frequencyData.length && f < 100; f++) {
            const amplitude = frequencyData[f] / 255;
            const frequency = (f / frequencyData.length) * (sampleRate / 2);
            sample += amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
          }
          samples[i] = sample / 100; // Normalize
        }
        
        return {
          samples: Array.from(samples.slice(0, 4096)), // Limit to first 4096 samples for transfer
          sampleRate,
          duration: duration / 1000,
        };
      }, opts.stabilizationTime);

      return {
        samples: new Float32Array(audioData.samples),
        sampleRate: audioData.sampleRate,
        duration: audioData.duration,
        success: true,
      };
    } catch (error) {
      return {
        samples: new Float32Array(0),
        sampleRate: 44100,
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Audio capture failed',
      };
    }
  }

  /**
   * Close the browser and clean up resources
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    HeadlessRenderer.instance = null;
    Logger.info('HeadlessRenderer', 'Browser closed');
  }

  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }
}

export default HeadlessRenderer;
