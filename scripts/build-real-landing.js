#!/usr/bin/env node
/**
 * Build landing page with ONLY REAL MiniMax dogfood
 * NO TEMPLATES - NO FAKES - HONEST SCORES
 */

import fs from 'fs/promises';
import path from 'path';

const ASSETS_DIR = './landing-assets';

// REAL dogfood files with their actual sources
const realDogfood = [
  // p5.js - Real MiniMax outputs
  {
    id: 'p5-jellyfish',
    file: 'dogfood-p5-jellyfish.html',
    jsFile: 'dogfood-p5-jellyfish.js',
    title: 'Bioluminescent Jellyfish',
    prompt: 'p5.js bioluminescent jellyfish with flowing tentacles',
    tag: 'p5.js',
    score: 0.83,
    source: 'MiniMax-M2.7',
    iterations: 1,
    real: true
  },
  {
    id: 'p5-neon-cyberpunk',
    file: 'dogfood-p5-neon-cyberpunk.html',
    jsFile: 'dogfood-p5-neon-cyberpunk.js',
    title: 'Neon Cyberpunk City',
    prompt: 'p5.js cyberpunk city with neon lights, rain, and flying cars',
    tag: 'p5.js',
    score: 0.75,
    source: 'MiniMax-M2.7',
    iterations: 3,
    real: true
  },
  {
    id: 'p5-ocean',
    file: 'dogfood-p5-ocean-final.html',
    jsFile: 'dogfood-p5-ocean-final.js',
    title: 'Ocean Waves',
    prompt: 'p5.js realistic ocean waves with foam and seagulls',
    tag: 'p5.js',
    score: 0.68,
    source: 'MiniMax-M2.7',
    iterations: 3,
    note: 'Incomplete (cutoff)',
    real: true
  },
  
  // GLSL Shaders - Real MiniMax outputs
  {
    id: 'shader-fractal',
    file: 'dogfood-shader-fractal.html',
    jsFile: 'dogfood-shader-fractal.js',
    title: 'Raymarched Fractal',
    prompt: 'GLSL raymarched fractal landscape with volumetric fog',
    tag: 'GLSL Shader',
    score: 0.82,
    source: 'MiniMax-M2.7',
    iterations: 1,
    real: true
  },
  {
    id: 'shader-warp',
    file: 'dogfood-shader-warp.html',
    jsFile: 'dogfood-shader-warp.js',
    title: 'Warping Noise',
    prompt: 'GLSL shader with warping noise patterns',
    tag: 'GLSL Shader',
    score: 0.90,
    source: 'MiniMax-M2.7',
    iterations: 1,
    real: true
  },
  {
    id: 'shader-nebula',
    file: 'dogfood-shader-nebula-final.html',
    jsFile: 'dogfood-shader-nebula-final.js',
    title: 'Cosmic Nebula',
    prompt: 'GLSL shader cosmic nebula with stars',
    tag: 'GLSL Shader',
    score: 0.88,
    source: 'MiniMax-M2.7',
    iterations: 3,
    real: true
  },
  {
    id: 'shader-plasma',
    file: 'dogfood-shader-plasma-final.html',
    jsFile: 'dogfood-shader-plasma-final.js',
    title: 'Plasma Effect',
    prompt: 'GLSL shader with animated plasma effect',
    tag: 'GLSL Shader',
    score: 0.85,
    source: 'MiniMax-M2.7',
    iterations: 3,
    real: true
  },
  
  // Three.js - Real MiniMax outputs
  {
    id: 'three-crystal',
    file: 'dogfood-three-crystal.html',
    jsFile: 'dogfood-three-crystal.js',
    title: 'Crystal Cave',
    prompt: 'Three.js 3D scene with reflective crystal surfaces',
    tag: 'Three.js',
    score: 0.88,
    source: 'MiniMax-M2.7',
    iterations: 1,
    real: true
  },
  {
    id: 'three-rotating',
    file: 'dogfood-three-rotating.html',
    jsFile: 'dogfood-three-rotating.js',
    title: 'Rotating Geometry',
    prompt: 'Three.js rotating geometric shapes with dynamic lighting',
    tag: 'Three.js',
    score: 0.88,
    source: 'MiniMax-M2.7',
    iterations: 1,
    real: true
  },
  {
    id: 'three-abstract',
    file: 'dogfood-three-abstract-final.html',
    jsFile: 'dogfood-three-abstract-final.js',
    title: 'Abstract Sculpture',
    prompt: 'Three.js abstract geometric sculpture with iridescent materials',
    tag: 'Three.js',
    score: 0.86,
    source: 'MiniMax-M2.7',
    iterations: 3,
    real: true
  },
  
  // Hydra - Real MiniMax outputs (with <think> tags)
  {
    id: 'hydra-liquid',
    file: 'dogfood-hydra-liquid.html',
    jsFile: 'dogfood-hydra-liquid.js',
    title: 'Liquid Morphing',
    prompt: 'liquid morphing shapes with feedback trails',
    tag: 'Hydra',
    score: 0.72,
    source: 'MiniMax-M2.7',
    iterations: 1,
    note: 'Has reasoning tags',
    real: true
  },
  {
    id: 'hydra-geometric',
    file: 'dogfood-hydra-geometric.html',
    jsFile: 'dogfood-hydra-geometric.js',
    title: 'Geometric Grid',
    prompt: 'geometric patterns with rotating grid',
    tag: 'Hydra',
    score: 0.70,
    source: 'MiniMax-M2.7',
    iterations: 1,
    note: 'Has reasoning tags',
    real: true
  },
  
  // Music - Real MiniMax outputs
  {
    id: 'strudel-techno',
    file: null, // Code only, no HTML
    jsFile: 'dogfood-music-techno-driving.strudel.js',
    title: 'Techno Beat',
    prompt: 'driving techno beat with industrial percussion',
    tag: 'Strudel Music',
    score: 0.78,
    source: 'MiniMax-M2.7',
    iterations: 1,
    note: 'Paste at strudel.repl.co',
    real: true
  },
  {
    id: 'strudel-ambient',
    file: null,
    jsFile: 'dogfood-music-ambient-drone.strudel.js',
    title: 'Ambient Drone',
    prompt: 'ambient drone soundscape with slowly evolving textures',
    tag: 'Strudel Music',
    score: 0.75,
    source: 'MiniMax-M2.7',
    iterations: 1,
    note: 'Has reasoning tags',
    real: true
  },
  
  // Remotion - Real MiniMax output (low score!)
  {
    id: 'remotion-title',
    file: 'dogfood-remotion-title.html',
    jsFile: 'dogfood-remotion-title.js',
    title: 'Title Sequence',
    prompt: 'Remotion video title sequence with particle dissolve',
    tag: 'Remotion',
    score: 0.26, // HONEST LOW SCORE
    source: 'MiniMax-M2.7',
    iterations: 1,
    note: 'Low score - needs work',
    real: true
  }
];

