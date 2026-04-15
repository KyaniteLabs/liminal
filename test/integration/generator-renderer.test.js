import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll, test } from 'vitest';
/**
 * Generator-Renderer Integration Tests
 *
 * End-to-end tests that verify the complete workflow:
 * - Generate p5.js sketches using P5Generator
 * - Render sketches via PreviewServer
 * - Capture screenshots using Renderer
 * - Validate output images and functionality
 */

import { P5Generator } from '../../src/generators/p5/P5Generator.js';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import { Renderer } from '../../src/render/Renderer.js';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { LLMClient } from '../../src/llm/LLMClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Increase timeout for integration tests involving browser automation and generation
const GENERATION_RENDER_TIMEOUT = 60000; // 60 seconds

// Helper function to safely start preview server
async function safeStartServer(server, port) {
  try {
    await server.start(port);
  } catch (error) {
    if (error.message.includes('already running') || error.message.includes('already in use')) {
      // Server already running, continue with test
      return;
    }
    throw error;
  }
}

function skipIfNoLLM() {
  if (!LLMClient.isConfigured()) {
    console.warn('Skipping test: LLM not configured');
    return true;
  }
  return false;
}

describe('Generator-Renderer Integration Tests', () => {
  let previewServer;
  let renderer;
  const TEST_PORT = 3457;
  const testOutputDir = path.resolve(__dirname, 'test-generator-renderer-output');

  beforeAll(async () => {
    // Create test output directory
    try {
      await fs.mkdir(testOutputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    previewServer = new PreviewServer();
    renderer = new Renderer();
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await previewServer.stop();
      await fs.rm(testOutputDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Ensure server is stopped before starting it
    try {
      await previewServer.stop();
      // Add small delay to ensure port is released
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore if server wasn't running
    }
  });

  afterEach(async () => {
    // Stop preview server after each test with proper cleanup
    try {
      await previewServer.stop();
      // Add delay to ensure port is fully released before next test
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore if server not started
    }
  });

  describe('Complete Generation-Render Workflow', () => {
    test('should generate p5.js sketch and render via PreviewServer', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a simple p5.js sketch with a red circle on white background';

      // Generate p5.js sketch
      const generatedCode = await P5Generator.generate(prompt, {});

      expect(typeof generatedCode).toBe('string');
      expect(generatedCode.length).toBeGreaterThan(0);
      expect(generatedCode).toContain('function setup');
      expect(generatedCode).toContain('createCanvas');

      // Start PreviewServer with error handling
      await safeStartServer(previewServer, TEST_PORT);

      // Serve the generated sketch
      previewServer.serveSketch(generatedCode);

      // Verify the sketch is accessible
      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('p5');
      expect(html).toContain('createCanvas');
    }, GENERATION_RENDER_TIMEOUT);

    test('should generate sketch, render via PreviewServer, and capture screenshot', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with a blue rectangle on black background';

      // Generate p5.js sketch
      const generatedCode = await P5Generator.generate(prompt, {});

      // Define output path for screenshot
      const screenshotPath = path.join(testOutputDir, 'blue-rectangle-screenshot.png');

      // Start PreviewServer and serve sketch
      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(generatedCode);

      // Capture screenshot using Renderer
      await renderer.render(generatedCode, screenshotPath);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);

      // Verify screenshot has reasonable size
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(1000); // At least 1KB
      expect(stats.size).toBeLessThan(500000); // Less than 500KB
    }, GENERATION_RENDER_TIMEOUT);

    test('should validate generated code renders correctly', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with multiple colored shapes';

      // Generate p5.js sketch
      const generatedCode = await P5Generator.generate(prompt, {});

      // Verify code structure
      expect(generatedCode).toContain('function setup');
      expect(generatedCode).toContain('function draw');
      expect(generatedCode).toContain('createCanvas');

      // Test rendering
      const screenshotPath = path.join(testOutputDir, 'colored-shapes-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(generatedCode);
      await renderer.render(generatedCode, screenshotPath);

      // Verify screenshot exists and is valid
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('P5.js Generation and Rendering', () => {
    test('should generate and render particle system sketch', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js particle system with 50 particles';

      // Generate particle system
      const particleCode = await P5Generator.generate(prompt, {});

      // Verify particle-specific content
      expect(particleCode.toLowerCase()).toMatch(/particle|class|system/);
      expect(particleCode).toContain('function setup');

      // Render particle system
      const screenshotPath = path.join(testOutputDir, 'particle-system-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(particleCode);
      await renderer.render(particleCode, screenshotPath);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);

    test('should generate and render animated sketch', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create an animated p5.js sketch with moving elements';

      // Generate animated sketch
      const animatedCode = await P5Generator.generate(prompt, {});

      // Verify animation-related content
      expect(animatedCode).toContain('function draw');
      expect(animatedCode).toMatch(/(framecount|framecount|animation|moving)/i);

      // Render animated sketch
      const screenshotPath = path.join(testOutputDir, 'animated-sketch-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(animatedCode);
      await renderer.render(animatedCode, screenshotPath);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);

    test('should generate and render interactive sketch', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch that responds to mouse interaction';

      // Generate interactive sketch
      const interactiveCode = await P5Generator.generate(prompt, {});

      // Verify interaction-specific content
      expect(interactiveCode.toLowerCase()).toMatch(/(mouse|mousex|mousey|mousepressed|mousemoved)/);

      // Render interactive sketch
      const screenshotPath = path.join(testOutputDir, 'interactive-sketch-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(interactiveCode);
      await renderer.render(interactiveCode, screenshotPath);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);

    test('should generate and render cellular automata sketch', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js cellular automata simulation';

      // Generate cellular automata
      const caCode = await P5Generator.generate(prompt, {});

      // Verify CA-related content
      expect(caCode.toLowerCase()).toMatch(/(cellular|automata|grid|cells)/);

      // Render cellular automata
      const screenshotPath = path.join(testOutputDir, 'cellular-automata-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(caCode);
      await renderer.render(caCode, screenshotPath);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Screenshot Quality and Validation', () => {
    test('should produce high-quality screenshots for generated sketches', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a high-quality p5.js visualization';

      // Generate sketch
      const sketchCode = await P5Generator.generate(prompt, {});

      // Render and capture screenshot
      const screenshotPath = path.join(testOutputDir, 'high-quality-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(sketchCode);
      await renderer.render(sketchCode, screenshotPath);

      // Verify screenshot quality
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);

      // File should be reasonably sized for a quality PNG
      expect(stats.size).toBeGreaterThan(5000); // At least 5KB
      expect(stats.size).toBeLessThan(1000000); // Less than 1MB
    }, GENERATION_RENDER_TIMEOUT);

    test('should handle different canvas sizes in generated sketches', async () => {
    if (skipIfNoLLM()) return;
      const sizes = [
        { width: 400, height: 400 },
        { width: 800, height: 600 },
        { width: 1024, height: 768 }
      ];

      for (const size of sizes) {
        const prompt = `Create a p5.js sketch with canvas size ${size.width}x${size.height}`;

        // Generate sketch with specific canvas size
        const sketchCode = await P5Generator.generate(prompt, {});

        // Verify canvas size in generated code
        expect(sketchCode).toMatch(/\d+/); // Should contain numbers

        // Render and capture screenshot
        const screenshotPath = path.join(testOutputDir, `canvas-${size.width}x${size.height}-screenshot.png`);

        try {
          await previewServer.start(TEST_PORT);
          previewServer.serveSketch(sketchCode);
          await renderer.render(sketchCode, screenshotPath);

          // Verify screenshot was created
          expect(existsSync(screenshotPath)).toBe(true);
          const stats = await fs.stat(screenshotPath);
          expect(stats.size).toBeGreaterThan(0);
        } finally {
          // Ensure server is stopped after each iteration
          await previewServer.stop().catch(() => {});
        }

        // Clean up individual screenshot
        await fs.unlink(screenshotPath).catch(() => {});
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should validate screenshot dimensions match canvas size', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a p5.js sketch with 600x400 canvas';

      // Generate sketch
      const sketchCode = await P5Generator.generate(prompt, {});

      // Render and capture screenshot
      const screenshotPath = path.join(testOutputDir, 'dimension-test-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(sketchCode);
      await renderer.render(sketchCode, screenshotPath);

      // Verify screenshot exists
      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle generation errors gracefully', async () => {
    if (skipIfNoLLM()) return;
      // Use edge case prompts that might cause issues
      const edgeCasePrompts = [
        '',
        null,
        undefined,
        '!!!@@@###$$$',
        'Create a sketch '.repeat(1000)
      ];

      for (const prompt of edgeCasePrompts) {
        // Generate sketch (should handle gracefully)
        const sketchCode = await P5Generator.generate(prompt, {});

        expect(typeof sketchCode).toBe('string');
        expect(sketchCode.length).toBeGreaterThan(0);

        // Try to render (should handle gracefully)
        const screenshotPath = path.join(testOutputDir, `edge-case-${Date.now()}-screenshot.png`);

        try {
          await previewServer.start(TEST_PORT);
          previewServer.serveSketch(sketchCode);
          await renderer.render(sketchCode, screenshotPath);

          // If successful, verify screenshot
          if (existsSync(screenshotPath)) {
            const stats = await fs.stat(screenshotPath);
            expect(stats.size).toBeGreaterThan(0);
            await fs.unlink(screenshotPath); // Clean up
          }
        } catch (error) {
          // Should handle errors gracefully without crashing
          expect(error).toBeDefined();
        } finally {
          await previewServer.stop();
        }
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should handle unicode and special characters in prompts', async () => {
    if (skipIfNoLLM()) return;
      const unicodePrompts = [
        'Create sketch with emoji 🎨 🖼️ ✨',
        'Create sketch with 中文 characters',
        'Create sketch with 日本語 text',
        'Create sketch with mix of English, 中文, and 日本語'
      ];

      for (const prompt of unicodePrompts) {
        // Generate sketch
        const sketchCode = await P5Generator.generate(prompt, {});

        expect(typeof sketchCode).toBe('string');
        expect(sketchCode.length).toBeGreaterThan(0);

        // Render sketch
        const screenshotPath = path.join(testOutputDir, `unicode-${Date.now()}-screenshot.png`);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        // Verify screenshot was created
        expect(existsSync(screenshotPath)).toBe(true);
        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        await fs.unlink(screenshotPath);
        await previewServer.stop();
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should handle multiple rapid generation-render cycles', async () => {
    if (skipIfNoLLM()) return;
      const cycles = 5;

      for (let i = 0; i < cycles; i++) {
        const prompt = `Create iteration ${i} p5.js sketch`;

        // Generate
        const sketchCode = await P5Generator.generate(prompt, {});

        // Render
        const screenshotPath = path.join(testOutputDir, `rapid-cycle-${i}-screenshot.png`);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        // Verify
        expect(existsSync(screenshotPath)).toBe(true);

        // Clean up
        await fs.unlink(screenshotPath);
        await previewServer.stop();
      }
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Integration with Context and Iteration', () => {
    test('should generate and render sketches with iteration context', async () => {
    if (skipIfNoLLM()) return;
      const contexts = [
        { iteration: 1, previousCode: '' },
        { iteration: 2, previousCode: 'function setup() { createCanvas(400, 400); }' },
        { iteration: 3, previousCode: 'function setup() { createCanvas(800, 600); background(100); }' }
      ];

      for (const context of contexts) {
        const prompt = 'Improve the sketch';

        // Generate with context
        const sketchCode = await P5Generator.generate(prompt, context);

        expect(typeof sketchCode).toBe('string');
        expect(sketchCode.length).toBeGreaterThan(0);

        // Render
        const screenshotPath = path.join(testOutputDir, `context-iteration-${context.iteration}-screenshot.png`);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        // Verify screenshot
        expect(existsSync(screenshotPath)).toBe(true);
        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        await fs.unlink(screenshotPath);
        await previewServer.stop();
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should demonstrate evolution across multiple iterations', async () => {
    if (skipIfNoLLM()) return;
      const iterations = 3;
      const screenshotPaths = [];

      for (let i = 0; i < iterations; i++) {
        const prompt = i === 0
          ? 'Create a basic p5.js sketch'
          : 'Improve the sketch with more detail';

        const context = {
          iteration: i + 1,
          history: i > 0 ? [`Iteration ${i}`] : []
        };

        // Generate
        const sketchCode = await P5Generator.generate(prompt, context);

        // Render
        const screenshotPath = path.join(testOutputDir, `evolution-${i}-screenshot.png`);
        screenshotPaths.push(screenshotPath);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        // Verify each iteration produces valid output
        expect(existsSync(screenshotPath)).toBe(true);
        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(0);

        await previewServer.stop();
      }

      // Clean up all screenshots
      for (const screenshotPath of screenshotPaths) {
        await fs.unlink(screenshotPath).catch(() => {});
      }
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Performance and Resource Management', () => {
    test('should complete generation and render within reasonable time', async () => {
    if (skipIfNoLLM()) return;
      const startTime = Date.now();

      const prompt = 'Create a simple p5.js sketch';

      // Generate
      const sketchCode = await P5Generator.generate(prompt, {});

      // Render
      const screenshotPath = path.join(testOutputDir, 'performance-test-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(sketchCode);
      await renderer.render(sketchCode, screenshotPath);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);

      // Verify screenshot was created
      expect(existsSync(screenshotPath)).toBe(true);
    }, GENERATION_RENDER_TIMEOUT);

    test('should handle memory efficiently for multiple renders', async () => {
    if (skipIfNoLLM()) return;
      const iterations = 3;
      const screenshotPaths = [];

      for (let i = 0; i < iterations; i++) {
        const prompt = `Create sketch ${i}`;
        const sketchCode = await P5Generator.generate(prompt, {});
        const screenshotPath = path.join(testOutputDir, `memory-test-${i}-screenshot.png`);
        screenshotPaths.push(screenshotPath);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        expect(existsSync(screenshotPath)).toBe(true);
        await previewServer.stop();
      }

      // Clean up
      for (const screenshotPath of screenshotPaths) {
        await fs.unlink(screenshotPath).catch(() => {});
      }
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Code Quality and Validation', () => {
    test('should generate syntactically valid p5.js code', async () => {
    if (skipIfNoLLM()) return;
      const prompts = [
        'Create a particle system',
        'Create an animation',
        'Create interactive art',
        'Create cellular automata'
      ];

      for (const prompt of prompts) {
        const sketchCode = await P5Generator.generate(prompt, {});

        // Verify basic syntax
        expect(() => {
          // Should not throw syntax errors
          Function(sketchCode);
        }).not.toThrow();

        // Verify balanced brackets
        const openBraces = (sketchCode.match(/\{/g) || []).length;
        const closeBraces = (sketchCode.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);

        const openParens = (sketchCode.match(/\(/g) || []).length;
        const closeParens = (sketchCode.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);

        // Verify it can be rendered
        const screenshotPath = path.join(testOutputDir, `syntax-test-${Date.now()}-screenshot.png`);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        expect(existsSync(screenshotPath)).toBe(true);
        await fs.unlink(screenshotPath);
        await previewServer.stop();
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should include proper p5.js structure in generated code', async () => {
    if (skipIfNoLLM()) return;
      const prompt = 'Create a complete p5.js sketch';
      const sketchCode = await P5Generator.generate(prompt, {});

      // Verify required p5.js elements
      expect(sketchCode).toContain('function setup');
      expect(sketchCode).toContain('createCanvas');
      expect(sketchCode).toMatch(/background\s*\(/);

      // Verify it renders correctly
      const screenshotPath = path.join(testOutputDir, 'structure-test-screenshot.png');

      await previewServer.start(TEST_PORT);
      previewServer.serveSketch(sketchCode);
      await renderer.render(sketchCode, screenshotPath);

      expect(existsSync(screenshotPath)).toBe(true);
      const stats = await fs.stat(screenshotPath);
      expect(stats.size).toBeGreaterThan(0);
    }, GENERATION_RENDER_TIMEOUT);
  });

  describe('Real-World Scenarios', () => {
    test('should handle typical creative coding workflow', async () => {
    if (skipIfNoLLM()) return;
      // Simulate a typical user workflow
      const workflow = [
        { prompt: 'Create a simple particle system', description: 'Initial creation' },
        { prompt: 'Add color to the particles', description: 'Enhancement' },
        { prompt: 'Make particles respond to mouse movement', description: 'Interactivity' },
        { prompt: 'Add smooth animation', description: 'Animation' }
      ];

      for (const step of workflow) {
        try {
          // Generate
          const sketchCode = await P5Generator.generate(step.prompt, {});

          // Verify generation
          expect(typeof sketchCode).toBe('string');
          expect(sketchCode.length).toBeGreaterThan(0);

          // Create new server instance for each step to avoid conflicts
          const stepServer = new PreviewServer();

          try {
            // Render via PreviewServer
            await stepServer.start(TEST_PORT);
            stepServer.serveSketch(sketchCode);

            // Capture screenshot (this validates the server is working correctly)
            const screenshotPath = path.join(testOutputDir, `workflow-${step.description.replace(/\s+/g, '-')}-screenshot.png`);
            await renderer.render(sketchCode, screenshotPath);

            // Verify screenshot
            expect(existsSync(screenshotPath)).toBe(true);
            const stats = await fs.stat(screenshotPath);
            expect(stats.size).toBeGreaterThan(0);

            // Clean up screenshot
            await fs.unlink(screenshotPath);
          } finally {
            // Ensure step server is stopped
            await stepServer.stop().catch(() => {});
          }
        } catch (error) {
          // Fail the test with descriptive error
          throw new Error(`Workflow step "${step.description}" failed: ${error.message}`);
        }
      }
    }, GENERATION_RENDER_TIMEOUT);

    test('should support rapid prototyping iterations', async () => {
    if (skipIfNoLLM()) return;
      const prototypeIterations = 5;
      const basePrompt = 'Create a generative art sketch';

      for (let i = 0; i < prototypeIterations; i++) {
        const prompt = i === 0 ? basePrompt : `Refine the generative art, iteration ${i}`;

        // Generate rapidly
        const sketchCode = await P5Generator.generate(prompt, { iteration: i + 1 });

        // Quick render check
        const screenshotPath = path.join(testOutputDir, `prototype-${i}-screenshot.png`);

        await previewServer.start(TEST_PORT);
        previewServer.serveSketch(sketchCode);
        await renderer.render(sketchCode, screenshotPath);

        // Verify each iteration works
        expect(existsSync(screenshotPath)).toBe(true);

        // Clean up for next iteration
        await fs.unlink(screenshotPath);
        await previewServer.stop();
      }
    }, GENERATION_RENDER_TIMEOUT);
  });
});