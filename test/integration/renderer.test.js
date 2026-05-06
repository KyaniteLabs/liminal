import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
/**
 * Integration tests for Renderer
 *
 * Tests screenshot capture functionality with headless browser.
 */

import { Renderer } from '../../src/render/Renderer.js';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// Increase timeout for integration tests involving browser automation
const RENDER_TIMEOUT = 30000; // 30 seconds

describe('Renderer Integration Tests', () => {
  let renderer;
  const testOutputDir = './test-output';
  const testImagePath = path.join(testOutputDir, 'test-screenshot.png');

  beforeAll(async () => {
    // Create test output directory
    try {
      await fs.mkdir(testOutputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    renderer = new Renderer();
  });

  afterAll(async () => {
    await Renderer.closeBrowser();

    // Clean up test files
    try {
      if (existsSync(testImagePath)) {
        await fs.unlink(testImagePath);
      }
      if (existsSync(testOutputDir)) {
        await fs.rmdir(testOutputDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up test screenshots after each test
    try {
      if (existsSync(testImagePath)) {
        await fs.unlink(testImagePath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('render(code, outputPath)', () => {
    it('should render a simple p5.js sketch and capture screenshot', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(255, 0, 0);
        }
        function draw() {
          noLoop();
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      // Verify screenshot file was created
      expect(existsSync(testImagePath)).toBe(true);

      // Verify it's a valid PNG file
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);

    it('should render animated sketches', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          frameRate(30);
        }
        function draw() {
          background(0, 255, 0);
          ellipse(frameCount % 400, 200, 50, 50);
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);

    it('should render interactive sketches', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(0, 0, 255);
        }
        function draw() {
          if (mouseIsPressed) {
            fill(255);
            ellipse(mouseX, mouseY, 20, 20);
          }
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);

    it('should handle particle system sketches', async () => {
      const sketchCode = `
        let particles = [];

        function setup() {
          createCanvas(400, 400);
          for (let i = 0; i < 100; i++) {
            particles.push({
              x: random(width),
              y: random(height),
              vx: random(-1, 1),
              vy: random(-1, 1)
            });
          }
        }

        function draw() {
          background(0, 0, 0, 50);
          fill(255);
          noStroke();

          for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;

            ellipse(p.x, p.y, 5, 5);
          }
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);

    it('should throw error for invalid code', async () => {
      const invalidCode = `
        function setup() {
          createCanvas(400, 400);
        }
        // Missing closing brace - syntax error
        function draw() {
          background(255);
      `;

      await expect(renderer.render(invalidCode, testImagePath)).rejects.toThrow();
    }, RENDER_TIMEOUT);

    it('should throw error for empty code', async () => {
      await expect(renderer.render('', testImagePath)).rejects.toThrow();
    });

    it('should throw error for null code', async () => {
      await expect(renderer.render(null, testImagePath)).rejects.toThrow();
    });

    it('should handle complex sketches with multiple functions', async () => {
      const complexCode = `
        let t = 0;

        function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
        }

        function draw() {
          background(0, 0, 0, 0.1);

          for (let i = 0; i < 50; i++) {
            let x = width/2 + cos(t + i * 0.1) * (100 + sin(t * 2) * 50);
            let y = height/2 + sin(t + i * 0.1) * (100 + cos(t * 2) * 50);
            fill((t * 10 + i * 5) % 360, 80, 90);
            ellipse(x, y, 10, 10);
          }

          t += 0.02;
        }

        function mousePressed() {
          t = random(100);
        }

        function windowResized() {
          resizeCanvas(windowWidth, windowHeight);
        }
      `;

      await renderer.render(complexCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);
  });

  describe('error handling', () => {
    it('should throw error for invalid output path', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(255);
        }
      `;

      const invalidPath = '/nonexistent/directory/screenshot.png';

      await expect(renderer.render(sketchCode, invalidPath)).rejects.toThrow();
    });

    it('should throw error for unsupported file format', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(255);
        }
      `;

      const unsupportedPath = path.join(testOutputDir, 'test.xyz');

      await expect(renderer.render(sketchCode, unsupportedPath)).rejects.toThrow();
    }, RENDER_TIMEOUT);
  });

  describe('screenshot quality', () => {
    it('should produce screenshots with reasonable dimensions', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(800, 600);
          background(128, 128, 128);
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);

      // File should be reasonably sized for an 800x600 PNG
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      expect(stats.size).toBeLessThan(500000); // Less than 500KB (compression)
    }, RENDER_TIMEOUT);

    it('should capture full canvas content', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(255, 0, 0); // Red background
          noStroke();

          // Draw something in each corner
          fill(0, 255, 0);
          rect(0, 0, 50, 50); // Top-left
          rect(350, 0, 50, 50); // Top-right
          rect(0, 350, 50, 50); // Bottom-left
          rect(350, 350, 50, 50); // Bottom-right
        }
      `;

      await renderer.render(sketchCode, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
      const stats = await fs.stat(testImagePath);
      expect(stats.size).toBeGreaterThan(0);
    }, RENDER_TIMEOUT);
  });

  describe('edge cases', () => {
    it('should handle sketches with no draw function', async () => {
      const staticSketch = `
        function setup() {
          createCanvas(400, 400);
          background(255, 255, 0);
          fill(0);
          ellipse(200, 200, 100, 100);
        }
        // No draw function - should still work
      `;

      await renderer.render(staticSketch, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
    }, RENDER_TIMEOUT);

    it('should handle sketches with windowResized', async () => {
      const responsiveSketch = `
        function setup() {
          createCanvas(400, 400);
          background(0, 255, 255);
        }

        function draw() {
          background(0, 255, 255);
          fill(255);
          rect(mouseX, mouseY, 50, 50);
        }

        function windowResized() {
          resizeCanvas(windowWidth, windowHeight);
        }
      `;

      await renderer.render(responsiveSketch, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
    }, RENDER_TIMEOUT);

    it('should handle unicode in comments', async () => {
      const unicodeSketch = `
        // 日本語のコメント - Japanese comments
        // Emoji test: 🎨 🖼️ ✨

        function setup() {
          createCanvas(400, 400);
          background(255);
        }

        function draw() {
          background(255);
          // Draw something simple
          fill(255, 0, 255);
          ellipse(200, 200, 100, 100);
        }
      `;

      await renderer.render(unicodeSketch, testImagePath);

      expect(existsSync(testImagePath)).toBe(true);
    }, RENDER_TIMEOUT);
  });
});
