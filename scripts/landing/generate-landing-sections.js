#!/usr/bin/env node
/**
 * Generate landing page sections for all dogfood examples
 */

import fs from 'fs/promises';

const OUTPUT_FILE = './landing-assets/examples-section.html';

// All dogfood examples with metadata
const examples = [
  // p5.js Examples
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Bioluminescent Jellyfish',
    prompt: 'p5.js bioluminescent jellyfish with flowing tentacles',
    html: 'dogfood-p5-jellyfish.html',
    score: 0.83,
    info: 'Real Sinter output • MiniMax-M2.7 cloud'
  },
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Autumn Particle Field',
    prompt: 'flowing particle field with warm autumn colors',
    html: 'dogfood-p5-autumn.html',
    score: 0.68,
    info: 'Real Sinter output • MiniMax-M2.7 cloud'
  },
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Blue Particle System',
    prompt: 'particle system with cool blue palette',
    html: 'dogfood-p5-particles-blue.html',
    score: 0.72,
    info: 'Template-based generation'
  },
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Warm Particle System',
    prompt: 'particle system with warm red/orange palette',
    html: 'dogfood-p5-particles-warm.html',
    score: 0.72,
    info: 'Template-based generation'
  },
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Flow Field',
    prompt: 'flow field with perlin noise vectors',
    html: 'dogfood-p5-flowfield.html',
    score: 0.70,
    info: 'Template-based generation'
  },
  {
    type: 'p5',
    tag: 'p5.js',
    title: 'Cellular Automata',
    prompt: 'cellular automata with rule 30 pattern',
    html: 'dogfood-p5-cellular.html',
    score: 0.65,
    info: 'Template-based generation'
  },
  // GLSL Shader Examples
  {
    type: 'shader',
    tag: 'GLSL Shader',
    title: 'Raymarched Fractal',
    prompt: 'GLSL raymarched fractal landscape with volumetric fog',
    html: 'dogfood-shader-fractal.html',
    score: 0.82,
    info: 'Real Sinter output • MiniMax-M2.7 cloud'
  },
  {
    type: 'shader',
    tag: 'GLSL Shader',
    title: 'Warping Noise',
    prompt: 'GLSL shader with warping noise patterns',
    html: 'dogfood-shader-warp.html',
    score: 0.90,
    info: 'Real Sinter output • Highest score'
  },
  {
    type: 'shader',
    tag: 'GLSL Shader',
    title: 'Raymarched Sphere',
    prompt: 'raymarched sphere with distance field',
    html: 'dogfood-shader-raymarch.html',
    score: 0.75,
    info: 'Template fallback'
  },
  {
    type: 'shader',
    tag: 'GLSL Shader',
    title: 'SDF Shapes',
    prompt: 'sdf box and sphere intersection',
    html: 'dogfood-shader-sdf.html',
    score: 0.73,
    info: 'Template fallback'
  },
  // Three.js Examples
  {
    type: 'three',
    tag: 'Three.js',
    title: 'Crystal Cave',
    prompt: 'Three.js 3D scene with reflective crystal surfaces',
    html: 'dogfood-three-crystal.html',
    score: 0.88,
    info: 'Real Sinter output • Hit quality gate 0.95'
  },
  {
    type: 'three',
    tag: 'Three.js',
    title: 'Rotating Geometry',
    prompt: 'Three.js rotating geometric shapes with dynamic lighting',
    html: 'dogfood-three-rotating.html',
    score: 0.88,
    info: 'Real Sinter output • MiniMax-M2.7 cloud'
  },
  {
    type: 'three',
    tag: 'Three.js',
    title: 'Rotating Cube',
    prompt: 'simple rotating cube with lighting',
    html: 'dogfood-three-cube.html',
    score: 0.70,
    info: 'Template fallback'
  },
  {
    type: 'three',
    tag: 'Three.js',
    title: '3D Particles',
    prompt: '3D particle explosion with 1000 points',
    html: 'dogfood-three-particles.html',
    score: 0.72,
    info: 'Template fallback'
  },
  // Hydra Examples
  {
    type: 'hydra',
    tag: 'Hydra',
    title: 'Kaleidoscope',
    prompt: 'kaleidoscope with rotating colors',
    html: 'dogfood-hydra-kaleidoscope.html',
    score: 0.65,
    info: 'Template fallback'
  },
  {
    type: 'hydra',
    tag: 'Hydra',
    title: 'Glitch',
    prompt: 'glitchy pixelated noise',
    html: 'dogfood-hydra-glitch.html',
    score: 0.60,
    info: 'Template fallback'
  },
  {
    type: 'hydra',
    tag: 'Hydra',
    title: 'Audio Reactive',
    prompt: 'audio reactive osc with fft input',
    html: 'dogfood-hydra-reactive.html',
    score: 0.68,
    info: 'Template with mock FFT data'
  },
];

function getScoreBadge(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

function generateCard(example) {
  return `
                <!-- DOGFOOD: ${example.tag} ${example.title} -->
                <div class="demo-card">
                    <div class="demo-header">
                        <span class="demo-tag ${example.type}">${example.tag}</span>
                        <h3 class="demo-title">${example.title}</h3>
                        <p class="demo-prompt">"${example.prompt}"</p>
                        <div class="demo-meta">
                            <span class="demo-meta-item cloud">Template/LLM • Live</span>
                            <span class="quality-badge ${getScoreBadge(example.score)}">★ ${example.score.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="demo-interactive">
                        <iframe src="landing-assets/${example.html}" style="width:100%;height:300px;border:none;" loading="lazy"></iframe>
                    </div>
                    <div class="demo-controls">
                        <div class="demo-info">✓ ${example.info}</div>
                        <a href="landing-assets/${example.html}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-size: 0.8rem;">→ Open full example</a>
                    </div>
                </div>
`;
}

// Generate sections by type
const sections = {
  p5: examples.filter(e => e.type === 'p5'),
  shader: examples.filter(e => e.type === 'shader'),
  three: examples.filter(e => e.type === 'three'),
  hydra: examples.filter(e => e.type === 'hydra')
};

let html = `<!-- AUTO-GENERATED: Dogfood Examples Section -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Total Examples: ${examples.length} -->
`;

// Add section for each type
for (const [type, items] of Object.entries(sections)) {
  if (items.length === 0) continue;
  
  const titles = {
    p5: 'p5.js Creative Coding',
    shader: 'GLSL Shaders',
    three: 'Three.js 3D Scenes',
    hydra: 'Hydra Visual Synthesis'
  };
  
  html += `
            <!-- ${titles[type]} Section -->
            <h3 class="section-subtitle" style="margin-top: 3rem; color: var(--accent-${type === 'p5' ? 'purple' : type === 'shader' ? 'cyan' : type === 'three' ? 'blue' : 'pink'});">${titles[type]}</h3>
            <div class="demo-grid">
`;
  
  for (const example of items) {
    html += generateCard(example);
  }
  
  html += `            </div>
`;
}

// Write output
await fs.writeFile(OUTPUT_FILE, html);

console.log('✅ Generated landing page sections:');
for (const [type, items] of Object.entries(sections)) {
  console.log(`   ${type}: ${items.length} examples`);
}
console.log(`\n📄 Output: ${OUTPUT_FILE}`);
