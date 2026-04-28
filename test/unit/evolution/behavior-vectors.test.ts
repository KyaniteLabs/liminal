import { describe, it, expect } from 'vitest';
import { detectDomain, extractBehavior } from '../../../src/evolution/BehaviorVectors.js';

// ── Sample code snippets for testing ──

const p5Code = `
function setup() {
  createCanvas(400, 400);
  colorMode(HSB);
}

function draw() {
  fill(frameCount % 360, 80, 100);
  ellipse(mouseX, mouseY, 50);
}
`;

const glslCode = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragColor.xy / u_resolution.xy;
  float d = length(uv - 0.5);
  vec3 col = mix(vec3(0.0), vec3(1.0), smoothstep(0.4, 0.5, d));
  gl_FragColor = vec4(col, 1.0);
}
`;

const threeCode = `
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial();
const mesh = new THREE.Mesh(geometry, material);
const light = new THREE.DirectionalLight(0xffffff);
scene.add(light);

function animate() {
  requestAnimationFrame(animate);
  mesh.rotation.x += 0.01;
  renderer.render(scene, camera);
}
`;

const musicCode = `
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain);
gain.connect(ctx.destination);
osc.frequency.value = 440;
osc.type = 'sine';
gain.gain.setValueAtTime(0, ctx.currentTime);
gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.1);
osc.start();
`;

const unknownCode = `console.log("hello world");`;

// ── detectDomain tests ──

describe('detectDomain', () => {
  it('identifies p5 code', () => {
    expect(detectDomain(p5Code)).toBe('p5');
  });

  it('identifies GLSL code', () => {
    expect(detectDomain(glslCode)).toBe('glsl');
  });

  it('identifies Three.js code', () => {
    expect(detectDomain(threeCode)).toBe('three');
  });

  it('identifies music code', () => {
    expect(detectDomain(musicCode)).toBe('music');
  });

  it('defaults to p5 for unknown code', () => {
    expect(detectDomain(unknownCode)).toBe('p5');
  });
});

// ── extractBehavior tests ──

describe('extractBehavior', () => {
  it('returns array of 64 numbers (8 domains × 8 features)', () => {
    const vec = extractBehavior(p5Code);
    expect(vec).toHaveLength(64);
    expect(vec.every(v => typeof v === 'number')).toBe(true);
  });

  it('values are in [0, 1] range', () => {
    const vec = extractBehavior(threeCode);
    for (const v of vec) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('detects domain automatically when not specified', () => {
    const p5Vec = extractBehavior(p5Code);
    const glslVec = extractBehavior(glslCode);
    // p5 code should have non-zero p5 features (indices 0-7)
    expect(p5Vec.slice(0, 8).some(v => v > 0)).toBe(true);
    // glsl code should have non-zero glsl features (indices 8-15)
    expect(glslVec.slice(8, 16).some(v => v > 0)).toBe(true);
  });

  it('for p5 sets setup/draw features', () => {
    const vec = extractBehavior(p5Code);
    expect(vec[0]).toBe(1); // hasSetup
    expect(vec[1]).toBe(1); // hasDraw
    expect(vec[3]).toBe(1); // usesColor (fill, colorMode)
    expect(vec[4]).toBe(1); // hasInteractivity (mouseX, mouseY)
    expect(vec[2]).toBe(1); // usesAnimation (frameCount)
  });

  it('for GLSL sets shader features', () => {
    const vec = extractBehavior(glslCode);
    expect(vec[8]).toBe(1);  // hasPrecision
    expect(vec[14]).toBe(1); // usesTime (u_time)
    expect(vec[12]).toBe(1); // usesColorOperations (mix, smoothstep)
    expect(vec[10]).toBe(1); // usesMathFunctions (length)
  });

  it('for Three.js sets 3D features', () => {
    const vec = extractBehavior(threeCode);
    expect(vec[16]).toBe(1); // hasScene
    expect(vec[17]).toBe(1); // hasCamera
    expect(vec[18]).toBe(1); // hasRenderer
    expect(vec[19]).toBe(1); // hasGeometry
    expect(vec[20]).toBe(1); // hasMaterial
    expect(vec[21]).toBe(1); // hasLighting
    expect(vec[22]).toBe(1); // hasAnimation (requestAnimationFrame)
  });

  it('for music sets audio features', () => {
    const vec = extractBehavior(musicCode);
    expect(vec[24]).toBe(1); // hasOscillator
    expect(vec[30]).toBe(1); // hasEnvelope (attack via linearRamp)
  });

  it('returns zeros for non-matching domain features', () => {
    const vec = extractBehavior(p5Code);
    // p5 code: all non-p5 slots (8-71) should be all 0
    expect(vec.slice(8, 64).every(v => v === 0)).toBe(true);
  });
});
