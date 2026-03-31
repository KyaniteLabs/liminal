#!/usr/bin/env tsx
/**
 * Fix wrapper infrastructure for 100% display coverage
 * Addresses: Three.js modules, Hydra API, Strudel imports, iframe permissions
 */

import { readFileSync, writeFileSync } from 'fs';

const MODELS = [
  { key: 'minimax/MiniMax-M2.7', short: 'minimax-m27' },
  { key: 'minimax/MiniMax-M2.5', short: 'minimax-m25' },
  { key: 'lmstudio/Qwen3.5-9B', short: 'qwen35' },
  { key: 'lmstudio/Qwen3-Coder-40B', short: 'qwen-coder' },
  { key: 'ollama/Gemma3-4B', short: 'gemma' },
  { key: 'ollama/Kimi-K2.5', short: 'kimi' },
];

function getCode(model: string, domain: string): string {
  try {
    return readFileSync(`examples/generated/${model}/${domain}/2026-03-31--default/v1.js`, 'utf-8');
  } catch {
    return '// Code not available';
  }
}

// FIXED Three.js wrapper - uses global THREE
function createThreeWrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
</head>
<body>
  <script>
    // Three.js code - wrapped to handle common patterns
    try {
      ${code}
    } catch(e) {
      console.error('Three.js error:', e);
      document.body.innerHTML = '<div style="color:red;padding:20px;">Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
}

// FIXED Hydra wrapper - proper initialization
function createHydraWrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://unpkg.com/hydra-synth@1.3.29/dist/hydra-synth.js"></script>
  <style>body { margin: 0; background: #000; overflow: hidden; }</style>
</head>
<body>
  <canvas id="hydra-canvas"></canvas>
  <script>
    // Initialize Hydra properly
    const canvas = document.getElementById('hydra-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const hydra = new Hydra({
      canvas: canvas,
      makeGlobal: true,
      detectAudio: false
    }).synth;
    
    // Make hydra functions global
    window.hydra = hydra;
    window.src = hydra.src;
    window.osc = hydra.osc;
    window.shape = hydra.shape;
    window.gradient = hydra.gradient;
    window.noise = hydra.noise;
    window.voronoi = hydra.voronoi;
    window.kaleid = hydra.kaleid;
    window.pixelate = hydra.pixelate;
    window.repeat = hydra.repeat;
    window.modulate = hydra.modulate;
    window.modulateScale = hydra.modulateScale;
    window.modulateRotate = hydra.modulateRotate;
    window.color = hydra.color;
    window.saturate = hydra.saturate;
    window.brightness = hydra.brightness;
    window.contrast = hydra.contrast;
    window.hue = hydra.hue;
    window.luma = hydra.luma;
    window.thresh = hydra.thresh;
    window.out = hydra.out;
    window.render = hydra.render;
    window.blend = hydra.blend;
    window.mult = hydra.mult;
    window.add = hydra.add;
    window.diff = hydra.diff;
    window.layer = hydra.layer;
    window.mask = hydra.mask;
    
    try {
      ${code}
      // Auto-render if not explicitly called
      if (!hydra.rendered) {
        hydra.render();
      }
    } catch(e) {
      console.error('Hydra error:', e);
      document.body.innerHTML += '<div style="color:red;position:absolute;top:10px;left:10px;">Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
}

