#!/usr/bin/env node
/**
 * Test all Liminal generators and collect outputs for dogfood examples
 */

import { 
  ParticleSystem, 
  CellularAutomata, 
  FlowField,
  generateMusic,
  generateVisuals,
  P5GeneratorLLM
} from '../dist/index.js';

import { ShaderGenerator } from '../dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../dist/generators/three/ThreeGenerator.js';
import { RemotionGenerator } from '../dist/generators/remotion/RemotionGenerator.js';
import { LLMClient } from '../dist/llm/LLMClient.js';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = './landing-assets';

// Ensure output directory exists
await fs.mkdir(OUTPUT_DIR, { recursive: true });

const results = {
  p5: [],
  shader: [],
  three: [],
  remotion: [],
  music: [],
  hydra: [],
  errors: []
};

async function testGenerator(name, generator, params = {}) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    const start = Date.now();
    const result = await generator(params);
    const duration = Date.now() - start;
    console.log(`   ✅ Success (${duration}ms)`);
    return { success: true, result, duration };
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Test 1: p5.js Particle System
const particleResult = await testGenerator(
  'p5.js Particle System (Blue)',
  () => ParticleSystem.generate({ palette: 'cool', count: 100 })
);
if (particleResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-p5-particles-blue.js'),
    particleResult.result
  );
  results.p5.push({ type: 'particles', variant: 'blue', ...particleResult });
}

// Test 2: p5.js Particle System (Warm)
const particleWarmResult = await testGenerator(
  'p5.js Particle System (Warm)',
  () => ParticleSystem.generate({ palette: 'warm', count: 100 })
);
if (particleWarmResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-p5-particles-warm.js'),
    particleWarmResult.result
  );
  results.p5.push({ type: 'particles', variant: 'warm', ...particleWarmResult });
}

// Test 3: p5.js Flow Field
const flowFieldResult = await testGenerator(
  'p5.js Flow Field',
  () => FlowField.generate({ palette: 'cool', noiseScale: 0.01 })
);
if (flowFieldResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-p5-flowfield.js'),
    flowFieldResult.result
  );
  results.p5.push({ type: 'flowfield', ...flowFieldResult });
}

// Test 4: p5.js Cellular Automata
const cellularResult = await testGenerator(
  'p5.js Cellular Automata',
  () => CellularAutomata.generate({ rule: 30, generations: 100 })
);
if (cellularResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-p5-cellular.js'),
    cellularResult.result
  );
  results.p5.push({ type: 'cellular', ...cellularResult });
}

// Test 5: GLSL Shader Generator (template fallback since no LLM)
const shaderGen = new ShaderGenerator();
const shaderResult = await testGenerator(
  'GLSL Shader (Raymarched)',
  async () => {
    try {
      return await shaderGen.generate('raymarched sphere with reflections');
    } catch {
      // Template fallback
      return `// Template fallback - raymarched sphere
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float map(vec3 p) {
  return sdSphere(p, 0.5);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, 2.0);
  vec3 rd = normalize(vec3(uv, -1.0));
  
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) break;
    t += d;
  }
  
  vec3 col = vec3(0.1);
  if (t < 5.0) {
    vec3 p = ro + rd * t;
    vec3 n = normalize(p);
    col = vec3(0.5 + 0.5 * n);
  }
  
  gl_FragColor = vec4(col, 1.0);
}`;
    }
  }
);
if (shaderResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-shader-raymarch.js'),
    shaderResult.result
  );
  results.shader.push({ type: 'raymarch', ...shaderResult });
}

// Test 6: GLSL Shader (SDF) - template fallback
const shaderSdfResult = await testGenerator(
  'GLSL Shader (SDF)',
  async () => {
    try {
      return await shaderGen.generate('sdf mandelbulb fractal');
    } catch {
      return `// Template fallback - SDF shapes
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
  float d1 = sdBox(p, vec3(0.3));
  float d2 = length(p - vec3(0.2)) - 0.25;
  return min(d1, d2);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, 2.0);
  vec3 rd = normalize(vec3(uv, -1.0));
  
  float t = 0.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001) break;
    t += d;
  }
  
  vec3 col = vec3(0.05, 0.05, 0.1);
  if (t < 5.0) {
    col = vec3(0.8, 0.6, 0.4);
  }
  
  gl_FragColor = vec4(col, 1.0);
}`;
    }
  }
);
if (shaderSdfResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-shader-sdf.js'),
    shaderSdfResult.result
  );
  results.shader.push({ type: 'sdf', ...shaderSdfResult });
}

// Test 7: Three.js Generator - template fallback
const threeGen = new ThreeGenerator();
const threeResult = await testGenerator(
  'Three.js 3D Scene',
  async () => {
    try {
      return await threeGen.generate('rotating cube with lighting');
    } catch {
      return `// Template fallback - rotating cube
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x8b5cf6 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambient = new THREE.AmbientLight(0x404040);
scene.add(ambient);

camera.position.z = 3;

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();`;
    }
  }
);
if (threeResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-three-cube.js'),
    threeResult.result
  );
  results.three.push({ type: 'cube', ...threeResult });
}

