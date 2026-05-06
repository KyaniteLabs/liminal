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

    it('should allow p5 keyboard globals in raw global-mode sketches', () => {
      const code = `
        function setup() {
          createCanvas(windowWidth, windowHeight);
        }

        function draw() {
          background(10);
          if (keyIsPressed && key === 'r') {
            fill(255, 40, 80);
          } else if (keyCode === LEFT_ARROW || mouseButton === LEFT) {
            fill(40, 120, 255);
          } else {
            fill(255);
          }
          circle(mouseX, mouseY, 36);
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow common p5 vector helpers in raw global-mode sketches', () => {
      const code = `
        let particles = [];

        function setup() {
          createCanvas(windowWidth, windowHeight);
          particles.push({
            pos: createVector(random(width), random(height)),
            vel: p5.Vector.fromAngle(random(TWO_PI))
          });
        }

        function draw() {
          background(0);
          for (const particle of particles) {
            particle.pos.add(particle.vel);
            circle(particle.pos.x, particle.pos.y, 4);
          }
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
      expect(result.errors).toContain('p5.js code must contain at least one of: function setup(), const setup = () =>..., function draw(), const draw = () =>..., or createCanvas()');
    });

    it('should reject p5-shaped output that is not valid JavaScript', () => {
      const code = `
        function setup() {
          createCanvas(windowWidth, windowHeight);
        }

        function draw() {
          background(183, 236, 248);
          for (let i = 0; i < particles.length; i++) {
            let particle = particles[i];
            vector v = particle.velocity;
            magnitude(v) *= 0.96;
          }
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('invalid JavaScript syntax'))).toBe(true);
    });

    it('should reject ES module imports in raw global-mode p5.js', () => {
      const code = `
        import * as p5 from 'p5';

        function setup() {
          createCanvas(400, 400);
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('invalid JavaScript syntax'))).toBe(true);
    });

    it('should reject undeclared sketch state references before runtime', () => {
      const code = `
        function setup() {
          createCanvas(windowWidth, windowHeight);
        }

        function draw() {
          background(240);
          particleCount = 15;
          for (let i = 0; i < particleCount; i++) {
            particles[i].show();
          }
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('p5.js code references undeclared identifier: particles');
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

    it('should allow HTML-wrapped p5.js documents without explicit closing body/html tags', () => {
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
  </script>`;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
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

    it('should reject local bindings that shadow p5 functions when called', () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          const scale = map(mouseX, 0, width, 0.5, 2);
          push();
          scale(scale);
          circle(0, 0, 10);
          pop();
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('p5.js code declares local scale and then calls scale(), shadowing the p5.js function');
    });

    it('should allow standard p5 color helpers and blend constants', () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
          pixelDensity(1);
          createGraphics(100, 100);
        }

        function draw() {
          const a = color(10, 20, 30);
          const b = color(40, 50, 60);
          const c = lerpColor(a, b, 0.5);
          blendMode(ADD);
          blendMode(MULTIPLY);
          background(constrain(red(c), 0, 255), green(c), blue(c));
          circle(200, 200, exp(1.0));
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow standard p5 shape mode constants', () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          beginShape(TRIANGLE_STRIP);
          vertex(30, 75);
          vertex(40, 20);
          vertex(50, 75);
          vertex(60, 20);
          endShape();
          beginShape(POINTS);
          vertex(100, 100);
          endShape();
        }
      `;

      const result = P5Validator.validate(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow common typography, timing, and point helpers from generated p5 sketches', () => {
      const code = `
        function setup() {
          createCanvas(400, 400);
          rectMode(CENTER);
          textStyle(NORMAL);
        }

        function draw() {
          background(20);
          const pulse = millis() / 1000;
          rotate(radians(frameCount % 360));
          point(width / 2 + sin(pulse) * 20, height / 2);
          textStyle(BOLD);
          text(nf(frameCount, 3), 10, 20);
          textStyle(NORMAL);
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
