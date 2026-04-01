/**
 * BrowserLauncher - Open browser preview for complex content
 * 
 * Launches PreviewServer and opens browser automatically
 */

import open from 'open';
import path from 'node:path';
import { PreviewServer } from '../../render/PreviewServer.js';
import { Exporter } from '../../export/Exporter.js';

export class BrowserLauncher {
  private previewServer?: PreviewServer;
  private exporter: Exporter;
  private currentPort: number = 3456;
  private lastPreviewUrl?: string;

  constructor() {
    this.exporter = new Exporter();
  }

  /**
   * Start PreviewServer if not running
   */
  async ensureServer(): Promise<number> {
    if (!this.previewServer) {
      this.previewServer = new PreviewServer({
        galleryDir: './gallery',
      });
      
      await this.previewServer.start();
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
    
    // Generate temporary HTML file
    void this.generatePreviewHTML(code, type);  // Placeholder for future use
    
    // Export to temp file
    const tempPath = path.join(process.cwd(), '.liminal', 'preview', `preview-${Date.now()}.html`);
    await this.exporter.exportHTML(code, tempPath);
    
    // Open in browser
    const url = `http://localhost:${port}/preview/${path.basename(tempPath)}`;
    await open(url);
    
    this.lastPreviewUrl = url;
    return url;
  }

  /**
   * Preview file in browser
   */
  async previewFile(filePath: string): Promise<string> {
    const port = await this.ensureServer();
    const url = `http://localhost:${port}/preview/${path.basename(filePath)}`;
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
  private generatePreviewHTML(code: string, _type: string): string {
    // This would generate appropriate HTML wrapper
    // Similar to what PreviewServer already does
    return code;
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
