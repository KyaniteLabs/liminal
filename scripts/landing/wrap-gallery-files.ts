#!/usr/bin/env tsx
/**
 * Wrap raw gallery HTML files with proper rendering harnesses.
 * Reads from examples/generated/ and writes wrapped HTML to landing-live/.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LANDING_DIR = path.join(PROJECT_ROOT, 'landing-live');
const SRC_DIR = path.join(PROJECT_ROOT, 'examples/generated');

// ─── Model key → directory mapping ───────────────────────────────────────────
const MODEL_MAP: Record<string, { provider: string; dir: string; domains: string[] }> = {
  // minimax
  'cloud/m25':         { provider: 'minimax', dir: 'MiniMax-M2.5',  domains: ['glsl','html','hydra','p5','strudel','tone'] },
  'cloud/m27':         { provider: 'minimax', dir: 'MiniMax-M2.7',  domains: ['glsl','html','hydra','p5','strudel','tone'] },
  'minimax/m25':       { provider: 'minimax', dir: 'MiniMax-M2.5',  domains: ['glsl','html','hydra','p5','strudel','tone'] },
  'minimax/m27':       { provider: 'minimax', dir: 'MiniMax-M2.7',  domains: ['glsl','html','hydra','p5','strudel','tone'] },
  // glm
  'glm/5.1':           { provider: 'glm',     dir: 'GLM-5.1',      domains: ['glsl','html','hydra','p5','strudel'] },
  // lmstudio
  'lmstudio/a4b':       { provider: 'lmstudio', dir: 'Qwen3-Coder-40B', domains: ['glsl','html','hydra','p5','strudel','remotion','three','tone','ascii'] },
  'lmstudio/2b':        { provider: 'lmstudio', dir: 'Qwen3.5-9B',   domains: ['glsl','html','hydra','p5','strudel','remotion','three','tone','ascii'] },
  // ollama
  'ollama/gemma3:4b':   { provider: 'ollama', dir: 'Gemma3-4B',      domains: ['glsl','p5','three'] },
  'ollama/gemma4':      { provider: 'ollama', dir: 'Gemma3-4B-Ollama', domains: ['glsl','p5','three'] },
  'ollama/granite4:1b': { provider: 'ollama', dir: 'Granite4-1b',   domains: ['glsl','p5','three'] },
  'ollama/granite4:350m': { provider: 'ollama', dir: 'Granite4-350m', domains: ['p5','three'] },
  'ollama/kimi-k2.5':  { provider: 'ollama', dir: 'Kimi-K2.5',     domains: ['p5','three'] },
  'ollama/lfm2.5':     { provider: 'ollama', dir: 'LFM2.5-Thinking', domains: ['glsl','p5'] },
  'ollama/phi4-mini':  { provider: 'ollama', dir: 'Phi4-Mini',     domains: ['glsl','p5','three'] },
  'ollama/qwen3.5:2b': { provider: 'ollama', dir: 'Qwen3.5-2b',    domains: ['glsl','p5','three'] },
  'ollama/qwen3.5:0.8b': { provider: 'ollama', dir: 'Qwen3.5-0.8b', domains: ['p5','three'] },
  'ollama/0.8b':       { provider: 'ollama', dir: 'Qwen3.5-0.8b',  domains: ['p5','three'] },
  'ollama/2b':         { provider: 'ollama', dir: 'Qwen3.5-2b',    domains: ['p5','three'] },
  'ollama/latest':     { provider: 'ollama', dir: 'Gemma3-4B-Ollama', domains: ['p5'] },
  'ollama/cloud':      { provider: 'ollama', dir: 'Kimi-K2.5',     domains: ['p5'] },
  'ollama/1.2b':       { provider: 'ollama', dir: 'LFM2.5-Thinking', domains: ['p5'] },
  'ollama/1b':          { provider: 'ollama', dir: 'Granite4-1b',   domains: ['p5'] },
  'ollama/4b':          { provider: 'ollama', dir: 'Gemma3-4B',    domains: ['p5'] },
  // lmstudio nested
  'lmstudio/lmstudio-google-gemma-4-26b-a4b': { provider: 'lmstudio', dir: 'Qwen3-Coder-40B', domains: ['p5'] },
  'lmstudio/lmstudio-qwen3.5-2b':             { provider: 'lmstudio', dir: 'Qwen3.5-9B',      domains: ['p5'] },
  'ollama/ollama-gemma4-latest': { provider: 'ollama', dir: 'Gemma3-4B-Ollama', domains: ['p5'] },
  'ollama/ollama-granite4-1b':    { provider: 'ollama', dir: 'Granite4-1b',      domains: ['p5'] },
  'ollama/ollama-granite4-350m':  { provider: 'ollama', dir: 'Granite4-350m',   domains: ['p5'] },
  'ollama/ollama-kimi-k2.5-cloud':{ provider: 'ollama', dir: 'Kimi-K2.5',        domains: ['p5'] },
  'ollama/ollama-phi4-mini-latest':{ provider: 'ollama', dir: 'Phi4-Mini',       domains: ['p5'] },
  'ollama/ollama-qwen3.5-0.8b':   { provider: 'ollama', dir: 'Qwen3.5-0.8b',    domains: ['p5'] },
  'ollama/ollama-qwen3.5-2b':     { provider: 'ollama', dir: 'Qwen3.5-2b',      domains: ['p5'] },
};

// ─── Source file lookup ───────────────────────────────────────────────────────
function getSourcePath(provider: string, modelDir: string, domain: string): string | null {
  const srcPath = path.join(SRC_DIR, provider, modelDir, domain, '2026-03-31--default', 'v1.js');
  return existsSync(srcPath) ? srcPath : null;
}

// ─── Wrappers ─────────────────────────────────────────────────────────────────
function wrapGLSL(code: string): string {
  const escaped = code.replace(/`/g, '\\`').replace(/\\/g, '\\\\');
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
      const fsSource = \`${escaped}\`;

      // Minimal passthrough vertex shader
      const vsSource = \`attribute vec4 position; void main() { gl_Position = position; }\`;

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

          const posLoc = gl.getAttribLocation(program, 'position');
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

          const uTime = gl.getUniformLocation(program, 'u_time');
          const uTimeAlt = gl.getUniformLocation(program, 'iTime');
          const uRes = gl.getUniformLocation(program, 'u_resolution');
          const uResAlt = gl.getUniformLocation(program, 'iResolution');

          function render(time) {
            const t = time * 0.001;
            if (uTime !== null) gl.uniform1f(uTime, t);
            if (uTimeAlt !== null) gl.uniform1f(uTimeAlt, t);
            if (uRes !== null) gl.uniform2f(uRes, canvas.width, canvas.height);
            if (uResAlt !== null) gl.uniform2f(uResAlt, canvas.width, canvas.height);
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

function wrapP5(code: string): string {
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

function wrapTHREE(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>body { margin: 0; overflow: hidden; background: #000; }</style>
</head>
<body>
  <script>
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

function wrapHYDRA(code: string): string {
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
    const canvas = document.getElementById('hydra-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const hydra = new Hydra({
      canvas: canvas,
      makeGlobal: true,
      detectAudio: false
    }).synth;

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
      if (!hydra.rendered) hydra.render();
    } catch(e) {
      console.error('Hydra error:', e);
      document.body.innerHTML += '<div style="color:red;position:absolute;top:10px;left:10px;">Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
}

function wrapSTRUDEL(code: string): string {
  const patternMatch = code.match(/stack\([^)]+\)|s\([^)]+\)|note\([^)]+\)/s);
  const pattern = patternMatch ? patternMatch[0].replace(/\n/g, ' ') : code.replace(/\n/g, ' ').slice(0, 200);
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
  <h3>Strudel Pattern</h3>
  <div class="code">${pattern}</div>
  <div class="controls">
    <button onclick="openStrudel()">Open in Strudel REPL</button>
  </div>
  <div class="info">Click to open pattern in official Strudel editor with audio</div>
  <script>
    function openStrudel() {
      const encoded = encodeURIComponent(\`${pattern}\`);
      window.open('https://strudel.cc/?c=' + encoded, '_blank');
    }
  </script>
</body>
</html>`;
}

function wrapTONE(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
  <style>
    body { margin: 0; background: #0a0a0f; color: #e0e0e0; font-family: monospace; padding: 20px; }
    pre { background: #131318; padding: 15px; border-radius: 8px; overflow: auto; font-size: 12px; }
    .info { color: #888; font-size: 12px; margin-top: 10px; }
  </style>
</head>
<body>
  <h3>Tone.js Pattern</h3>
  <pre>${code.replace(/</g, '&lt;')}</pre>
  <div class="info">Audio reactive — click page to enable audio</div>
  <script>
    document.body.addEventListener('click', function enableAudio() {
      Tone.start();
      document.body.removeEventListener('click', enableAudio);
    }, { once: true });
  </script>
</body>
</html>`;
}

function wrapHTML(code: string): string {
  if (code.trim().startsWith('<')) return code;
  return `<!DOCTYPE html><html><head><style>body { margin: 0; font-family: system-ui; }</style></head><body>${code}</body></html>`;
}

function wrapASCII(code: string): string {
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

function wrapREMOTION(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #1a1a2e; color: #fff; font-family: monospace; padding: 20px; }
    pre { background: #0a0a0f; padding: 15px; border-radius: 8px; overflow: auto; font-size: 11px; line-height: 1.4; }
    .badge { background: #f97316; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="badge">REMOTION</div>
  <h3>Video Component Code</h3>
  <pre>${code.replace(/</g, '&lt;')}</pre>
  <p style="color:#888;">Remotion requires build step to preview</p>
</body>
</html>`;
}

function wrapCode(code: string, domain: string): string {
  switch (domain) {
    case 'glsl': return wrapGLSL(code);
    case 'p5':   return wrapP5(code);
    case 'three': return wrapTHREE(code);
    case 'hydra': return wrapHYDRA(code);
    case 'strudel': return wrapSTRUDEL(code);
    case 'tone': return wrapTONE(code);
    case 'html': return wrapHTML(code);
    case 'ascii': return wrapASCII(code);
    case 'remotion': return wrapREMOTION(code);
    default: return `<!DOCTYPE html><html><body><pre>${code.replace(/</g, '&lt;')}</pre></body></html>`;
  }
}

// ─── Gallery filename → (model, domain) mapping ────────────────────────────────
// This maps iframeSrc values from gallery-data.js → source lookup
interface GalleryEntry {
  iframeSrc: string;
  model: string;
  domain: string;
}

const GALLERY_ENTRIES: GalleryEntry[] = [
  // cloud minimax glsl
  { iframeSrc: 'cloud-glsl-minimax-m25.html',  model: 'cloud/m25',   domain: 'glsl' },
  { iframeSrc: 'cloud-glsl-minimax-m27.html',  model: 'cloud/m27',   domain: 'glsl' },
  // cloud minimax html
  { iframeSrc: 'cloud-html-minimax-m25.html',  model: 'cloud/m25',   domain: 'html' },
  { iframeSrc: 'cloud-html-minimax-m27.html',  model: 'cloud/m27',   domain: 'html' },
  // cloud minimax hydra
  { iframeSrc: 'cloud-hydra-minimax-m25.html', model: 'cloud/m25',   domain: 'hydra' },
  { iframeSrc: 'cloud-hydra-minimax-m27.html', model: 'cloud/m27',   domain: 'hydra' },
  // cloud minimax p5
  { iframeSrc: 'cloud-p5-minimax-m25.html',   model: 'cloud/m25',   domain: 'p5' },
  { iframeSrc: 'cloud-p5-minimax-m27.html',   model: 'cloud/m27',   domain: 'p5' },
  // cloud minimax strudel
  { iframeSrc: 'cloud-strudel-minimax-m25.html', model: 'cloud/m25', domain: 'strudel' },
  { iframeSrc: 'cloud-strudel-minimax-m27.html', model: 'cloud/m27', domain: 'strudel' },
  // cloud minimax tone
  { iframeSrc: 'cloud-tone-minimax-m27.html',   model: 'cloud/m27',   domain: 'tone' },
  // cloud-minimax glsl
  { iframeSrc: 'cloud-minimax-glsl-minimax-m25.html', model: 'minimax/m25', domain: 'glsl' },
  { iframeSrc: 'cloud-minimax-glsl-minimax-m27.html', model: 'minimax/m27', domain: 'glsl' },
  // cloud-minimax p5
  { iframeSrc: 'cloud-minimax-p5-minimax-m25.html', model: 'minimax/m25', domain: 'p5' },
  { iframeSrc: 'cloud-minimax-p5-minimax-m27.html', model: 'minimax/m27', domain: 'p5' },
  // minimax-prefixed
  { iframeSrc: 'minimax-glsl-minimax-m25.html', model: 'minimax/m25', domain: 'glsl' },
  { iframeSrc: 'minimax-glsl-minimax-m27.html', model: 'minimax/m27', domain: 'glsl' },
  { iframeSrc: 'minimax-html-minimax-m25.html', model: 'minimax/m25', domain: 'html' },
  { iframeSrc: 'minimax-html-minimax-m27.html', model: 'minimax/m27', domain: 'html' },
  { iframeSrc: 'minimax-hydra-minimax-m25.html', model: 'minimax/m25', domain: 'hydra' },
  { iframeSrc: 'minimax-hydra-minimax-m27.html', model: 'minimax/m27', domain: 'hydra' },
  { iframeSrc: 'minimax-p5-minimax-m25.html',   model: 'minimax/m25', domain: 'p5' },
  { iframeSrc: 'minimax-p5-minimax-m27.html',   model: 'minimax/m27', domain: 'p5' },
  { iframeSrc: 'minimax-strudel-minimax-m27.html', model: 'minimax/m27', domain: 'strudel' },
  { iframeSrc: 'minimax-three-minimax-m27.html', model: 'minimax/m27', domain: 'three' },
  { iframeSrc: 'minimax-tone-minimax-m27.html',   model: 'minimax/m27', domain: 'tone' },
  // glm
  { iframeSrc: 'glm-glsl-glm-5.1.html',   model: 'glm/5.1',    domain: 'glsl' },
  { iframeSrc: 'glm-html-glm-5.1.html',   model: 'glm/5.1',    domain: 'html' },
  { iframeSrc: 'glm-hydra-glm-5.1.html',  model: 'glm/5.1',    domain: 'hydra' },
  { iframeSrc: 'glm-p5-glm-5.1.html',     model: 'glm/5.1',    domain: 'p5' },
  { iframeSrc: 'glm-strudel-glm-5.1.html', model: 'glm/5.1',   domain: 'strudel' },
  // lmstudio glsl (compound domain)
  { iframeSrc: 'lmstudio-glsl-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'glsl' },
  { iframeSrc: 'lmstudio-glsl-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'glsl' },
  // lmstudio html
  { iframeSrc: 'lmstudio-html-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'html' },
  { iframeSrc: 'lmstudio-html-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'html' },
  // lmstudio hydra
  { iframeSrc: 'lmstudio-hydra-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'hydra' },
  { iframeSrc: 'lmstudio-hydra-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'hydra' },
  // lmstudio p5 (multiple variants)
  { iframeSrc: 'lmstudio-p5-google-gemma-4-26b-a4b.html',   model: 'lmstudio/a4b', domain: 'p5' },
  { iframeSrc: 'lmstudio-p5-lmstudio-google-gemma-4-26b-a4b.html', model: 'lmstudio/lmstudio-google-gemma-4-26b-a4b', domain: 'p5' },
  { iframeSrc: 'lmstudio-p5-lmstudio-qwen3.5-2b.html',             model: 'lmstudio/lmstudio-qwen3.5-2b',             domain: 'p5' },
  { iframeSrc: 'lmstudio-p5-qwen3.5-2b.html',                   model: 'lmstudio/2b',  domain: 'p5' },
  // lmstudio strudel
  { iframeSrc: 'lmstudio-strudel-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'strudel' },
  { iframeSrc: 'lmstudio-strudel-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'strudel' },
  // lmstudio three
  { iframeSrc: 'lmstudio-three-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'three' },
  { iframeSrc: 'lmstudio-three-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'three' },
  // lmstudio tone
  { iframeSrc: 'lmstudio-tone-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'tone' },
  { iframeSrc: 'lmstudio-tone-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'tone' },
  // lmstudio remotion
  { iframeSrc: 'lmstudio-remotion-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'remotion' },
  { iframeSrc: 'lmstudio-remotion-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'remotion' },
  // lmstudio ascii
  { iframeSrc: 'lmstudio-ascii-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'ascii' },
  { iframeSrc: 'lmstudio-ascii-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'ascii' },
  // local-lmstudio
  { iframeSrc: 'local-lmstudio-glsl-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'glsl' },
  { iframeSrc: 'local-lmstudio-glsl-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'glsl' },
  { iframeSrc: 'local-lmstudio-p5-google-gemma-4-26b-a4b.html', model: 'lmstudio/a4b', domain: 'p5' },
  { iframeSrc: 'local-lmstudio-p5-qwen3.5-2b.html',              model: 'lmstudio/2b',  domain: 'p5' },
  // ollama p5
  { iframeSrc: 'ollama-p5-gemma3-4b.html',             model: 'ollama/gemma3:4b',    domain: 'p5' },
  { iframeSrc: 'ollama-p5-gemma4-latest.html',           model: 'ollama/gemma4',       domain: 'p5' },
  { iframeSrc: 'ollama-p5-granite4-1b.html',            model: 'ollama/granite4:1b',  domain: 'p5' },
  { iframeSrc: 'ollama-p5-granite4-350m.html',          model: 'ollama/granite4:350m', domain: 'p5' },
  { iframeSrc: 'ollama-p5-kimi-k2.5-cloud.html',        model: 'ollama/kimi-k2.5',     domain: 'p5' },
  { iframeSrc: 'ollama-p5-lfm2.5-thinking-1.2b.html', model: 'ollama/lfm2.5',        domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-gemma4-latest.html',  model: 'ollama/ollama-gemma4-latest', domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-kimi-k2.5-cloud.html', model: 'ollama/ollama-kimi-k2.5-cloud', domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-qwen3.5-0.8b.html',   model: 'ollama/ollama-qwen3.5-0.8b', domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-qwen3.5-2b.html',     model: 'ollama/ollama-qwen3.5-2b',   domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-phi4-mini-latest.html', model: 'ollama/ollama-phi4-mini-latest', domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-granite4-1b.html',    model: 'ollama/ollama-granite4-1b',  domain: 'p5' },
  { iframeSrc: 'ollama-p5-ollama-granite4-350m.html',  model: 'ollama/ollama-granite4-350m', domain: 'p5' },
  { iframeSrc: 'ollama-p5-phi4-mini-latest.html',      model: 'ollama/phi4-mini',     domain: 'p5' },
  { iframeSrc: 'ollama-p5-qwen3.5-0.8b.html',         model: 'ollama/qwen3.5:0.8b',  domain: 'p5' },
  { iframeSrc: 'ollama-p5-qwen3.5-2b.html',           model: 'ollama/qwen3.5:2b',    domain: 'p5' },
  // plain ollama glsl/p5/three (no provider prefix)
  { iframeSrc: 'glsl-gemma3:4b.html',   model: 'ollama/gemma3:4b',   domain: 'glsl' },
  { iframeSrc: 'glsl-gemma4.html',      model: 'ollama/gemma4',      domain: 'glsl' },
  { iframeSrc: 'glsl-granite4:1b.html', model: 'ollama/granite4:1b', domain: 'glsl' },
  { iframeSrc: 'glsl-lfm2.5.html',     model: 'ollama/lfm2.5',      domain: 'glsl' },
  { iframeSrc: 'glsl-phi4-mini.html',  model: 'ollama/phi4-mini',   domain: 'glsl' },
  { iframeSrc: 'glsl-qwen3.5:2b.html', model: 'ollama/qwen3.5:2b', domain: 'glsl' },
  { iframeSrc: 'p5-gemma3:4b.html',    model: 'ollama/gemma3:4b',   domain: 'p5' },
  { iframeSrc: 'p5-gemma4.html',       model: 'ollama/gemma4',      domain: 'p5' },
  { iframeSrc: 'p5-granite4:1b.html',  model: 'ollama/granite4:1b', domain: 'p5' },
  { iframeSrc: 'p5-lfm2.5.html',       model: 'ollama/lfm2.5',      domain: 'p5' },
  { iframeSrc: 'p5-lmstudio-google-gemma-4-26b-a4b.html', model: 'ollama/gemma3:4b', domain: 'p5' },
  { iframeSrc: 'p5-lmstudio-qwen3.5-2b.html',             model: 'ollama/qwen3.5:2b', domain: 'p5' },
  { iframeSrc: 'p5-ollama-gemma4-latest.html',  model: 'ollama/ollama-gemma4-latest', domain: 'p5' },
  { iframeSrc: 'p5-ollama-granite4-1b.html',   model: 'ollama/ollama-granite4-1b',  domain: 'p5' },
  { iframeSrc: 'p5-ollama-granite4-350m.html', model: 'ollama/ollama-granite4-350m', domain: 'p5' },
  { iframeSrc: 'p5-ollama-kimi-k2.5-cloud.html', model: 'ollama/ollama-kimi-k2.5-cloud', domain: 'p5' },
  { iframeSrc: 'p5-ollama-phi4-mini-latest.html', model: 'ollama/ollama-phi4-mini-latest', domain: 'p5' },
  { iframeSrc: 'p5-ollama-qwen3.5-0.8b.html',   model: 'ollama/ollama-qwen3.5-0.8b', domain: 'p5' },
  { iframeSrc: 'p5-ollama-qwen3.5-2b.html',     model: 'ollama/ollama-qwen3.5-2b',   domain: 'p5' },
  { iframeSrc: 'p5-phi4-mini.html',     model: 'ollama/phi4-mini',   domain: 'p5' },
  { iframeSrc: 'p5-qwen3.5:2b.html',   model: 'ollama/qwen3.5:2b',  domain: 'p5' },
  // plain three
  { iframeSrc: 'three-gemma3:4b.html',   model: 'ollama/gemma3:4b',   domain: 'three' },
  { iframeSrc: 'three-granite4:1b.html', model: 'ollama/granite4:1b', domain: 'three' },
  { iframeSrc: 'three-phi4-mini.html',  model: 'ollama/phi4-mini',   domain: 'three' },
  { iframeSrc: 'three-qwen3.5:2b.html', model: 'ollama/qwen3.5:2b',  domain: 'three' },
  // local-ollama
  { iframeSrc: 'local-ollama-p5-gemma4-latest.html',  model: 'ollama/gemma4',    domain: 'p5' },
  { iframeSrc: 'local-ollama-p5-qwen3.5-0.8b.html',   model: 'ollama/qwen3.5:0.8b', domain: 'p5' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
mkdirSync(LANDING_DIR, { recursive: true });

console.log('=== WRAPPING GALLERY FILES ===\n');

let wrapped = 0;
let missing = 0;

for (const entry of GALLERY_ENTRIES) {
  const modelInfo = MODEL_MAP[entry.model];
  if (!modelInfo) {
    console.log(`  SKIP ${entry.iframeSrc}: unknown model "${entry.model}"`);
    continue;
  }

  const srcPath = getSourcePath(modelInfo.provider, modelInfo.dir, entry.domain);
  if (!srcPath) {
    console.log(`  MISSING ${entry.iframeSrc}: no source at ${modelInfo.provider}/${modelInfo.dir}/${entry.domain}`);
    missing++;
    continue;
  }

  const code = readFileSync(srcPath, 'utf-8');
  const wrappedHtml = wrapCode(code, entry.domain);
  const outPath = path.join(LANDING_DIR, entry.iframeSrc);
  writeFileSync(outPath, wrappedHtml);
  wrapped++;
}

console.log(`\n✅ Wrapped: ${wrapped}  Missing source: ${missing}`);