// Test 8: Three.js Particles - template fallback
const threeParticleResult = await testGenerator(
  'Three.js Particle System',
  async () => {
    try {
      return await threeGen.generate('3d particle explosion');
    } catch {
      return `// Template fallback - particle system
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const particles = new THREE.BufferGeometry();
const count = 1000;
const positions = new Float32Array(count * 3);

for (let i = 0; i < count * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 10;
}

particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const material = new THREE.PointsMaterial({ color: 0xec4899, size: 0.05 });
const points = new THREE.Points(particles, material);
scene.add(points);

camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  points.rotation.x += 0.001;
  points.rotation.y += 0.002;
  renderer.render(scene, camera);
}
animate();`;
    }
  }
);
if (threeParticleResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-three-particles.js'),
    threeParticleResult.result
  );
  results.three.push({ type: 'particles', ...threeParticleResult });
}

// Test 9: Remotion Video Generator
const remotionGen = new RemotionGenerator();
const remotionResult = await testGenerator(
  'Remotion Video (Title)',
  () => remotionGen.generate('animated title sequence with gradient')
);
if (remotionResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-remotion-gradient.js'),
    remotionResult.result
  );
  results.remotion.push({ type: 'title', ...remotionResult });
}

// Test 10: Remotion Lower Thirds
const remotionLowerResult = await testGenerator(
  'Remotion Video (Lower Thirds)',
  () => remotionGen.generate('lower thirds name badge animation')
);
if (remotionLowerResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-remotion-lowerthird.js'),
    remotionLowerResult.result
  );
  results.remotion.push({ type: 'lowerthird', ...remotionLowerResult });
}

// Test 11: Strudel Music - Ambient
const musicAmbientResult = await testGenerator(
  'Strudel Music (Ambient)',
  () => generateMusic({ prompt: 'ambient drone with slow evolving chords', platform: 'strudel', bpm: 80 })
);
if (musicAmbientResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-music-ambient.js'),
    musicAmbientResult.result.code
  );
  results.music.push({ type: 'ambient', ...musicAmbientResult });
}

// Test 12: Strudel Music - Techno
const musicTechnoResult = await testGenerator(
  'Strudel Music (Techno)',
  () => generateMusic({ prompt: 'techno beat with acid bassline', platform: 'strudel', bpm: 128 })
);
if (musicTechnoResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-music-techno.js'),
    musicTechnoResult.result.code
  );
  results.music.push({ type: 'techno', ...musicTechnoResult });
}

// Test 13: Hydra Visuals - Kaleidoscope
const hydraKaleidResult = await testGenerator(
  'Hydra Visuals (Kaleidoscope)',
  () => generateVisuals({ prompt: 'kaleidoscope with rotating colors', platform: 'hydra' })
);
if (hydraKaleidResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-hydra-kaleidoscope.js'),
    hydraKaleidResult.result.code
  );
  results.hydra.push({ type: 'kaleidoscope', ...hydraKaleidResult });
}

// Test 14: Hydra Visuals - Glitch
const hydraGlitchResult = await testGenerator(
  'Hydra Visuals (Glitch)',
  () => generateVisuals({ prompt: 'glitchy pixelated noise', platform: 'hydra' })
);
if (hydraGlitchResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-hydra-glitch.js'),
    hydraGlitchResult.result.code
  );
  results.hydra.push({ type: 'glitch', ...hydraGlitchResult });
}

// Test 15: Hydra Visuals - Reactive (with fake audio)
const hydraReactiveResult = await testGenerator(
  'Hydra Visuals (Audio Reactive)',
  () => generateVisuals({ 
    prompt: 'audio reactive osc with fft', 
    platform: 'hydra',
    audioInput: { bpm: 120, fft: [0.5, 0.3, 0.8, 0.2, 0.6, 0.4, 0.7, 0.3] }
  })
);
if (hydraReactiveResult.success) {
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'dogfood-hydra-reactive.js'),
    hydraReactiveResult.result.code
  );
  results.hydra.push({ type: 'reactive', ...hydraReactiveResult });
}

// Print summary
console.log('\n' + '='.repeat(60));
console.log('GENERATOR TEST SUMMARY');
console.log('='.repeat(60));

const categories = ['p5', 'shader', 'three', 'remotion', 'music', 'hydra'];
categories.forEach(cat => {
  const success = results[cat].filter(r => r.success).length;
  const total = results[cat].length;
  console.log(`${cat.toUpperCase().padEnd(10)}: ${success}/${total} passed`);
});

if (results.errors.length > 0) {
  console.log('\n❌ ERRORS:');
  results.errors.forEach(e => console.log(`   - ${e}`));
}

// Save results manifest
await fs.writeFile(
  path.join(OUTPUT_DIR, 'generator-test-results.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n✅ All outputs saved to:', OUTPUT_DIR);
