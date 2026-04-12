import { describe, it, expect } from 'vitest';
/**
 * CreativeEvaluator unit tests
 */

import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';

describe('CreativeEvaluator', () => {
  describe('assess', () => {
    it('should reject non-string input', () => {
      const result = CreativeEvaluator.assess(42);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContain('Invalid output type');
    });

    it('should reject empty string', () => {
      const result = CreativeEvaluator.assess('');
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Empty output');
    });

    it('should reject whitespace-only string', () => {
      const result = CreativeEvaluator.assess('   ');
      expect(result.passed).toBe(false);
    });

    it('should detect missing setup() and draw()', () => {
      const result = CreativeEvaluator.assess('console.log("hello")');
      expect(result.issues).toContain('Missing setup() function');
      expect(result.issues).toContain('Missing draw() function');
    });

    it('should pass valid p5.js sketch', () => {
      const code = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  fill(255, 0, 0);
  ellipse(200, 200, 50, 50);
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
      expect(result.technicalScore).toBeGreaterThan(0);
    });

    it('should detect animation usage', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { ellipse(frameCount * 2, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.usesAnimation).toBe(true);
    });

    it('should detect color usage', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { fill(255, 0, 0); rect(0, 0, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.usesColor).toBe(true);
    });

    it('should detect interactivity', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { ellipse(mouseX, mouseY, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.hasInteractivity).toBe(true);
    });
  });

  describe('evaluationCriteria', () => {
    it('should use default scoring when no criteria provided', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); ellipse(200, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      // Default: technicalScore * 0.6 + creativeScore * 0.4
      expect(result.score).toBeGreaterThan(0);
    });

    it('should average provided criteria', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); ellipse(200, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code, {
        evaluationCriteria: ['technical', 'novelty'],
      });
      expect(result.score).toBeGreaterThan(0);
    });

    it('should calculate emergence score', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() {
  for (let i = 0; i < particles.length; i++) {
    particles[i].update(velocity, acceleration);
  }
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.emergenceScore).toBeGreaterThan(0);
    });

    it('should calculate interestingness score', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() {
  fill(255, 0, 0);
  rect(0, 0, 50, 50);
  fill(0, 255, 0);
  ellipse(200, 200, 50, 50);
  triangle(100, 100, 150, 100);
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.interestingnessScore).toBeGreaterThan(0);
    });
  });

  describe('getFitness', () => {
    it('should return score and issues', () => {
      const result = CreativeEvaluator.getFitness('invalid');
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('shader detection', () => {
    it('should detect GLSL shader code', () => {
      const code = `precision highp float;
void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;
      expect(CreativeEvaluator.detectsShaderUsage(code)).toBe(true);
    });

    it('should detect Three.js code', () => {
      const code = `import * as THREE from 'three';
const scene = new THREE.Scene();`;
      expect(CreativeEvaluator.detectsThreeUsage(code)).toBe(true);
    });

    it('should evaluate Revideo scene code without falling back to p5 issues', () => {
      const code = `import {makeScene2D, Txt} from '@revideo/2d';
import {createRef} from '@revideo/core';

export default makeScene2D(function* (view) {
  const title = createRef();
  view.add(<Txt ref={title} text="Hello Revideo" />);
  yield* title().opacity(1, 0.6);
});`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.6);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
    });

    it('should evaluate legacy Remotion component code with specialized video scoring', () => {
      const code = `import React from 'react';
import {useCurrentFrame, interpolate, AbsoluteFill} from 'remotion';

export const TypingText = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  return (
    <AbsoluteFill style={{ backgroundColor: 'black', opacity }}>
      <div>Hello Video</div>
    </AbsoluteFill>
  );
};`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.6);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
    });

    it('should keep obviously broken video-component code below the pass threshold', () => {
      const code = `import {useCurrentFrame, AbsoluteFill} from 'remotion';

export const BrokenComp = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill duration={150}>
      <Video frame={frame.value} />
    </AbsoluteFill>
  );
};`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.score).toBeLessThan(0.7);
    });

    it('should evaluate raw multiline ASCII art as an artifact instead of code', () => {
      const art = `
        .    *         .       .    *    .          .
           *         .    *         .          .    *         .
                .          .    *         .          .    *     .
             .         *          .    *         .          .       *
                  *         .          .    *         .
                 /\\
                /  \\
               /____\\
              | [] [] |
              |  __  |
              |______|
      `;
      const result = CreativeEvaluator.assess(art, { domain: 'ascii' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.6);
      expect(result.issues).not.toContain('Missing ASCII art characters');
    });

    it('should keep ascii error placeholders below the pass threshold', () => {
      const errorPlaceholder = '// LLM generation failed: LLM API error: 400 Bad Request';
      const result = CreativeEvaluator.assess(errorPlaceholder, { domain: 'ascii' });
      expect(result.score).toBeLessThan(0.7);
    });
  });
});
