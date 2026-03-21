import { describe, it, expect } from 'vitest';
/**
 * CreativeEvaluator shader detection tests
 */

import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';

describe('CreativeEvaluator shader handling', () => {
  const validShader = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  gl_FragColor = vec4(uv, 0.0, 1.0);
}`;

  it('detects GLSL shader usage', () => {
    expect(CreativeEvaluator.detectsShaderUsage(validShader)).toBe(true);
  });

  it('does not detect p5.js as shader', () => {
    const p5Code = `function setup() { createCanvas(800, 600); }
function draw() { background(20); }`;
    expect(CreativeEvaluator.detectsShaderUsage(p5Code)).toBe(false);
  });

  it('assess() returns valid result for shader code', () => {
    const result = CreativeEvaluator.assess(validShader);
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('issues');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('shader with ray marching scores higher', () => {
    const simpleShader = `precision highp float;
uniform vec2 u_resolution;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;

    const advancedShader = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float d = length(uv - 0.5);
  for (int i = 0; i < 50; i++) { d -= 0.01; }
  vec3 col = vec3(sin(u_time) * 0.5 + 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

    const simpleResult = CreativeEvaluator.assess(simpleShader);
    const advancedResult = CreativeEvaluator.assess(advancedShader);
    expect(advancedResult.score).toBeGreaterThan(simpleResult.score);
  });
});
