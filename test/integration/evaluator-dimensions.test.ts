import { describe, it, expect } from 'vitest';
/**
 * Integration test: CreativeEvaluator with all evaluation dimensions
 * Tests emergence, interestingness, aesthetic, novelty scoring together.
 */

import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';
import { NoveltyArchive } from '../../src/evolution/NoveltyArchive.js';

describe('CreativeEvaluator + evaluation dimensions', () => {
  describe('emergence scoring', () => {
    it('should score particle systems high on emergence', () => {
      const code = `function setup() {
  createCanvas(800, 600);
  for (let i = 0; i < 100; i++) {
    particles.push({ x: random(width), y: random(height), vx: 0, vy: 0, ax: 0, ay: 0 });
  }
}

function draw() {
  background(0);
  for (let i = 0; i < particles.length; i++) {
    particles[i].ax = noise(particles[i].x * 0.01, particles[i].y * 0.01) - 0.5;
    particles[i].ay = noise(particles[i].x * 0.01 + 100, particles[i].y * 0.01) - 0.5;
    particles[i].vx += particles[i].ax;
    particles[i].vy += particles[i].ay;
    particles[i].x += particles[i].vx;
    particles[i].y += particles[i].vy;
    particles.push({ x: particles[i].x, y: particles[i].y });
    if (particles.length > 500) particles.splice(0, 1);
    ellipse(particles[i].x, particles[i].y, 3, 3);
  }
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.emergenceScore).toBeGreaterThan(0.5);
      expect(result.metrics.usesArrays).toBe(true);
    });

    it('should score cellular automata high on emergence', () => {
      const code = `function setup() {
  createCanvas(400, 400);
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      grid[i][j] = floor(random(2));
    }
  }
}

function draw() {
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let neighbors = countNeighbors(grid, i, j);
      if (grid[i][j] === 1) {
        if (neighbors < 2 || neighbors > 3) grid[i][j] = 0;
      } else {
        if (neighbors === 3) grid[i][j] = 1;
      }
      if (grid[i][j] === 1) fill(255);
      else fill(0);
      rect(i * cellSize, j * cellSize, cellSize, cellSize);
    }
  }
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.emergenceScore).toBeGreaterThan(0.2);
    });

    it('should score static art low on emergence', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); rect(50, 50, 100, 100); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.emergenceScore).toBeLessThan(0.3);
    });
  });

  describe('interestingness scoring', () => {
    it('should score diverse visual elements high', () => {
      const code = `function setup() { createCanvas(800, 600); colorMode(HSB); }
function draw() {
  background(0, 0, 10);
  for (let i = 0; i < 20; i++) {
    let n = noise(i * 0.1, frameCount * 0.01);
    fill(n * 360, 80, 90);
    if (random() > 0.5) ellipse(random(width), random(height), n * 50, n * 50);
    else rect(random(width), random(height), n * 50, n * 50);
  }
  triangle(100, 100, 150, 50, 200, 100);
  line(0, 0, width, height);
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.interestingnessScore).toBeGreaterThan(0.3);
    });

    it('should score minimal code low on interestingness', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); fill(255, 0, 0); rect(0, 0, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.interestingnessScore).toBeLessThan(0.2);
    });
  });

  describe('evaluation criteria integration', () => {
    it('should compute score from technical + emergence + interestingness', () => {
      const code = `function setup() {
  createCanvas(800, 600);
  for (let i = 0; i < 50; i++) {
    particles.push({ x: random(width), y: random(height), vx: 0, vy: 0, ax: 0, ay: 0 });
  }
}

function draw() {
  background(10);
  for (let i = 0; i < particles.length; i++) {
    let n = noise(particles[i].x * 0.01, particles[i].y * 0.01, frameCount * 0.01);
    let angle = n * TWO_PI * 2;
    particles[i].ax = cos(angle) * 0.5;
    particles[i].ay = sin(angle) * 0.5;
    particles[i].vx += particles[i].ax;
    particles[i].vy += particles[i].ay;
    particles[i].x += particles[i].vx;
    particles[i].y += particles[i].vy;
    fill(n * 255, 100, 200);
    ellipse(particles[i].x, particles[i].y, 5, 5);
    particles.push({ x: particles[i].x, y: particles[i].y, vx: 0, vy: 0, ax: 0, ay: 0 });
    if (particles.length > 300) particles.splice(0, 1);
  }
}`;
      const result = CreativeEvaluator.assess(code, {
        evaluationCriteria: ['technical', 'emergence', 'interestingness'],
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.emergenceScore).toBeGreaterThan(0);
      expect(result.interestingnessScore).toBeGreaterThan(0);
    });

    it('should compute novelty score with archive', () => {
      const archive = new NoveltyArchive();
      // Add existing behavior vectors
      archive.add([0.1, 0.2, 0.3]);
      archive.add([0.2, 0.3, 0.4]);

      const novelCode = `function setup() { createCanvas(800, 600); }
function draw() {
  for (let i = 0; i < 100; i++) {
    let x = noise(i, frameCount * 0.01) * width;
    let y = cos(i + frameCount * 0.02) * height / 2 + height / 2;
    ellipse(x, y, 10, 10);
  }
}`;
      const result = CreativeEvaluator.assess(novelCode, {
        evaluationCriteria: ['technical', 'novelty'],
        noveltyArchive: archive,
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.noveltyScore).toBeGreaterThan(0);
    });
  });

  describe('shader evaluation integration', () => {
    it('should evaluate GLSL shaders with specialized scoring', () => {
      const shader = `precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

void main() {
  vec2 st = gl_FragCoord.xy / u_resolution.xy;
  float d = length(st - 0.5);
  vec3 col = mix(vec3(0.1, 0.0, 0.3), vec3(1.0, 0.5, 0.0), smoothstep(0.5, 0.0, d));
  col += sin(st.x * 10.0 + u_time) * 0.1;
  gl_FragColor = vec4(col, 1.0);
}`;
      const result = CreativeEvaluator.assess(shader);
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should evaluate Three.js scenes with specialized scoring', () => {
      const threeCode = `import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();`;
      const result = CreativeEvaluator.assess(threeCode);
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
    });
  });
});
