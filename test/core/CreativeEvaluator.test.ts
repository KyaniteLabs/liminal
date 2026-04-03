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
});
