/**
 * PreviewServer - Express server for live p5.js sketch preview
 *
 * Provides a local HTTP server that serves p5.js sketches in real-time.
 * Supports starting/stopping the server and dynamically updating sketch code.
 */

import express, { Express } from 'express';
import { Server } from 'http';

export class PreviewServer {
  private app: Express;
  private server: Server | null = null;
  private currentSketch: string = '';
  private readonly DEFAULT_PORT = 3456;

  constructor() {
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup Express routes for serving sketches
   */
  private setupRoutes(): void {
    this.app.get('/', (_req, res) => {
      const html = this.generateHTML(this.currentSketch);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
  }

  /**
   * Generate HTML page with p5.js sketch
   */
  private generateHTML(sketchCode: string): string {
    const escapedCode = this.escapeHTML(sketchCode);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atelier Preview</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #000;
    }
    canvas {
      display: block;
    }
  </style>
</head>
<body>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <script>
    ${escapedCode}
  </script>
</body>
</html>`;
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  private escapeHTML(code: string): string {
    if (!code) return '';

    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Start the Express server
   * @param port - Port number (default: 3456)
   * @returns true if started successfully
   */
  async start(port: number = this.DEFAULT_PORT): Promise<boolean> {
    // Validate port number
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid port number: ${port}. Port must be between 1 and 65535.`);
    }

    // If this server instance is already running, reject
    if (this.server) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      // Create server first
      this.server = this.app.listen(port)
        .on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            this.server = null;
            reject(new Error(`Port ${port} is already in use`));
          } else {
            this.server = null;
            reject(error);
          }
        })
        .on('listening', () => {
          resolve(true);
        });
    });
  }

  /**
   * Stop the Express server
   * @returns true if stopped successfully
   */
  async stop(): Promise<boolean> {
    if (!this.server) {
      return false;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve(true);
      });

      // Handle case where server might already be closed
      this.server?.on('error', () => {
        this.server = null;
        resolve(true);
      });
    });
  }

  /**
   * Serve a p5.js sketch
   * @param code - p5.js sketch code
   */
  serveSketch(code: string | null): void {
    this.currentSketch = code || '';
  }
}