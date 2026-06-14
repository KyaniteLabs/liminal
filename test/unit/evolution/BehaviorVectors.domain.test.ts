import { describe, it, expect } from 'vitest';
import { extractBehavior } from '../../../src/evolution/BehaviorVectors.js';

const SHADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float v = sin(uv.x * 10.0 + u_time) * cos(uv.y * 8.0);
    gl_FragColor = vec4(vec3(v), 1.0);
  }`;

const TONE = `
  const synth = new Tone.Synth().toDestination();
  synth.triggerAttackRelease("C4", "8n");
  const osc = new Tone.Oscillator(440, "sine");
  osc.frequency.rampTo(880, 2);`;

const P5 = `
  function setup() { createCanvas(400, 400); }
  function draw() { background(20); fill(255); ellipse(mouseX, mouseY, 50, 50); }`;

const glslBlock = (v: number[]) => v.slice(8, 16);
const musicBlock = (v: number[]) => v.slice(24, 32);
const p5Block = (v: number[]) => v.slice(0, 8);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('extractBehavior domain normalization (D4)', () => {
  it("maps the 'shader' synonym to glsl (identical vector to 'glsl')", () => {
    expect(extractBehavior(SHADER, 'shader')).toEqual(extractBehavior(SHADER, 'glsl'));
  });

  it("no longer zeros the vector for the 'shader' synonym (the bug)", () => {
    // Pre-fix, 'shader' matched no branch → glsl block all zeros.
    expect(sum(glslBlock(extractBehavior(SHADER, 'shader')))).toBeGreaterThan(0);
  });

  it("maps 'webgl' to glsl as well", () => {
    expect(extractBehavior(SHADER, 'webgl')).toEqual(extractBehavior(SHADER, 'glsl'));
  });

  it("maps the 'tone' synonym to music (identical vector to 'music')", () => {
    expect(extractBehavior(TONE, 'tone')).toEqual(extractBehavior(TONE, 'music'));
    expect(sum(musicBlock(extractBehavior(TONE, 'tone')))).toBeGreaterThan(0);
  });

  it('falls back to code-detection for a label with no extractor (svg)', () => {
    // 'svg' has no feature extractor; it must detect from the code, not zero out.
    expect(extractBehavior(P5, 'svg')).toEqual(extractBehavior(P5, undefined));
  });

  it('leaves a directly-recognized domain (p5) unchanged and non-zero', () => {
    expect(sum(p5Block(extractBehavior(P5, 'p5')))).toBeGreaterThan(0);
  });
});
