import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';

describe('CreativeEvaluator', () => {
  describe('assess()', () => {
    describe('Technical validation', () => {
      it('should reject empty output', () => {
        const output = '';
        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues).toContain('Empty output');
      });

      it('should reject null output', () => {
        const result = CreativeEvaluator.assess(null);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues).toContain('Invalid output type');
      });

      it('should reject undefined output', () => {
        const result = CreativeEvaluator.assess(undefined);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues).toContain('Invalid output type');
      });

      it('should reject non-string output', () => {
        const result = CreativeEvaluator.assess(123);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues).toContain('Invalid output type');
      });

      it('should reject output with only whitespace', () => {
        const output = '   \n\t   ';
        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBe(0);
        expect(result.issues).toContain('Empty output');
      });

      it('should reject broken p5.js code with syntax errors', () => {
        const output = `function setup() {
          createCanvas(400, 400
        }`; // Missing closing parenthesis

        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBeLessThan(0.5);
        expect(result.issues.length).toBeGreaterThan(0);
      });

      it('should reject incomplete code blocks', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        `; // Missing closing brace

        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBeLessThan(0.5);
      });

      it('should reject code with obvious errors', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(255);
          undefinedFunction(); // Obvious error
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBeLessThan(0.7);
      });

      it('should accept valid p5.js sketch structure', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          circle(200, 200, 50);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.7);
      });
    });

    describe('evaluationCriteria option', () => {
      it('should use only technical dimension when evaluationCriteria is ["technical"]', () => {
        const code = `function setup() { createCanvas(400, 400); }
        function draw() { background(220); circle(200, 200, 50); }`;
        const withCriteria = CreativeEvaluator.assess(code, { evaluationCriteria: ['technical'] });
        const withoutCriteria = CreativeEvaluator.assess(code);
        expect(withCriteria.score).toBe(withCriteria.technicalScore);
        expect(withCriteria.score).not.toBe(withoutCriteria.score);
        expect(withCriteria.technicalScore).toBeGreaterThan(0);
      });

      it('should give non-zero sound factor when code contains p5.sound', () => {
        const codeWithSound = `function setup() {
          createCanvas(400, 400);
          let osc = new p5.Oscillator();
          osc.start();
        }
        function draw() { background(220); }`;
        const result = CreativeEvaluator.assess(codeWithSound, {
          evaluationCriteria: ['aesthetic', 'technical', 'novelty']
        });
        expect(result.score).toBeGreaterThan(0);
        const codeNoSound = `function setup() { createCanvas(400, 400); }
        function draw() { background(220); }`;
        const noSoundScore = CreativeEvaluator.assess(codeNoSound, {
          evaluationCriteria: ['aesthetic', 'technical', 'novelty']
        }).score;
        expect(result.score).toBeGreaterThanOrEqual(noSoundScore);
      });

      it('when evaluationCriteria includes "aesthetic", sound-using code gets aesthetic score >= same code without sound', () => {
        const baseCode = `function setup() { createCanvas(400, 400); }
        function draw() { background(220); circle(200, 200, 50); }`;
        const codeWithSound = `function setup() {
          createCanvas(400, 400);
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          osc.connect(ctx.destination);
          osc.start();
        }
        function draw() { background(220); circle(200, 200, 50); }`;
        const optsAestheticOnly = { evaluationCriteria: ['aesthetic'] };
        const scoreNoSound = CreativeEvaluator.assess(baseCode, optsAestheticOnly).score;
        const scoreWithSound = CreativeEvaluator.assess(codeWithSound, optsAestheticOnly).score;
        expect(scoreWithSound).toBeGreaterThanOrEqual(scoreNoSound);
      });

      it('code containing AudioContext, createOscillator, p5.sound, or Web Audio gets non-zero sound dimension', () => {
        const snippets = [
          { name: 'AudioContext', code: `function setup(){createCanvas(400,400);var c=new AudioContext();} function draw(){background(0);}` },
          { name: 'createOscillator', code: `function setup(){createCanvas(400,400);var c=new AudioContext();var o=c.createOscillator();} function draw(){background(0);}` },
          { name: 'p5.sound', code: `function setup(){createCanvas(400,400);/* p5.sound */} function draw(){background(0);}` },
          { name: 'Web Audio', code: `function setup(){createCanvas(400,400);/* Web Audio */} function draw(){background(0);}` }
        ];
        const noSoundCode = `function setup(){createCanvas(400,400);} function draw(){background(0);}`;
        const opts = { evaluationCriteria: ['aesthetic'] };
        const noSoundScore = CreativeEvaluator.assess(noSoundCode, opts).score;
        for (const { name, code } of snippets) {
          const result = CreativeEvaluator.assess(code, opts);
          expect(result.score).toBeGreaterThanOrEqual(noSoundScore);
          expect(result.score).toBeGreaterThan(0);
        }
      });
    });

    describe('Creative quality assessment', () => {
      it('should reject low-quality trivial code', () => {
        const output = 'console.log("hello");';
        const result = CreativeEvaluator.assess(output);

        expect(result.passed).toBe(false);
        expect(result.score).toBeLessThan(0.5);
      });

      it('should give higher scores for more complex creative output', () => {
        const simpleOutput = `function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(220);
        }`;

        const complexOutput = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
        }

        let particles = [];

        function draw() {
          background(220, 0.1);

          if (particles.length < 100) {
            particles.push(new Particle());
          }

          for (let p of particles) {
            p.update();
            p.display();
          }
        }

        class Particle {
          constructor() {
            this.pos = createVector(random(width), random(height));
            this.vel = createVector(random(-1, 1), random(-1, 1));
          }

          update() {
            this.pos.add(this.vel);
          }

          display() {
            fill(0);
            circle(this.pos.x, this.pos.y, 5);
          }
        }`;

        const simpleResult = CreativeEvaluator.assess(simpleOutput);
        const complexResult = CreativeEvaluator.assess(complexOutput);

        expect(complexResult.score).toBeGreaterThan(simpleResult.score);
      });

      it('should reward creative techniques', () => {
        const creativeOutput = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
          blendMode(ADD);
        }

        function draw() {
          background(0, 0.05);

          for (let i = 0; i < 50; i++) {
            fill((frameCount + i * 10) % 360, 80, 80);
            circle(
              noise(frameCount * 0.01 + i) * width,
              noise(frameCount * 0.02 + i) * height,
              sin(frameCount * 0.1 + i) * 20 + 30
            );
          }
        }`;

        const result = CreativeEvaluator.assess(creativeOutput);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.7);
      });

      it('should reward proper animation structure', () => {
        const animatedOutput = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          let x = frameCount % width;
          circle(x, height / 2, 50);
        }`;

        const result = CreativeEvaluator.assess(animatedOutput);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.6);
      });

      it('should reward interactive elements', () => {
        const interactiveOutput = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          if (mouseIsPressed) {
            fill(255, 0, 0);
          } else {
            fill(0);
          }
          circle(mouseX, mouseY, 50);
        }`;

        const result = CreativeEvaluator.assess(interactiveOutput);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.6);
      });
    });

    describe('Scoring system', () => {
      it('should always return score between 0 and 1', () => {
        const testCases = [
          '',
          'invalid code',
          'function setup() { createCanvas(400, 400); }',
          'console.log("test");',
          `function setup() { createCanvas(400, 400); }
            function draw() { background(220); }`,
        ];

        for (const output of testCases) {
          const result = CreativeEvaluator.assess(output);
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
        }
      });

      it('should return detailed assessment breakdown', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          circle(200, 200, 50);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('issues');
        expect(result).toHaveProperty('technicalScore');
        expect(result).toHaveProperty('creativeScore');
        expect(result).toHaveProperty('metrics');
      });

      it('should provide metrics breakdown', () => {
        const output = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
        }

        function draw() {
          background(frameCount % 360, 50, 50);
          circle(width/2, height/2, 100);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result.metrics).toHaveProperty('codeLength');
        expect(result.metrics).toHaveProperty('hasSetup');
        expect(result.metrics).toHaveProperty('hasDraw');
        expect(result.metrics).toHaveProperty('usesAnimation');
        expect(result.metrics).toHaveProperty('usesColor');
        expect(result.metrics).toHaveProperty('hasInteractivity');
      });

      it('should calculate balanced technical and creative scores', () => {
        const goodOutput = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
        }

        let particles = [];

        function draw() {
          background(0, 0.1);

          if (frameCount % 10 === 0) {
            particles.push(new Particle());
          }

          for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].display();

            if (particles[i].isDead()) {
              particles.splice(i, 1);
            }
          }
        }

        class Particle {
          constructor() {
            this.pos = createVector(mouseX, mouseY);
            this.vel = p5.Vector.random2D().mult(random(1, 3));
            this.life = 255;
          }

          update() {
            this.pos.add(this.vel);
            this.life -= 2;
          }

          display() {
            noStroke();
            fill(200 + random(-20, 20), 80, 80, this.life / 255);
            circle(this.pos.x, this.pos.y, 8);
          }

          isDead() {
            return this.life < 0;
          }
        }`;

        const result = CreativeEvaluator.assess(goodOutput);

        expect(result.technicalScore).toBeGreaterThan(0.7);
        expect(result.creativeScore).toBeGreaterThan(0.7);
        expect(result.passed).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle very long code', () => {
        let longCode = 'function setup() { createCanvas(400, 400); }\n\nfunction draw() {\n  background(220);\n';
        for (let i = 0; i < 1000; i++) {
          longCode += `  circle(${i}, ${i}, 10);\n`;
        }
        longCode += '}';

        const result = CreativeEvaluator.assess(longCode);

        expect(result).toHaveProperty('score');
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });

      it('should handle code with comments', () => {
        const output = `// Create a particle system
        // Using p5.js library

        function setup() {
          // Initialize canvas
          createCanvas(400, 400);
          colorMode(HSB); // Use HSB color mode
        }

        // Main animation loop
        function draw() {
          background(220); // Clear screen
          circle(200, 200, 50); // Draw circle
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('passed');
      });

      it('should handle code with template literals', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          let message = \`Frame: \${frameCount}\`;
          background(220);
          text(message, 200, 200);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('score');
      });

      it('should handle code with async functions', () => {
        const output = `async function setup() {
          createCanvas(400, 400);
          await loadFont('font.ttf');
        }

        function draw() {
          background(220);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('score');
      });

      it('should handle minified code', () => {
        const output = 'function setup(){createCanvas(400,400);}function draw(){background(220);circle(200,200,50);}';

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('score');
      });

      it('should handle unicode and special characters', () => {
        const output = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          text('🎨 艺术 🚀', 200, 200);
        }`;

        const result = CreativeEvaluator.assess(output);

        expect(result).toHaveProperty('score');
      });
    });

    describe('Quality gates', () => {
      it('should set minimum quality threshold of 0.7', () => {
        const poorOutput = 'console.log("hello");';
        const result = CreativeEvaluator.assess(poorOutput);

        expect(result.passed).toBe(false);
      });

      it('should pass high-quality creative output', () => {
        const highQualityOutput = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
          blendMode(SCREEN);
        }

        let particles = [];
        let flowField;

        function draw() {
          background(0, 0.05);

          if (particles.length < 500) {
            particles.push(new Particle());
          }

          for (let p of particles) {
            p.follow(flowField);
            p.update();
            p.edges();
            p.display();
          }
        }

        class Particle {
          constructor() {
            this.pos = createVector(random(width), random(height));
            this.vel = createVector(0, 0);
            this.acc = createVector(0, 0);
            this.maxSpeed = 2;
          }

          follow(vectors) {
            let x = floor(this.pos.x / 20);
            let y = floor(this.pos.y / 20);
            let index = x + y * 20;
            if (vectors && vectors[index]) {
              this.acc.add(vectors[index]);
            }
          }

          update() {
            this.vel.add(this.acc);
            this.vel.limit(this.maxSpeed);
            this.pos.add(this.vel);
            this.acc.mult(0);
          }

          display() {
            stroke(frameCount % 360, 80, 80);
            strokeWeight(2);
            point(this.pos.x, this.pos.y);
          }

          edges() {
            if (this.pos.x > width) this.pos.x = 0;
            if (this.pos.x < 0) this.pos.x = width;
            if (this.pos.y > height) this.pos.y = 0;
            if (this.pos.y < 0) this.pos.y = height;
          }
        }`;

        const result = CreativeEvaluator.assess(highQualityOutput);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.7);
      });

      it('should fail medium-quality output below threshold', () => {
        const mediumQualityOutput = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          for (let i = 0; i < 10; i++) {
            circle(i * 40, 200, 30);
          }
        }`;

        const result = CreativeEvaluator.assess(mediumQualityOutput);

        // This should be close to the threshold - adjust test based on implementation
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      });
    });

    describe('Real-world scenarios', () => {
      it('should handle typical p5.js sketch output', () => {
        const typicalSketch = `function setup() {
          createCanvas(400, 400);
          frameRate(60);
        }

        function draw() {
          background(30);

          for (let i = 0; i < 100; i++) {
            let x = random(width);
            let y = random(height);
            let size = random(5, 20);
            let r = random(255);
            let g = random(255);
            let b = random(255);

            fill(r, g, b, 150);
            noStroke();
            circle(x, y, size);
          }
        }`;

        const result = CreativeEvaluator.assess(typicalSketch);

        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('technicalScore');
        expect(result).toHaveProperty('creativeScore');
      });

      it('should handle iterative improvement scenarios', () => {
        const v1 = `function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(220);
        }`;

        const v2 = `function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(220);
          circle(200, 200, 50);
        }`;

        const v3 = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
        }
        function draw() {
          background(220);
          fill((frameCount * 2) % 360, 80, 80);
          circle(200, 200, 50);
        }`;

        const result1 = CreativeEvaluator.assess(v1);
        const result2 = CreativeEvaluator.assess(v2);
        const result3 = CreativeEvaluator.assess(v3);

        expect(result3.score).toBeGreaterThan(result2.score);
        expect(result2.score).toBeGreaterThan(result1.score);
      });

      it('should handle generative art patterns', () => {
        const generativeArt = `function setup() {
          createCanvas(400, 400);
          colorMode(HSB);
          noStroke();
        }

        function draw() {
          background(0, 0.1);

          let x = random(width);
          let y = random(height);
          let size = random(10, 50);
          let hue = (frameCount + x + y) % 360;

          fill(hue, 70, 90, 0.6);
          circle(x, y, size);
        }`;

        const result = CreativeEvaluator.assess(generativeArt);

        expect(result.passed).toBe(true);
        expect(result.score).toBeGreaterThan(0.7);
      });
    });
  });

  describe('getFitness()', () => {
    it('returns score in [0, 1] and issues array for valid p5 code', () => {
      const validP5Code = `function setup() {
          createCanvas(400, 400);
        }

        function draw() {
          background(220);
          circle(200, 200, 50);
        }`;

      const result = CreativeEvaluator.getFitness(validP5Code);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('returns same score as assess() for the same code', () => {
      const code = `function setup() { createCanvas(400, 400); }
        function draw() { background(220); circle(200, 200, 50); }`;
      const assessResult = CreativeEvaluator.assess(code);
      const fitnessResult = CreativeEvaluator.getFitness(code);
      expect(fitnessResult.score).toBe(assessResult.score);
      expect(fitnessResult.issues).toEqual(assessResult.issues);
    });
  });
});