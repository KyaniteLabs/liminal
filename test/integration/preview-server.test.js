import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import http from 'http';

describe('PreviewServer Integration Tests', () => {
  let previewServer;
  let TEST_PORT;

  const getListeningPort = (server = previewServer) => {
    const port = server.getPort();
    if (port == null) {
      throw new Error('PreviewServer did not expose a listening port');
    }
    return port;
  };

  const startPreviewServer = async (port = 0) => {
    const result = await previewServer.start(port);
    TEST_PORT = port === 0 ? getListeningPort() : port;
    return result;
  };

  beforeEach(() => {
    previewServer = new PreviewServer();
    TEST_PORT = null;
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
      await startPreviewServer();

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);
    });

    it('should return true when successfully started', async () => {
      const result = await startPreviewServer();
      expect(result).toBe(true);
    });


    it('should handle multiple start calls gracefully', async () => {
      await startPreviewServer();
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
        await server1.start(0);
        const inUsePort = getListeningPort(server1);
        await expect(server2.start(inUsePort)).rejects.toThrow();
      } finally {
        await server1.stop();
        await server2.stop();
      }
    });
  });

  describe('stop()', () => {
    it('should stop running server', async () => {
      await startPreviewServer();
      await previewServer.stop();

      // Server should no longer be accessible
      await expect(fetch(`http://localhost:${TEST_PORT}/`)).rejects.toThrow();
    });

    it('should return true when successfully stopped', async () => {
      await startPreviewServer();
      const result = await previewServer.stop();
      expect(result).toBe(true);
    });

    it('should handle stop when server not started', async () => {
      const result = await previewServer.stop();
      expect(result).toBeDefined();
    });

    it('should handle multiple stop calls gracefully', async () => {
      await startPreviewServer();
      await previewServer.stop();
      const secondStop = await previewServer.stop();

      expect(secondStop).toBeDefined();
    });
  });

  describe('serveSketch(code)', () => {
    beforeEach(async () => {
      await startPreviewServer();
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

    it('should escape </script> tags to prevent XSS while keeping code executable', async () => {
      const sketchCode = `
        function setup() {
          let x = "</script><script>alert('xss')</script>";
          createCanvas(400, 400);
        }
      `;

      previewServer.serveSketch(sketchCode);

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      const html = await response.text();

      // </script> should be escaped to prevent breaking out of script tag
      expect(html).not.toContain('</script><script>');
      // But the code should still be executable (not HTML-escaped)
      expect(html).toContain('function setup()');
      expect(html).toContain('createCanvas(400, 400)');
    });
  });

  describe('end-to-end workflow', () => {
    it('should start, serve sketch, and stop', async () => {
      // Start
      await startPreviewServer();

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
      await startPreviewServer();

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
      await startPreviewServer();

      // Try to connect to wrong port
      await expect(fetch('http://localhost:9999/')).rejects.toThrow();

      await previewServer.stop();
    });

    it('should handle malformed sketch code', async () => {
      await startPreviewServer();

      // Should not crash on malformed code
      previewServer.serveSketch('function setup { missing parenthesis }');

      const response = await fetch(`http://localhost:${TEST_PORT}/`);
      expect(response.status).toBe(200);

      await previewServer.stop();
    });
  });

  describe('configuration', () => {
    describe('default port behavior', () => {
      let defaultPortServer;

      beforeAll(async () => {
        defaultPortServer = new PreviewServer();
        await defaultPortServer.start();
      });

      afterAll(async () => {
        if (defaultPortServer) {
          await defaultPortServer.stop();
        }
      });

      it('should start server on default port if not specified', async () => {
        const response = await fetch('http://localhost:3456/');
        expect(response.status).toBe(200);
      });

      it('should use default port 3456 when no port specified', async () => {
        const response = await fetch('http://localhost:3456/');
        expect(response.status).toBe(200);
      });
    });

    it('should accept custom port numbers', async () => {
      await previewServer.start(4567);

      const response = await fetch('http://localhost:4567/');
      expect(response.status).toBe(200);

      await previewServer.stop();
    });
  });
});
