/**
 * CreativeEvaluator tests
 *
 * Tier 0 Fix: Tests to verify scoring is proportional to actual code features
 * and not a constant dead zone around 0.68.
 */

import { describe, it, expect } from 'vitest';
import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';

describe('CreativeEvaluator', () => {
  describe('Tier 0: Score proportionality', () => {
    it('should give higher score to complex code than trivial code', () => {
      // Trivial code: just setup and draw with minimal content
      const trivialCode = `
        function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(220);
        }
      `;

      // Complex code: animation, interactivity, classes, arrays
      const complexCode = `
        let particles = [];
        let colors = [];
        
        function setup() {
          createCanvas(800, 600);
          for (let i = 0; i < 100; i++) {
            particles.push(new Particle(random(width), random(height)));
          }
          colors = ['red', 'blue', 'green'];
        }
        
        function draw() {
          background(0);
          for (let p of particles) {
            p.update();
            p.display();
          }
          
          if (mouseIsPressed) {
            particles.push(new Particle(mouseX, mouseY));
          }
        }
        
        class Particle {
          constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = random(-2, 2);
            this.vy = random(-2, 2);
            this.color = random(colors);
          }
          
          update() {
            this.x += this.vx;
            this.y += this.vy;
            
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
          }
          
          display() {
            fill(this.color);
            noStroke();
            ellipse(this.x, this.y, 10, 10);
          }
        }
      `;

      const trivialResult = CreativeEvaluator.assess(trivialCode);
      const complexResult = CreativeEvaluator.assess(complexCode);

      // Complex code should have significantly higher score
      expect(complexResult.score).toBeGreaterThan(trivialResult.score);
      expect(complexResult.creativeScore).toBeGreaterThan(trivialResult.creativeScore);
      expect(complexResult.technicalScore).toBeGreaterThanOrEqual(trivialResult.technicalScore);

      // The difference should be substantial (not just rounding error)
      expect(complexResult.score - trivialResult.score).toBeGreaterThan(0.1);
    });

    it('should give different scores for code with different complexity levels', () => {
      // Low complexity
      const lowComplexity = `
        function setup() {
          createCanvas(400, 400);
        }
        function draw() {
          background(200);
          ellipse(200, 200, 50, 50);
        }
      `;

      // Medium complexity - uses color and some interactivity
      const mediumComplexity = `
        function setup() {
          createCanvas(400, 400);
          frameRate(30);
        }
        function draw() {
          background(0);
          fill(255, 0, 0);
          ellipse(mouseX, mouseY, 50, 50);
        }
      `;

      const lowResult = CreativeEvaluator.assess(lowComplexity);
      const mediumResult = CreativeEvaluator.assess(mediumComplexity);

      // Medium complexity should score higher
      expect(mediumResult.score).toBeGreaterThan(lowResult.score);
      expect(mediumResult.metrics.usesColor).toBe(true);
      expect(mediumResult.metrics.hasInteractivity).toBe(true);
    });

    it('should not return constant scores for different valid inputs', () => {
      const code1 = `
        function setup() { createCanvas(400, 400); }
        function draw() { background(200); rect(10, 10, 50, 50); }
      `;

      const code2 = `
        function setup() { createCanvas(800, 600); }
        function draw() { 
          background(0);
          fill(255, 100, 100);
          for (let i = 0; i < 10; i++) {
            ellipse(i * 50, 200, 30, 30);
          }
        }
      `;

      const code3 = `
        let x = 0;
        function setup() { 
          createCanvas(400, 400); 
          x = width / 2;
        }
        function draw() { 
          background(255);
          x += 1;
          if (x > width) x = 0;
          line(x, 0, x, height);
        }
      `;

      const result1 = CreativeEvaluator.assess(code1);
      const result2 = CreativeEvaluator.assess(code2);
      const result3 = CreativeEvaluator.assess(code3);

      // Scores should be different (not all the same constant)
      const scores = [result1.score, result2.score, result3.score];
      const uniqueScores = new Set(scores.map(s => Math.round(s * 100)));
      
      // At least 2 different scores out of 3
      expect(uniqueScores.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('technicalScore calculation', () => {
    it('should reward code with both setup and draw', () => {
      const withBoth = `
        function setup() { createCanvas(400, 400); }
        function draw() { background(200); }
      `;
      const withSetupOnly = `
        function setup() { createCanvas(400, 400); }
      `;

      const resultBoth = CreativeEvaluator.assess(withBoth);
      const resultSetupOnly = CreativeEvaluator.assess(withSetupOnly);

      expect(resultBoth.technicalScore).toBeGreaterThan(resultSetupOnly.technicalScore);
    });

    it('should reward substantive code length', () => {
      const shortCode = `
        function setup() { createCanvas(400, 400); }
        function draw() { background(200); }
      `;

      const longCode = `
        function setup() {
          createCanvas(400, 400);
          // Adding lots of comments and code to increase length
          // Line 1
          // Line 2
          // Line 3
          // Line 4
          // Line 5
          let x = 100;
          let y = 200;
          let speed = 5;
          let colors = ['red', 'green', 'blue'];
        }
        function draw() {
          background(200);
          // More comments here
          // To make this longer
          // And test the length bonus
          ellipse(200, 200, 50, 50);
          rect(100, 100, 50, 50);
          line(0, 0, 400, 400);
        }
      `;

      const shortResult = CreativeEvaluator.assess(shortCode);
      const longResult = CreativeEvaluator.assess(longCode);

      // Longer code should get some bonus for length
      expect(longResult.technicalScore).toBeGreaterThanOrEqual(shortResult.technicalScore);
    });
  });

  describe('creativeScore calculation', () => {
    it('should reward animation and interactivity', () => {
      const staticCode = `
        function setup() { createCanvas(400, 400); }
        function draw() { 
          background(200);
          rect(100, 100, 50, 50);
        }
      `;

      const animatedCode = `
        function setup() { 
          createCanvas(400, 400); 
          frameRate(60);
        }
        function draw() { 
          background(200);
          ellipse(frameCount % width, 200, 50, 50);
        }
      `;

      const interactiveCode = `
        function setup() { createCanvas(400, 400); }
        function draw() { 
          background(200);
          ellipse(mouseX, mouseY, 50, 50);
        }
        function mousePressed() {
          fill(random(255));
        }
      `;

      const staticResult = CreativeEvaluator.assess(staticCode);
      const animatedResult = CreativeEvaluator.assess(animatedCode);
      const interactiveResult = CreativeEvaluator.assess(interactiveCode);

      expect(animatedResult.creativeScore).toBeGreaterThan(staticResult.creativeScore);
      expect(interactiveResult.creativeScore).toBeGreaterThan(staticResult.creativeScore);
    });

    it('should reward use of classes and arrays', () => {
      const proceduralCode = `
        function setup() { createCanvas(400, 400); }
        function draw() { 
          background(200);
          for (let i = 0; i < 10; i++) {
            rect(i * 40, 100, 30, 30);
          }
        }
      `;

      const ooCode = `
        let shapes = [];
        function setup() { 
          createCanvas(400, 400);
          for (let i = 0; i < 10; i++) {
            shapes.push({ x: i * 40, y: 100 });
          }
        }
        function draw() { 
          background(200);
          for (let s of shapes) {
            rect(s.x, s.y, 30, 30);
          }
        }
      `;

      const proceduralResult = CreativeEvaluator.assess(proceduralCode);
      const ooResult = CreativeEvaluator.assess(ooCode);

      expect(ooResult.creativeScore).toBeGreaterThan(proceduralResult.creativeScore);
    });
  });

  // H3: dishonest fitness — specialized branches must not fabricate emergence /
  // interestingness as a real 0; they must mark them unscored.
  describe('H3: honest unscored dimensions (no fabricated 0)', () => {
    it('shader assessment marks emergence/interestingness unscored, not 0', () => {
      const shader = `
        precision highp float;
        uniform vec2 u_resolution;
        uniform float u_time;
        void main() {
          vec2 uv = gl_FragCoord.xy / u_resolution;
          vec3 col = vec3(sin(u_time + uv.x), cos(u_time + uv.y), 0.5);
          gl_FragColor = vec4(col, 1.0);
        }
      `;
      const result = CreativeEvaluator.assess(shader);

      // Honest: dimension is absent (undefined), NOT a fabricated zero.
      expect(result.emergenceScore).toBeUndefined();
      expect(result.interestingnessScore).toBeUndefined();
      expect(result.unscoredDimensions).toEqual(['emergence', 'interestingness']);
    });

    it('HTML assessment marks emergence/interestingness unscored, not 0', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><style>body { background: linear-gradient(red, blue); }</style></head>
          <body><main><h1>Hello</h1><canvas></canvas></main></body>
        </html>
      `;
      const result = CreativeEvaluator.assess(html);

      expect(result.emergenceScore).toBeUndefined();
      expect(result.interestingnessScore).toBeUndefined();
      expect(result.unscoredDimensions).toContain('emergence');
    });

    it('p5 default path still computes a real (non-undefined) emergence signal', () => {
      // Particle system with velocity — a genuine emergence signal must be a
      // real number, proving the unscored marker is not blanket-applied.
      const p5 = `
        let particles = [];
        function setup() {
          createCanvas(800, 600);
          for (let i = 0; i < 100; i++) {
            particles.push({ x: random(width), y: random(height), vx: random(-2, 2), vy: random(-2, 2) });
          }
        }
        function draw() {
          background(0);
          for (let p of particles) {
            p.x += p.vx; p.y += p.vy;
            ellipse(p.x, p.y, 5, 5);
          }
        }
      `;
      const result = CreativeEvaluator.assess(p5);

      expect(typeof result.emergenceScore).toBe('number');
      expect(result.emergenceScore).toBeGreaterThan(0);
      expect(result.unscoredDimensions).toBeUndefined();
    });
  });

  // D5: domain correctness — SVG and kinetic must route to their own branch,
  // and scoring must not reward brace/verbosity.
  describe('D5: SVG and kinetic domain routing', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
      <rect x="0" y="0" width="100" height="100" fill="url(#g)"/>
      <circle cx="50" cy="50" r="30" fill="#00ff00"/>
      <path d="M10 10 L90 90" stroke="#000000"/>
    </svg>`;

    const kinetic = `<!DOCTYPE html>
    <html><head><style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes pulse { 0% { opacity: 0.3; } 100% { opacity: 1; } }
      .a { animation: spin 4s linear infinite; background: radial-gradient(#ff0000, #0000ff); }
      .b { animation: pulse 2s ease-in-out infinite; filter: blur(2px); }
    </style></head>
    <body><div class="a"></div><div class="b"></div></body></html>`;

    it('routes standalone SVG to its own branch (not the p5/HTML default)', () => {
      expect(CreativeEvaluator.detectsSVGUsage(svg)).toBe(true);
      const result = CreativeEvaluator.assess(svg);
      // A real SVG with gradient + 3 primitives scores meaningfully, and the p5
      // "missing setup/draw" issues must NOT appear (proves it left the default).
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
    });

    it('routes CSS-kinetic artwork to its own branch (not generic HTML/p5)', () => {
      expect(CreativeEvaluator.detectsKineticUsage(kinetic)).toBe(true);
      const result = CreativeEvaluator.assess(kinetic);
      expect(result.score).toBeGreaterThan(0.5);
      expect(result.issues).not.toContain('Missing setup() function');
    });

    it('does not classify a kinetic doc as SVG, and vice versa', () => {
      expect(CreativeEvaluator.detectsKineticUsage(svg)).toBe(false);
      expect(CreativeEvaluator.detectsSVGUsage(kinetic)).toBe(false);
    });

    it('SVG score is unchanged by added braces (no brace/verbosity bonus)', () => {
      // Same SVG, but with meaningless empty-brace CSS comment padding appended
      // inside a style attribute — braces increase, real content does not.
      const padded = svg.replace(
        '</svg>',
        '<style> .x{} .y{} .z{} .q{} .w{} .e{} .r{} .t{} </style></svg>',
      );
      const base = CreativeEvaluator.assess(svg);
      const paddedResult = CreativeEvaluator.assess(padded);
      expect(paddedResult.score).toBe(base.score);
      expect(paddedResult.technicalScore).toBe(base.technicalScore);
    });

    it('kinetic score is unchanged by added empty braces (no brace bonus)', () => {
      const padded = kinetic.replace(
        '</style>',
        ' .p1{} .p2{} .p3{} .p4{} .p5{} .p6{} .p7{} .p8{} </style>',
      );
      const base = CreativeEvaluator.assess(kinetic);
      const paddedResult = CreativeEvaluator.assess(padded);
      expect(paddedResult.score).toBe(base.score);
      expect(paddedResult.technicalScore).toBe(base.technicalScore);
    });

    it('SVG/kinetic leave emergence/interestingness unscored (honesty)', () => {
      const svgResult = CreativeEvaluator.assess(svg);
      const kineticResult = CreativeEvaluator.assess(kinetic);
      expect(svgResult.emergenceScore).toBeUndefined();
      expect(svgResult.interestingnessScore).toBeUndefined();
      expect(kineticResult.emergenceScore).toBeUndefined();
      expect(kineticResult.interestingnessScore).toBeUndefined();
    });
  });
});
