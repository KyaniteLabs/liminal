/**
 * BrowserLauncher - Open browser preview for complex content
 * 
 * Launches PreviewServer and opens browser automatically
 */

import open from 'open';
import path from 'node:path';
import fs from 'node:fs/promises';
import { PreviewServer } from '../../render/PreviewServer.js';
import { HTMLWrapper, type Domain } from '../../utils/htmlWrapper.js';
import { validateBrowserPreviewPath } from './previewSafety.js';

export class BrowserLauncher {
  private previewServer?: PreviewServer;
  private currentPort: number = 3456;
  private lastPreviewUrl?: string;

  constructor() {}

  /**
   * Start PreviewServer if not running
   */
  async ensureServer(): Promise<number> {
    if (!this.previewServer) {
      this.previewServer = new PreviewServer({
        galleryDir: './gallery',
      });
      
      await this.previewServer.start();
      this.currentPort = this.previewServer.getPort() ?? this.currentPort;
    }
    
    return this.currentPort;
  }

  /**
   * Stop PreviewServer
   */
  async stopServer(): Promise<void> {
    if (this.previewServer) {
      await this.previewServer.stop();
      this.previewServer = undefined;
    }
  }

  /**
   * Preview code in browser
   */
  async previewCode(code: string, type: 'p5' | 'glsl' | 'three' | 'hydra' | 'strudel' | 'tone' | 'html' | 'ascii'): Promise<string> {
    const port = await this.ensureServer();
    const html = this.generatePreviewHTML(code, type);
    this.previewServer?.serveSketch(html);
    
    // Open in browser
    const url = `http://localhost:${port}/preview`;
    await open(url);
    
    this.lastPreviewUrl = url;
    return url;
  }

  /**
   * Preview file in browser
   */
  async previewFile(filePath: string): Promise<string> {
    const validationError = validateBrowserPreviewPath(filePath);
    if (validationError) {
      throw new Error(validationError);
    }

    const port = await this.ensureServer();
    const ext = path.extname(filePath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext)) {
      await open(filePath);
      this.lastPreviewUrl = filePath;
      return filePath;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    this.previewServer?.serveSketch(ext === '.svg' ? this.wrapSvgForPreview(content) : content);
    const url = `http://localhost:${port}/preview`;
    await open(url);
    
    this.lastPreviewUrl = url;
    return url;
  }

  /**
   * Re-open last preview
   */
  async reopenLast(): Promise<string | null> {
    if (this.lastPreviewUrl) {
      await open(this.lastPreviewUrl);
      return this.lastPreviewUrl;
    }
    return null;
  }

  /**
   * Generate preview HTML based on type
   */
  private generatePreviewHTML(code: string, type: 'p5' | 'glsl' | 'three' | 'hydra' | 'strudel' | 'tone' | 'html' | 'ascii'): string {
    const domain: Domain = type === 'glsl' ? 'shader' : type;
    const includeP5Sound = domain === 'p5' && /p5\.sound|loadSound|createAudio|userStartAudio|getAudioContext/i.test(code);
    return HTMLWrapper.wrap(code, { domain, title: `${type} Preview`, includeP5Sound });
  }

  private wrapSvgForPreview(svg: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SVG Preview</title>
<style>html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#f8fafc}svg{max-width:96vw;max-height:96vh}</style>
</head>
<body>
${svg}
</body>
</html>`;
  }

  /**
   * Get preview URL for type
   */
  getPreviewUrl(type: string, id: string): string {
    return `http://localhost:${this.currentPort}/preview/${type}/${id}`;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return !!this.previewServer;
  }

  /**
   * Get server info
   */
  getInfo(): { running: boolean; port: number; lastUrl?: string } {
    return {
      running: this.isRunning(),
      port: this.currentPort,
      lastUrl: this.lastPreviewUrl,
    };
  }
}

export const browserLauncher = new BrowserLauncher();
