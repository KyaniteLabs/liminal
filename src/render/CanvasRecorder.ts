import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { VideoExporter } from '../export/VideoExporter.js';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import { Domain } from '../types/domains.js';

export interface RecordingOptions {
  fps: number;
  duration: number;  // seconds
  width: number;
  height: number;
}

export interface RecordingConfig extends RecordingOptions {
  totalFrames: number;
}

export class CanvasRecorder {
  private readonly config: RecordingConfig;
  private readonly exporter: VideoExporter;

  constructor(options: RecordingOptions) {
    if (options.fps <= 0) throw new Error('fps must be a positive number');
    if (options.duration <= 0) throw new Error('duration must be a positive number');
    if (options.width <= 0) throw new Error('width must be a positive number');
    if (options.height <= 0) throw new Error('height must be a positive number');

    this.config = {
      fps: options.fps,
      duration: options.duration,
      width: options.width,
      height: options.height,
      totalFrames: Math.floor(options.fps * options.duration),
    };
    this.exporter = new VideoExporter();
  }

  getConfig(): RecordingConfig {
    return { ...this.config };
  }

  /**
   * Record a creative code sketch as video.
   * Uses Puppeteer to load the code in a headless browser, step through frames,
   * capture canvas screenshots, then stitch into MP4 via FFmpeg.
   */
  async record(code: string, domain: Domain, outputPath: string): Promise<string> {
    // Dynamic import to avoid loading Puppeteer at module level
    const puppeteer = await import('puppeteer');

    const framesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'liminal-frames-'));

    try {
      const browser = await puppeteer.default.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: this.config.width, height: this.config.height });

        // Wrap code for rendering
        const html = this.wrapForDomain(code, domain);
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // Wait for canvas to appear
        await page.waitForSelector('canvas', { timeout: 10000 });

        // Capture frames
        for (let frame = 0; frame < this.config.totalFrames; frame++) {
          // Advance animation by one frame
          const frameDelay = 1000 / this.config.fps;
          await page.evaluate((delay) => {
            return new Promise(resolve => setTimeout(resolve, delay));
          }, frameDelay);

          // Screenshot the canvas
          const canvas = await page.$('canvas');
          if (canvas) {
            const framePath = path.join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`);
            await canvas.screenshot({ path: framePath, type: 'png' });
          }
        }

        // Stitch frames into video
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await this.exporter.framesToVideo(framesDir, outputPath, this.config.fps);

        return outputPath;
      } finally {
        await browser.close();
      }
    } finally {
      // Clean up frames
      try {
        await fs.rm(framesDir, { recursive: true, force: true });
      } catch (error) {
        const message = this.formatErrorMessage(error);
        console.error('[CanvasRecorder] Cleanup failed:', message);
        throw new Error(`CanvasRecorder cleanup failed: ${message}`);
      }
    }
  }

  /**
   * Build the JavaScript to execute in the browser for capturing a single frame.
   */
  buildFrameCaptureScript(_domain: string): string {
    // All domains use the same canvas capture mechanism
    return `
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return canvas.toDataURL('image/png');
    `;
  }

  private formatErrorMessage(error: unknown): string {
    return formatError('CanvasRecorder', error);
  }

  private wrapForDomain(code: string, domain: Domain): string {
    if (domain === Domain.P5) {
      return HTMLWrapper.wrap(code);
    }
    // Accept 'shader' domain; also handle any non-Domain string that looks like GLSL
    if (domain === Domain.SHADER) {
      return HTMLWrapper.wrap(code, { domain: 'shader' as any });
    }
    if (domain === Domain.THREE) {
      // Three.js code may already be complete HTML
      if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
        return code;
      }
      return HTMLWrapper.wrap(code, { domain: 'three' as any });
    }
    // Default: wrap as p5
    return HTMLWrapper.wrap(code);
  }
}
