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
      throw new Error(`Failed to initialize headless browser: ${error instanceof Error ? error.message : 'unknown error'}`,
        { cause: error instanceof Error ? error : undefined });
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

      // Inject audio capture instrumentation BEFORE setContent for audio domains
      // This intercepts AudioContext creation to capture real audio output
      if (domain === 'tone' || domain === 'strudel') {
        await this.injectAudioCapture(page);
      }

      // Wrap code in HTML
      const html = HTMLWrapper.wrap(code, {
        domain: domain === 'glsl' ? 'shader' : domain === 'unknown' ? undefined : domain
      });

      // Load the HTML
      await page.setContent(html, { waitUntil: 'networkidle', timeout: opts.timeout });

      // Wait for canvas to be ready
      await this.waitForCanvas(page, opts.timeout);

      // Trigger audio playback for audio domains so we capture actual sound
      if (domain === 'tone' || domain === 'strudel') {
        await this.triggerAudioPlayback(page, domain);
      }

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
   * Injects audio capture instrumentation into the page.
   * This must be called BEFORE setContent to intercept AudioContext creation.
   */
  private async injectAudioCapture(page: Page): Promise<void> {
    await page.addInitScript(() => {
      // Store for captured audio data
      const audioCaptureData: number[] = [];
      (window as unknown as { __audioCaptureData: number[] }).__audioCaptureData = audioCaptureData;

      // Intercept AudioContext creation
      const OriginalAudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!OriginalAudioContext) return;

      // Track all created contexts and their capture destinations
      const captureDestinations: MediaStreamAudioDestinationNode[] = [];
      (window as unknown as { __audioCaptureDestinations: MediaStreamAudioDestinationNode[] }).__audioCaptureDestinations = captureDestinations;

      // Replace AudioContext constructor
      (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = class extends OriginalAudioContext {
        private _captureDestination: MediaStreamAudioDestinationNode | null = null;
        private _scriptProcessor: ScriptProcessorNode | null = null;

        constructor(contextOptions?: AudioContextOptions) {
          super(contextOptions);
          this._setupCapture();
        }

        private _setupCapture(): void {
          try {
            // Create destination to capture audio
            this._captureDestination = this.createMediaStreamDestination();
            captureDestinations.push(this._captureDestination);

            // Use ScriptProcessorNode to capture PCM data
            // Buffer size 4096 gives good balance of latency and performance
            this._scriptProcessor = this.createScriptProcessor(4096, 1, 1);

            const captureData = audioCaptureData;
            this._scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
              const inputData = event.inputBuffer.getChannelData(0);
              // Copy samples to our capture array
              for (let i = 0; i < inputData.length; i++) {
                captureData.push(inputData[i]);
              }
            };

            // Connect processor to destination (required for onaudioprocess to fire)
            this._scriptProcessor.connect(this.destination);
          } catch (e) {
            // Capture setup failed, but don't break the audio context
          }
        }

        // Override createGain to auto-connect to capture destination
        createGain(): GainNode {
          const gain = super.createGain();
          this._connectToCapture(gain);
          return gain;
        }

        // Override createOscillator to auto-connect to capture destination
        createOscillator(): OscillatorNode {
          const osc = super.createOscillator();
          this._connectToCapture(osc);
          return osc;
        }

        // Override createBufferSource to auto-connect to capture destination
        createBufferSource(): AudioBufferSourceNode {
          const source = super.createBufferSource();
          this._connectToCapture(source);
          return source;
        }

        private _connectToCapture(node: AudioNode): void {
          // Store original connect method
          const originalConnect = node.connect.bind(node);

          // Override connect to also capture the audio
          node.connect = (destination: AudioNode | AudioParam, outputIndex?: number, inputIndex?: number) => {
            // Call original connect
            const result = originalConnect(destination as AudioNode, outputIndex, inputIndex);

            // Also connect to our capture destination if it's an AudioNode
            if (this._captureDestination && destination !== this._captureDestination && destination instanceof AudioNode) {
              try {
                originalConnect(this._captureDestination);
              } catch {
                // Ignore connection errors
              }
            }

            return result;
          };
        }
      };

      // Also intercept webkitAudioContext if it exists
      if ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) {
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
      }

      // Hook into Tone.js if it loads later
      const hookTone = () => {
        const Tone = (window as unknown as { Tone?: { context: { rawContext: AudioContext } } }).Tone;
        if (Tone?.context?.rawContext) {
          // Tone.js uses its own context, replace it with our intercepted version
          const NewContext = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
          const newCtx = new NewContext();
          Tone.context.rawContext = newCtx;
        }
      };

      // Try to hook now and also set up a periodic check
      hookTone();
      setInterval(hookTone, 100);
    });
  }

  /**
   * Trigger audio playback for Tone.js or Strudel content.
   * This clicks the play button or calls play functions to ensure audio is actually playing.
   */
  private async triggerAudioPlayback(page: Page, domain: RenderDomain): Promise<void> {
    try {
      // Wait a short time for the page to initialize
      await page.waitForTimeout(500);

      if (domain === 'tone') {
        // For Tone.js: try to find and click the play button, or call play()/Tone.start()
        await page.evaluate(async () => {
          // Try to find and click a play button
          const playBtn = document.getElementById('playBtn') ||
                          document.querySelector('button');
          if (playBtn) {
            (playBtn as HTMLButtonElement).click();
            return;
          }

          // Try to call play() if it exists globally
          const w = window as unknown as { play?: () => void | Promise<void>; Tone?: { start: () => Promise<void> } };
          if (typeof w.play === 'function') {
            await w.play();
          } else if (w.Tone?.start) {
            await w.Tone.start();
          }
        });
      } else if (domain === 'strudel') {
        // For Strudel: try to start playback via the global controls or click play button
        await page.evaluate(async () => {
          // Try to click play button
          const playBtn = document.getElementById('playBtn') ||
                          document.querySelector('button');
          if (playBtn) {
            (playBtn as HTMLButtonElement).click();
            return;
          }

          // Try to use Strudel's global controls if available
          const w = window as unknown as { controls?: { start: () => Promise<void> } };
          if (w.controls?.start) {
            await w.controls.start();
          }
        });
      }

      // Wait for audio to actually start
      await page.waitForTimeout(500);
    } catch (error) {
      Logger.debug('HeadlessRenderer', 'Failed to trigger audio playback:', error);
      // Non-fatal - audio might auto-play or not be needed
    }
  }

  /**
   * Capture audio output from the page
   * Uses Web Audio API to capture real audio data
   */
  private async captureAudio(page: Page, opts: Required<RenderOptions>): Promise<AudioCaptureResult> {
    try {
      // Wait for audio to be captured during the stabilization period
      await page.waitForTimeout(opts.stabilizationTime);

      // Retrieve the captured audio data
      const audioData = await page.evaluate((duration: number) => {
        const captureData = (window as unknown as { __audioCaptureData?: number[] }).__audioCaptureData;

        if (!captureData || captureData.length === 0) {
          // No audio captured - return empty result
          return {
            samples: [] as number[],
            sampleRate: 44100,
            duration: duration / 1000,
            hasAudio: false,
          };
        }

        // Calculate actual duration based on sample rate
        const sampleRate = 44100; // Standard Web Audio sample rate
        const durationSec = duration / 1000;
        const expectedSamples = Math.floor(sampleRate * durationSec);

        // Trim or pad to expected length
        let samples: number[];
        if (captureData.length >= expectedSamples) {
          samples = captureData.slice(0, expectedSamples);
        } else {
          // Pad with zeros if we didn't get enough samples
          samples = [...captureData, ...new Array(expectedSamples - captureData.length).fill(0)];
        }

        return {
          samples,
          sampleRate,
          duration: durationSec,
          hasAudio: true,
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
