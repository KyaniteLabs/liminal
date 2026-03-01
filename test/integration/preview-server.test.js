import { PreviewServer } from '../../src/render/PreviewServer';
import http from 'http';

describe('PreviewServer Integration Tests', () => {
  let previewServer;
  const TEST_PORT = 3456;

  beforeEach(() => {
    previewServer = new PreviewServer();
  });

  afterEach(async () => {
    if (previewServer) {
      try {
        await previewServer.stop();
      } catch (error) {
        // Ignore if server not started
      }
    }
  });

  describe('start(port)', () => {
    it('should start Express server on configured port', async () => {
      await previewServer.start(TEST_PORT);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);
    });

    it('should return true when successfully started', async () => {
      const result = await previewServer.start(TEST_PORT);
      expect(result).toBe(true);
    });

    it('should start server on default port if not specified', async () => {
      await previewServer.start();

      const response = await fetch('http://localhost:3456/');
      expect(response.status).toBe(200);
    });

    it('should handle multiple start calls gracefully', async () => {
      await previewServer.start(TEST_PORT);
      await expect(previewServer.start(TEST_PORT)).rejects.toThrow('Server is already running');
    });

    it('should reject invalid port numbers', async () => {
      await expect(previewServer.start(-1)).rejects.toThrow();
      await expect(previewServer.start(65536)).rejects.toThrow();
    });

    it('should handle port already in use', async () => {
      const server1 = new PreviewServer();
      const server2 = new PreviewServer();

      try {
        await server1.start(TEST_PORT);
        await expect(server2.start(TEST_PORT)).rejects.toThrow();
      } finally {
        await server1.stop();
        await server2.stop();
      }
    });
  });

  describe('stop()', () => {
    it('should stop running server', async () => {
      await previewServer.start(TEST_PORT);
      await previewServer.stop();

      // Server should no longer be accessible
      await expect(fetch(`http://localhost:${TEST_PORT}/`)).rejects.toThrow();
    });

    it('should return true when successfully stopped', async () => {
      await previewServer.start(TEST_PORT);
      const result = await previewServer.stop();
      expect(result).toBe(true);
    });

    it('should handle stop when server not started', async () => {
      const result = await previewServer.stop();
      expect(result).toBeDefined();
    });

    it('should handle multiple stop calls gracefully', async () => {
      await previewServer.start(TEST_PORT);
      await previewServer.stop();
      const secondStop = await previewServer.stop();

      expect(secondStop).toBeDefined();
    });
  });

  describe('serveSketch(code)', () => {
    beforeEach(async () => {
      await previewServer.start(TEST_PORT);
    });

    it('should serve p5.js sketch code', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          background(255);
        }

        function draw() {
          ellipse(200, 200, 50, 50);
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('p5');
      expect(html).toContain('createCanvas');
      expect(html).toContain('background');
    });

    it('should serve sketch with proper HTML structure', async () => {
      const sketchCode = 'function setup() { createCanvas(400, 400); }';
      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include p5.js library in served sketch', async () => {
      const sketchCode = 'function setup() { createCanvas(400, 400); }';
      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      // Should include p5.js from CDN
      expect(html).toMatch(/p5\.js/);
      expect(html).toMatch(/script/);
    });

    it('should handle sketches with setup() and draw()', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('setup');
      expect(html).toContain('draw');
    });

    it('should handle sketches with instance mode', async () => {
      const sketchCode = `
        const sketch = (p) => {
          p.setup = () => {
            p.createCanvas(400, 400);
          };
        };

        new p5(sketch);
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('p5');
      expect(html).toContain('sketch');
    });

    it('should serve updated sketch when called multiple times', async () => {
      const sketch1 = 'function setup() { createCanvas(400, 400); }';
      const sketch2 = 'function setup() { createCanvas(800, 600); }';

      previewServer.serveSketch(sketch1);
      const response1 = await fetch(`http://localhost:${TEST_PORT}/`);
      const html1 = await response1.text();
      expect(html1).toContain('400, 400');

      previewServer.serveSketch(sketch2);
      const response2 = await fetch(`http://localhost:${TEST_PORT}/`);
      const html2 = await response2.text();
      expect(html2).toContain('800, 600');
    });

    it('should handle empty sketch code', async () => {
      previewServer.serveSketch('');

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);
    });

    it('should handle null/undefined sketch code', async () => {
      previewServer.serveSketch(null);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);
    });

    it('should handle complex p5.js sketches', async () => {
      const sketchCode = `
        let particles = [];

        function setup() {
          createCanvas(600, 400);
          for (let i = 0; i < 100; i++) {
            particles.push(new Particle());
          }
        }

        function draw() {
          background(30);
          particles.forEach(p => {
            p.update();
            p.display();
          });
        }

        class Particle {
          update() {
            this.x += this.vx;
            this.y += this.vy;
          }

          display() {
            ellipse(this.x, this.y, 10, 10);
          }
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('particles');
      expect(html).toContain('Particle');
      expect(html).toContain('update');
      expect(html).toContain('display');
    });

    it('should handle sketches with comments', async () => {
      const sketchCode = `
        // Particle system
        /* Multi-line comment */
        function setup() {
          createCanvas(400, 400); // Canvas size
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('//');
      expect(html).toContain('createCanvas');
    });

    it('should handle sketches with unicode characters', async () => {
      const sketchCode = `
        function setup() {
          createCanvas(400, 400);
          text('你好世界 🎨', 200, 200);
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      expect(html).toContain('你好世界');
      expect(html).toContain('🎨');
    });

    it('should escape HTML in sketch code to prevent XSS', async () => {
      const sketchCode = `
        function setup() {
          let x = "<script>alert('xss')</script>";
          createCanvas(400, 400);
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      // The sketch code should be properly escaped
      expect(html).not.toContain('<script>alert');
    });
  });

  describe('end-to-end workflow', () => {
    it('should start, serve sketch, and stop', async () => {
      // Start
      await previewServer.start(TEST_PORT);

      // Serve sketch
      const sketchCode = 'function setup() { createCanvas(400, 400); }';
      previewServer.serveSketch(sketchCode);

      // Verify
      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);

      // Stop
      await previewServer.stop();

      // Verify stopped
      await expect(fetch(`http://localhost:${TEST_PORT}/`)).rejects.toThrow();
    });

    it('should handle multiple sketch updates in session', async () => {
      await previewServer.start(TEST_PORT);

      const sketches = [
        'function setup() { createCanvas(400, 400); }',
        'function setup() { createCanvas(800, 600); }',
        'function setup() { createCanvas(1024, 768); }'
      ];

      for (const sketch of sketches) {
        previewServer.serveSketch(sketch);
        const response = await fetch(`http://localhost:${TEST_PORT}/`);
        expect(response.status).toBe(200);
      }

      await previewServer.stop();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      await previewServer.start(TEST_PORT);

      // Try to connect to wrong port
      await expect(fetch('http://localhost:9999/')).rejects.toThrow();

      await previewServer.stop();
    });

    it('should handle malformed sketch code', async () => {
      await previewServer.start(TEST_PORT);

      // Should not crash on malformed code
      previewServer.serveSketch('function setup { missing parenthesis }');

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);

      await previewServer.stop();
    });
  });

  describe('configuration', () => {
    it('should use default port 3456 when no port specified', async () => {
      await previewServer.start();

      const response = await fetch('http://localhost:3456/');
      expect(response.status).toBe(200);

      await previewServer.stop();
    });

    it('should accept custom port numbers', async () => {
      await previewServer.start(4567);

      const response = await fetch('http://localhost:4567/');
      expect(response.status).toBe(200);

      await previewServer.stop();
    });
  });
});