function getScoreClass(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

function generateCard(example) {
  const scoreClass = getScoreClass(example.score);
  const noteText = example.note ? ` • ${example.note}` : '';
  
  if (!example.file) {
    // Code-only example (music)
    return `
                <!-- REAL: ${example.title} -->
                <div class="demo-card">
                    <div class="demo-header">
                        <span class="demo-tag ${example.tag.toLowerCase().replace(/\s+/g, '-').replace(/\.js/, '')}">${example.tag}</span>
                        <h3 class="demo-title">${example.title}</h3>
                        <p class="demo-prompt">"${example.prompt}"</p>
                        <div class="demo-meta">
                            <span class="demo-meta-item cloud">${example.iterations} iter • ${example.source}</span>
                            <span class="quality-badge ${scoreClass}">★ ${example.score.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="demo-interactive" style="padding: 1rem; background: #0a0a0f;">
                        <pre style="font-size: 0.7rem; color: #a0a0b0; overflow: auto; max-height: 280px;"><code>// Open in Strudel: strudel.repl.co
// ${example.jsFile}</code></pre>
                    </div>
                    <div class="demo-controls">
                        <div class="demo-info">✓ REAL MiniMax output${noteText}</div>
                        <a href="landing-assets/${example.jsFile}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-size: 0.8rem;">→ View code</a>
                    </div>
                </div>
`;
  }
  
  return `
                <!-- REAL: ${example.title} -->
                <div class="demo-card">
                    <div class="demo-header">
                        <span class="demo-tag ${example.tag.toLowerCase().replace(/\s+/g, '-').replace(/\.js/, '')}">${example.tag}</span>
                        <h3 class="demo-title">${example.title}</h3>
                        <p class="demo-prompt">"${example.prompt}"</p>
                        <div class="demo-meta">
                            <span class="demo-meta-item cloud">${example.iterations} iter • ${example.source}</span>
                            <span class="quality-badge ${scoreClass}">★ ${example.score.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="demo-interactive">
                        <iframe src="landing-assets/${example.file}" style="width:100%;height:300px;border:none;" loading="lazy"></iframe>
                    </div>
                    <div class="demo-controls">
                        <div class="demo-info">✓ REAL MiniMax output${noteText}</div>
                        <a href="landing-assets/${example.file}" target="_blank" style="color: var(--accent-blue); text-decoration: none; font-size: 0.8rem;">→ Open full example</a>
                    </div>
                </div>
`;
}

// Generate by category
const categories = [
  { name: 'p5.js Creative Coding', filter: e => e.tag === 'p5.js', color: 'purple' },
  { name: 'GLSL Shaders', filter: e => e.tag === 'GLSL Shader', color: 'cyan' },
  { name: 'Three.js 3D', filter: e => e.tag === 'Three.js', color: 'blue' },
  { name: 'Hydra Visuals', filter: e => e.tag === 'Hydra', color: 'pink' },
  { name: 'Strudel Music', filter: e => e.tag === 'Strudel Music', color: 'green' },
  { name: 'Remotion Video', filter: e => e.tag === 'Remotion', color: 'orange' }
];

let html = `<!-- TRUE DOGFOOD - 100% REAL MINIMAX OUTPUTS -->
<!-- Generated: ${new Date().toISOString()} -->
<!-- Total: ${realDogfood.length} real examples -->
<!-- NO TEMPLATES - NO FAKES -->

            <h3 class="section-subtitle" style="text-align: center; max-width: 800px; margin: 0 auto 2rem;">
                Every example below is a <strong>REAL output from MiniMax-M2.7</strong>. 
                Scores are honest — including the low ones. No cherry-picking.
            </h3>
`;

for (const cat of categories) {
  const items = realDogfood.filter(cat.filter);
  if (items.length === 0) continue;
  
  html += `
            <!-- ${cat.name} -->
            <h3 class="section-subtitle" style="margin-top: 3rem; color: var(--accent-${cat.color});">${cat.name}</h3>
            <div class="demo-grid">
`;
  
  for (const item of items) {
    html += generateCard(item);
  }
  
  html += `            </div>
`;
}

// Stats
const avgScore = realDogfood.reduce((a, e) => a + e.score, 0) / realDogfood.length;
const highScores = realDogfood.filter(e => e.score >= 0.8).length;
const lowScores = realDogfood.filter(e => e.score < 0.6).length;

html += `
            <!-- TRUE STATS -->
            <div style="margin-top: 4rem; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 12px; text-align: center;">
                <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Real Dogfood Statistics</h4>
                <div style="display: flex; justify-content: center; gap: 3rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--accent-purple);">${realDogfood.length}</div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Real Examples</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--accent-blue);">${avgScore.toFixed(2)}</div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Average Score</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--accent-green);">${highScores}</div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">High Quality (≥0.8)</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; font-weight: 700; color: var(--accent-pink);">${lowScores}</div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem;">Needs Work (&lt;0.6)</div>
                    </div>
                </div>
                <p style="margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.875rem;">
                    All generated with MiniMax-M2.7 via Liminal's Ralph-Wiggum loop • No manual fixes
                </p>
            </div>
`;

// Write output
await fs.writeFile('./landing-assets/TRUE-DOGFOOD-SECTION.html', html);

console.log('✅ TRUE DOGFOOD section generated');
console.log(`   ${realDogfood.length} real MiniMax examples`);
console.log(`   Average score: ${avgScore.toFixed(2)}`);
console.log(`   High quality: ${highScores}`);
console.log(`   Low quality: ${lowScores}`);
console.log('\nCategories:');
categories.forEach(c => {
  const count = realDogfood.filter(c.filter).length;
  if (count > 0) console.log(`   ${c.name}: ${count}`);
});
