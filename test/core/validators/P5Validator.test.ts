import { describe, it, expect } from 'vitest';
import { P5Validator } from '../../../src/core/validators/P5Validator.js';

describe('P5Validator', () => {
  describe('validate', () => {
    it('should validate valid raw p5.js with setup function', () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
        }
        
        function draw() {
          background(220);
          ellipse(200, 200, 50, 50);
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid raw p5.js with draw function only', () => {
      const code = `
        function draw() {
          ellipse(mouseX, mouseY, 50, 50);
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid raw p5.js with createCanvas only', () => {
      const code = `
        createCanvas(400, 400);
        background(255);
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject raw p5.js without setup, draw, or createCanvas', () => {
      const code = `
        const x = 100;
        const y = 200;
        console.log(x + y);
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('p5.js code must contain at least one of: function setup(), function draw(), or createCanvas()');
    });

    it('should reject empty code', () => {
      const result = P5Validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should reject code with only whitespace', () => {
      const result = P5Validator.validate('   \n\t  ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('should validate valid HTML-wrapped p5.js', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
</head>
<body>
  <script>
    function setup() {
      createCanvas(400, 400);
    }
    function draw() {
      background(220);
    }
  </script>
</body>
</html>`;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject HTML-wrapped p5.js without CDN', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <title>No CDN</title>
</head>
<body>
  <script>
    function setup() {
      createCanvas(400, 400);
    }
  </script>
</body>
</html>`;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML-wrapped p5.js must include p5.js CDN');
    });

    it('should reject HTML without p5 CDN even if it has setup function', () => {
      const code = `<!DOCTYPE html>
<html>
<body>
  <script>
    function setup() {
      createCanvas(400, 400);
    }
  </script>
</body>
</html>`;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML-wrapped p5.js must include p5.js CDN');
    });

    it('should validate p5.js with instance mode', () => {
      const code = `
        const myp5 = new p5((p) => {
          p.setup = function() {
            p.createCanvas(400, 400);
          };
          p.draw = function() {
            p.background(220);
          };
        });
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate p5.js with global mode and multiple shapes', () => {
      const code = `
        function setup() {
          createCanvas(800, 600);
          background(100);
        }
        
        function draw() {
          fill(255, 0, 0);
          rect(100, 100, 200, 150);
          fill(0, 0, 255);
          ellipse(400, 300, 100, 100);
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getMinSize', () => {
    it('should return 120 bytes as minimum size', () => {
      expect(P5Validator.getMinSize()).toBe(120);
    });
  });
});