// FIXED Strudel wrapper - use web REPL instead of module
function createStrudelWrapper(code: string): string {
  // Extract pattern from code
  const patternMatch = code.match(/stack\([^)]+\)|s\([^)]+\)|note\([^)]+\)/s);
  const pattern = patternMatch ? patternMatch[0].replace(/\n/g, ' ') : code.replace(/\n/g, ' ');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; background: #1a1a2e; color: #fff; font-family: monospace; padding: 20px; }
    .code { background: #0a0a0f; padding: 15px; border-radius: 8px; margin: 10px 0; font-size: 12px; overflow: auto; white-space: pre; }
    .controls { margin: 15px 0; }
    button { background: #8b5cf6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; }
    button:hover { background: #7c3aed; }
    .info { color: #888; font-size: 12px; margin-top: 10px; }
  </style>
</head>
<body>
  <h3>🔊 Strudel Pattern</h3>
  <div class="code">${pattern}</div>
  <div class="controls">
    <button onclick="openStrudel()">▶ Open in Strudel REPL</button>
  </div>
  <div class="info">Click to open pattern in official Strudel editor with audio</div>
  
  <script>
    function openStrudel() {
      const code = encodeURIComponent(\`${pattern}\`);
      window.open('https://strudel.cc/?c=' + code, '_blank');
    }
  </script>
</body>
</html>`;
}

// GLSL wrapper - improved error handling
function createGLSLWrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>body { margin: 0; overflow: hidden; background: #000; }
  canvas { display: block; width: 100vw; height: 100vh; }</style>
</head>
<body>
  <canvas id="glcanvas"></canvas>
  <script>
    const canvas = document.getElementById('glcanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      document.body.innerHTML = '<div style="color:red;padding:20px;">WebGL not supported</div>';
    } else {
      const vsSource = \`attribute vec4 position;
void main() {
  gl_Position = position;
}\`;
      
      const fsSource = \`${code.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`;
      
      function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('Shader compile error:', gl.getShaderInfoLog(shader));
          return null;
        }
        return shader;
      }
      
      const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      
      if (vs && fs) {
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.useProgram(program);
          
          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
          
          const position = gl.getAttribLocation(program, 'position');
          gl.enableVertexAttribArray(position);
          gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
          
          const uTime = gl.getUniformLocation(program, 'u_time');
          const uRes = gl.getUniformLocation(program, 'u_resolution');
          
          function render(time) {
            gl.uniform1f(uTime, time * 0.001);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
          }
          requestAnimationFrame(render);
        } else {
          console.error('Program link error:', gl.getProgramInfoLog(program));
        }
      }
    }
  </script>
</body>
</html>`;
}

// p5 wrapper - unchanged, works fine
function createP5Wrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
</head>
<body>
  <script>${code}</script>
</body>
</html>`;
}

// HTML wrapper
function createHTMLWrapper(code: string): string {
  if (code.trim().startsWith('<')) return code;
  return `<!DOCTYPE html><html><body>${code}</body></html>`;
}

// ASCII wrapper
function createASCIWrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #000; color: #0f0; font-family: monospace; 
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    pre { font-size: 8px; line-height: 1; white-space: pre; }
  </style>
</head>
<body><pre>${code.replace(/</g, '&lt;')}</pre></body>
</html>`;
}

// Remotion wrapper - shows code since it needs build step
function createRemotionWrapper(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #1a1a2e; color: #fff; font-family: monospace; padding: 20px; }
    pre { background: #0a0a0f; padding: 15px; border-radius: 8px; overflow: auto; font-size: 11px; line-height: 1.4; }
    .badge { background: #f97316; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="badge">REMOTION</div>
  <h3>Video Component Code</h3>
  <pre>${code.replace(/</g, '&lt;')}</pre>
</body>
</html>`;
}

// Build all wrappers
console.log('=== FIXING WRAPPER INFRASTRUCTURE ===\n');

for (const model of MODELS) {
  for (const domain of ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii']) {
    const code = getCode(model.key, domain);
    let wrapper: string;
    
    switch (domain) {
      case 'p5': wrapper = createP5Wrapper(code); break;
      case 'three': wrapper = createThreeWrapper(code); break;
      case 'glsl': wrapper = createGLSLWrapper(code); break;
      case 'strudel': wrapper = createStrudelWrapper(code); break;
      case 'hydra': wrapper = createHydraWrapper(code); break;
      case 'html': wrapper = createHTMLWrapper(code); break;
      case 'ascii': wrapper = createASCIWrapper(code); break;
      case 'remotion': wrapper = createRemotionWrapper(code); break;
      default: wrapper = `<pre>${code}</pre>`;
    }
    
    writeFileSync(`landing-live/${domain}-${model.short}.html`, wrapper);
    console.log(`✅ Fixed: ${domain}-${model.short}.html`);
  }
}

console.log('\n=== DONE ===');
console.log('Fixed:');
console.log('- Three.js: Global THREE object instead of modules');
console.log('- Hydra: Proper synth initialization with all functions');
console.log('- Strudel: REPL link with audio (instead of broken module)');
console.log('- GLSL: Better error handling');
