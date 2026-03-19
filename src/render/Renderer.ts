/**
 * Renderer - Screenshot capture for p5.js sketches
 *
 * Provides functionality to render p5.js sketches using a headless browser
 * and capture screenshots of the canvas output.
 */

import puppeteer, { Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export class Renderer {
  private readonly RENDER_TIMEOUT = 30000; // 30 seconds (increased from 10s for CDN reliability)
  private readonly DEFAULT_WIDTH = 800;
  private readonly DEFAULT_HEIGHT = 600;

  /**
   * Render a p5.js sketch and capture screenshot
   * @param code - p5.js sketch code
   * @param outputPath - Path where screenshot will be saved
   * @throws Error if rendering fails or output path is invalid
   */
  async render(code: string, outputPath: string): Promise<void> {
    // Validate inputs
    if (!code || typeof code !== 'string') {
      throw new Error('Sketch code is required and must be a non-empty string');
    }

    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('Output path is required and must be a string');
    }

    // Validate output directory exists
    const outputDir = path.dirname(outputPath);
    try {
      await fs.access(outputDir);
    } catch {
      throw new Error(`Output directory does not exist: ${outputDir}`);
    }

    // Validate file extension
    const ext = path.extname(outputPath).toLowerCase();
    if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
      throw new Error(`Unsupported file format: ${ext}. Only .png, .jpg, .jpeg are supported.`);
    }

    let browser = null;
    let page = null;

    try {
      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      page = await browser.newPage();

      // Set viewport size
      await page.setViewport({
        width: this.DEFAULT_WIDTH,
        height: this.DEFAULT_HEIGHT
      });

      // Generate HTML with p5.js sketch
      const html = this.generateHTML(code);

      // Load the sketch - use 'load' instead of 'networkidle0' for CDN resilience
      // 'load' waits for DOM + resources, but not all network activity to cease
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: this.RENDER_TIMEOUT
      });

      // Wait for p5.js to initialize
      await this.waitForP5Initialization(page);

      // Wait a bit for the sketch to render
      await this.delay(1000);

      // Get the canvas element
      const canvas = await page.$('canvas');

      if (!canvas) {
        throw new Error('No canvas element found. The sketch may have failed to initialize.');
      }

      // Take screenshot of the canvas
      await canvas.screenshot({
        path: outputPath,
        type: ext === '.png' ? 'png' : 'jpeg'
      });

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to render sketch: ${error.message}`);
      }
      throw new Error('Failed to render sketch: Unknown error');
    } finally {
      // Clean up
      if (page) {
        await page.close().catch(() => {});
      }
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  private generateHTML(code: string): string {
    if (this.isShaderCode(code)) {
      return this.generateShaderHTML(code);
    }
    if (this.isThreeJSCode(code)) {
      return code; // Three.js sketches are already full HTML
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atelier Renderer</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>${code.replace(/<\/script>/gi, '<\\/script>')}</script>
</body>
</html>`;
  }

  private async waitForP5Initialization(page: Page): Promise<void> {
    try {
      await page.waitForSelector('canvas', { timeout: 10000 });
    } catch (error) {
      await this.delay(500);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Detect GLSL fragment shader code
   */
  private isShaderCode(code: string): boolean {
    return /void\s+main\s*\(/.test(code) && /gl_FragColor|out\s+vec4/.test(code);
  }

  /**
   * Detect Three.js code (full HTML with importmap or three import)
   */
  private isThreeJSCode(code: string): boolean {
    return /<script\s+type="importmap">/.test(code) || /import.*from\s+['"]three['"]/.test(code);
  }

  /**
   * Generate full-page WebGL2 HTML wrapping a GLSL fragment shader
   */
  private generateShaderHTML(code: string): string {
    // Escape </script> in shader code
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Atelier Shader</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="gl"></canvas>
  <script>
    const canvas = document.getElementById('gl');
    const gl = canvas.getContext('webgl2');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vs = \`#version 300 es
    in vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\`;

    const fs = \`#version 300 es
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    out vec4 fragColor;

    ${safeCode.replace(/^precision\s+highp\s+float;?\s*$/m, '').replace(/void\s+main\s*\(\s*void\s*\)/, 'void main()').replace(/gl_FragColor/g, 'fragColor')}
    \`;

    function createShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return s;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

    function frame(t) {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t * 0.001);
      gl.uniform2f(uMouse, mouseX, canvas.height - mouseY);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  </script>
</body>
</html>`;
  }
}
