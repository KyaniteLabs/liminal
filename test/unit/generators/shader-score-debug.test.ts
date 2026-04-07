import { describe, it, expect } from 'vitest';
import { CreativeEvaluator } from '../../../src/core/CreativeEvaluator.js';

/**
 * Shader scoring tests — verify that GLSL shaders with genuine visual quality
 * pass the 0.70 threshold, while trivial shaders correctly fail.
 *
 * Fix context: The plasma template (a project-bundled shader) scored 0.65 before
 * the fix because the creative dimension underweighted GLSL-specific techniques
 * like UV manipulation, math functions, and component-wise color construction.
 */
describe('CreativeEvaluator shader scoring', () => {
  const PLASMA_SHADER = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.5;
  float v = sin(uv.x * 10.0 + t);
  v += sin((uv.y * 10.0 + t) * 0.5);
  v += sin((uv.x * 10.0 + uv.y * 10.0 + t) * 0.3);
  v += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 10.0 + t);
  vec3 col;
  col.r = sin(v * 3.14159) * 0.5 + 0.5;
  col.g = sin(v * 3.14159 + 2.094) * 0.5 + 0.5;
  col.b = sin(v * 3.14159 + 4.188) * 0.5 + 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

  const FRACTAL_SHADER = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  vec2 c = uv * 2.5 - vec2(0.5 + sin(u_time * 0.1) * 0.3, 0.0);
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 128; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
  }
  float t = iter / 128.0;
  vec3 col = 0.5 + 0.5 * cos(3.0 + t * 6.2832 * 2.0 + vec3(0.0, 0.6, 1.0));
  col *= smoothstep(0.0, 0.02, t);
  gl_FragColor = vec4(col, 1.0);
}`;

  const SIMPLE_SHADER = `precision highp float;
uniform float u_time;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;

  it('plasma shader should pass the 0.70 quality threshold', () => {
    const result = CreativeEvaluator.assess(PLASMA_SHADER);
    expect(result.score).toBeGreaterThanOrEqual(0.70);
    expect(result.passed).toBe(true);
    expect(result.technicalScore).toBeGreaterThanOrEqual(0.80);
    expect(result.creativeScore).toBeGreaterThanOrEqual(0.50);
  });

  it('fractal shader should pass the 0.70 quality threshold', () => {
    const result = CreativeEvaluator.assess(FRACTAL_SHADER);
    expect(result.score).toBeGreaterThanOrEqual(0.70);
    expect(result.passed).toBe(true);
    expect(result.technicalScore).toBeGreaterThanOrEqual(0.80);
    expect(result.creativeScore).toBeGreaterThanOrEqual(0.50);
  });

  it('simple shader should fail the 0.70 quality threshold', () => {
    const result = CreativeEvaluator.assess(SIMPLE_SHADER);
    expect(result.score).toBeLessThan(0.50);
    expect(result.passed).toBe(false);
  });

  it('complex shaders should score higher than simple shaders', () => {
    const plasmaResult = CreativeEvaluator.assess(PLASMA_SHADER);
    const simpleResult = CreativeEvaluator.assess(SIMPLE_SHADER);
    expect(plasmaResult.score - simpleResult.score).toBeGreaterThan(0.3);
  });

  it('should reward UV manipulation via gl_FragCoord', () => {
    const withUV = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  vec3 col = vec3(st.x, st.y, 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;
    const withoutUV = `precision highp float;
uniform float u_time;
void main() {
  vec3 col = vec3(0.5, 0.5, 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;
    const withResult = CreativeEvaluator.assess(withUV);
    const withoutResult = CreativeEvaluator.assess(withoutUV);
    expect(withResult.creativeScore).toBeGreaterThan(withoutResult.creativeScore);
  });

  it('should reward math functions like sqrt, pow, abs', () => {
    const withMath = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float d = sqrt(st.x * st.x + st.y * st.y);
  vec3 col = vec3(pow(d, 0.5));
  gl_FragColor = vec4(col, 1.0);
}`;
    const withoutMath = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  vec3 col = vec3(st.x);
  gl_FragColor = vec4(col, 1.0);
}`;
    const withResult = CreativeEvaluator.assess(withMath);
    const withoutResult = CreativeEvaluator.assess(withoutMath);
    expect(withResult.creativeScore).toBeGreaterThan(withoutResult.creativeScore);
  });
});
