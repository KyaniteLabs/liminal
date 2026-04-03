/**
 * Renderer - Screenshot capture for p5.js sketches
 *
 * Provides functionality to render p5.js sketches using a headless browser
 * and capture screenshots of the canvas output. Uses a shared browser
 * instance (browser pool) to avoid launching a new Chromium process per render.
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';
import { HTMLWrapper } from '../utils/htmlWrapper.js';
import { validateString } from '../utils/validation.js';

export class Renderer {
  private readonly RENDER_TIMEOUT = 30000;
  private readonly DEFAULT_WIDTH = 800;
  private readonly DEFAULT_HEIGHT = 600;

  /** Shared browser instance — launched once, reused across render() calls. */
  private static browser: Browser | null = null;
  private static browserLaunching: Promise<Browser> | null = null;

  /**
   * Get or create the shared browser instance.
   */
  private static async getBrowser(): Promise<Browser> {
    if (Renderer.browser) return Renderer.browser;
    if (Renderer.browserLaunching) return Renderer.browserLaunching;
    Renderer.browserLaunching = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      // eslint-disable-next-line require-atomic-updates
      Renderer.browser = await Renderer.browserLaunching;
      return Renderer.browser;
    } catch (err) {
      // eslint-disable-next-line require-atomic-updates
      Renderer.browserLaunching = null;
      throw err;
    }
  }

  /**
   * Close the shared browser instance. Call when done rendering.
   */
  static async closeBrowser(): Promise<void> {
    if (Renderer.browser) {
      await Renderer.browser.close().catch((err) => {
        Logger.warn('Renderer', `Failed to close browser: ${err instanceof Error ? err.message : err}`);
      });
      // eslint-disable-next-line require-atomic-updates
      Renderer.browser = null;
    }
    // eslint-disable-next-line require-atomic-updates
    Renderer.browserLaunching = null;
  }

  /**
   * Render a p5.js sketch and capture screenshot
   * @param code - p5.js sketch code
   * @param outputPath - Path where screenshot will be saved
   * @throws Error if rendering fails or output path is invalid
   */
  async render(code: string, outputPath: string): Promise<void> {
    validateString(code, 'Sketch code');
    validateString(outputPath, 'Output path');

    const outputDir = path.dirname(outputPath);
    try {
      await fs.access(outputDir);
    } catch (accessError) {
      throw new Error(`Output directory does not exist: ${outputDir}`);
    }

    const ext = path.extname(outputPath).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      throw new Error(`Unsupported file format: ${ext}. Only .png, .jpg, .jpeg are supported.`);
    }

    let page: Page | null = null;

    try {
      const browser = await Renderer.getBrowser();
      page = await browser.newPage();

      await page.setViewport({
        width: this.DEFAULT_WIDTH,
        height: this.DEFAULT_HEIGHT,
      });

      const html = this.generateHTML(code);

      await page.setContent(html, {
        waitUntil: 'load',
        timeout: this.RENDER_TIMEOUT,
      });

      await this.waitForP5Initialization(page);
      await this.delay(1000);

      const canvas = await page.$('canvas');
      if (!canvas) {
        throw new Error('No canvas element found. The sketch may have failed to initialize.');
      }

      await canvas.screenshot({
        path: outputPath,
        type: ext === '.png' ? 'png' : 'jpeg',
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to render sketch: ${error.message}`);
      }
      throw new Error('Failed to render sketch: Unknown error');
    } finally {
      if (page) {
        await page.close().catch((err) => {
          Logger.warn('Renderer', `Failed to close page: ${err instanceof Error ? err.message : err}`);
        });
      }
    }
  }

  private generateHTML(code: string): string {
    return HTMLWrapper.wrap(code);
  }

  private async waitForP5Initialization(page: Page): Promise<void> {
    try {
      await page.waitForSelector('canvas', { timeout: 10000 });
    } catch (waitError) {
      await this.delay(500);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
