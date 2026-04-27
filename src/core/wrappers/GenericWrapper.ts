/**
 * Generic HTML wrapper for non-P5/Three domains
 * Handles: Strudel, Hydra, Tone.js, Shader, Remotion, ASCII
 */

import { SECURITY_HEADERS } from './SecurityHeaders.js';

const STRUDEL_CDN = 'https://unpkg.com/@strudel/repl@latest';
const HYDRA_CDN = 'https://unpkg.com/hydra-synth';
const TONE_CDN = 'https://unpkg.com/tone@14.8.49/build/Tone.js';

export type GenericDomain = 'strudel' | 'hydra' | 'tone' | 'shader' | 'revideo' | 'remotion' | 'ascii';

export interface GenericWrapOptions {
  domain: GenericDomain;
  title?: string;
  autoPlay?: boolean;
  showPreview?: boolean;
  asciiWidth?: number;
  hydraResolution?: { width: number; height: number };
}

export class GenericWrapper {
  /**
   * Detect domain from code content for generic wrappers
   */
  static detectDomain(code: string): GenericDomain | null {
    if (this.isStrudelCode(code)) return 'strudel';
    if (this.isHydraCode(code)) return 'hydra';
    if (this.isToneJSCode(code)) return 'tone';
    if (this.isShaderCode(code)) return 'shader';
    if (this.isRemotionCode(code)) return 'remotion';
    if (this.isASCIICode(code)) return 'ascii';
    return null;
  }

  private static isStrudelCode(code: string): boolean {
    const strudelPatterns = [
      /\bstack\s*\(/,
      /\bs\s*\(\s*["']/,  // s("bd")
      /\bnote\s*\(/,
      /\bsound\s*\(/,      // Strudel v2
      /\|>/,               // Strudel v2 pipe operator
      /\bstruct\s*\(/,     // Strudel v2
      /\.cpm\s*\(/,
      /\.fast\s*\(/,
      /\.slow\s*\(/,
    ];
    return strudelPatterns.some(p => p.test(code)) && 
           !code.includes('function setup()') &&
           !code.includes('void main()');
  }

  private static isHydraCode(code: string): boolean {
    const hydraPatterns = [
      /\bosc\s*\(/,
      /\bshape\s*\(/,
      /\bnoise\s*\(/,
      /\bvoronoi\s*\(/,
      /\.kaleid\s*\(/,
      /\.colorama\s*\(/,
      /\.modulate\s*\(/,
      /\.out\s*\(\s*o\d/,
      /\brender\s*\(/,
    ];
    return hydraPatterns.filter(p => p.test(code)).length >= 2;
  }

  private static isToneJSCode(code: string): boolean {
    const tonePatterns = [
      /\bTone\./,
      /\bSynth\b/,
      /\bPolySynth\b/,
      /\bMembraneSynth\b/,
      /\bReverb\b/,
      /\bDelay\b/,
      /\bTransport\b/,
      /\bSequence\b/,
      /\bPattern\b/,
      /\btriggerAttackRelease\b/,
    ];
    return tonePatterns.some(p => p.test(code));
  }

  private static isShaderCode(code: string): boolean {
    const hasVoidMain = /void\s+main\s*\(/.test(code);
    const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
    const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
    const hasPrecision = /precision\s+(highp|mediump|lowp)\s+float/.test(code);

    const glslIndicators = [hasVoidMain, hasFragColor, hasUniforms, hasPrecision]
      .filter(Boolean).length;

    return glslIndicators >= 2 && !code.includes('function setup()') && !code.includes('function draw()');
  }

  private static isRemotionCode(code: string): boolean {
    return /useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(code);
  }

  private static isASCIICode(code: string): boolean {
    const lines = code.split('\n');
    const hasMultipleLines = lines.length > 5;
    const hasSpecialChars = /[█▓▒░@#%*+=\-~^]/.test(code);
    const noJSFunctions = !code.includes('function ') && !code.includes('const ') && !code.includes('let ');
    const noHTMLTags = !/<[a-z][\s\S]*>/i.test(code);
    
    return hasMultipleLines && hasSpecialChars && noJSFunctions && noHTMLTags;
  }

  /**
   * Wrap code based on the specified domain
   */
  static wrap(code: string, options: GenericWrapOptions): string {
    const { domain } = options;
    
    switch (domain) {
      case 'strudel':
        return this.wrapStrudel(code, options.autoPlay ?? false);
      case 'hydra':
        return this.wrapHydra(code, options.hydraResolution ?? { width: 1280, height: 720 });
      case 'tone':
        return this.wrapToneJS(code);
      case 'shader':
        return this.wrapShader(code);
      case 'remotion':
        return this.wrapRemotion(code, options.showPreview ?? false);
      case 'revideo':
        return this.wrapRevideo(code, options.showPreview ?? false);
      case 'ascii':
        return this.wrapASCII(code, options.asciiWidth ?? 60);
      default:
        throw new Error(`Unknown domain: ${domain}`);
    }
  }

  private static wrapStrudel(code: string, autoPlay = false): string {
    const safeCode = code.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const playButton = autoPlay 
      ? '<button id="playBtn" style="display:none">Play</button>'
      : '<button id="playBtn" style="padding: 12px 24px; font-size: 16px; background: #ec4899; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">▶ Play Pattern</button>';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Strudel Pattern</title>
    <script src="${STRUDEL_CDN}"></script>
    <style>
        body { 
            margin: 0; 
            background: #1a1a2e; 
            color: #fff; 
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; 
            padding: 20px;
            min-height: 100vh;
        }
        #code-display {
            background: #0a0a0f;
            padding: 16px;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.5;
            overflow-x: auto;
            white-space: pre;
            color: #a5b4fc;
            border: 1px solid #312e81;
        }
        .keyword { color: #c084fc; }
        .string { color: #86efac; }
        .function { color: #60a5fa; }
        .number { color: #fbbf24; }
        #status {
            margin-top: 12px;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            display: inline-block;
        }
        #status.ready { background: #1e3a5f; color: #60a5fa; }
        #status.playing { background: #064e3b; color: #34d399; }
        #status.error { background: #450a0a; color: #f87171; }
        .controls { margin-top: 16px; }
    </style>
</head>
<body>
    <div style="max-width: 800px; margin: 0 auto;">
        <h3 style="color: #ec4899; margin-bottom: 16px;">🎵 Strudel Live Coding Pattern</h3>
        <div id="code-display"></div>
        <div id="status" class="ready">Ready to play</div>
        <div class="controls">
            ${playButton}
        </div>
    </div>
    <script type="module">
        import { repl, controls } from '${STRUDEL_CDN}';
        
        const code = \`${safeCode}\`;
        
        const highlighted = code
            .replace(/\b(stack|s|note|sound|cpm|fast|slow|gain|pan|room|delay|cutoff|resonance)\b/g, '<span class="keyword">$1</span>')
            .replace(/("[^"]*"|'[^']*')/g, '<span class="string">$1</span>')
            .replace(new RegExp('\\b(\\d+\\.?\\d*)\\b', 'g'), '<span class="number">$1</span>')
            .replace(new RegExp('(\\w+)\\s*\\(', 'g'), '<span class="function">$1</span>(');
        
        document.getElementById('code-display').innerHTML = highlighted;
        
        const statusEl = document.getElementById('status');
        const playBtn = document.getElementById('playBtn');
        let isPlaying = false;
        
        async function initStrudel() {
            try {
                const app = await repl({
                    code: code,
                    onError: (err) => {
                        Logger.error('GenericWrapper', 'Strudel error:', err);
                        statusEl.className = 'error';
                        statusEl.textContent = 'Error: ' + err.message;
                    }
                });
                return app;
            } catch (err) {
                Logger.error('GenericWrapper', 'Failed to init Strudel:', err);
                statusEl.className = 'error';
                statusEl.textContent = 'Failed to initialize';
                return null;
            }
        }
        
        let strudelApp = null;
        
        async function startPlayback() {
            if (!strudelApp) {
                strudelApp = await initStrudel();
            }
            if (strudelApp) {
                await controls.start();
                isPlaying = true;
                statusEl.className = 'playing';
                statusEl.textContent = '🔊 Playing (click to stop)';
                playBtn.textContent = '⏹ Stop';
            }
        }
        
        async function stopPlayback() {
            await controls.stop();
            isPlaying = false;
            statusEl.className = 'ready';
            statusEl.textContent = 'Ready to play';
            playBtn.textContent = '▶ Play Pattern';
        }
        
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                if (isPlaying) {
                    stopPlayback();
                } else {
                    startPlayback();
                }
            });
        }
        
        ${autoPlay ? 'setTimeout(startPlayback, 500);' : ''}
        
        statusEl.style.cursor = 'pointer';
        statusEl.addEventListener('click', () => {
            if (isPlaying) {
                stopPlayback();
            } else {
                startPlayback();
            }
        });
    </script>
</body>
</html>`;
  }

  private static wrapHydra(code: string, resolution: { width: number; height: number }): string {
    const safeCode = code.replace(/`/g, '\\`');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Hydra Visual Synthesizer</title>
    <script src="${HYDRA_CDN}"></script>
    <style>
        body { 
            margin: 0; 
            background: #000; 
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        canvas {
            max-width: 100vw;
            max-height: 100vh;
        }
        #error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff4444;
            font-family: monospace;
            background: rgba(0,0,0,0.9);
            padding: 20px;
            border-radius: 8px;
            display: none;
            max-width: 80%;
        }
    </style>
</head>
<body>
    <canvas id="hydra-canvas"></canvas>
    <div id="error"></div>
    <script>
        const canvas = document.getElementById('hydra-canvas');
        const errorDiv = document.getElementById('error');
        
        try {
            canvas.width = ${resolution.width};
            canvas.height = ${resolution.height};
            
            const hydra = new Hydra({ 
                canvas: canvas,
                detectAudio: false,
                enableStreamCapture: false
            });
            
            ${safeCode}
            
        } catch (err) {
            Logger.error('GenericWrapper', 'Hydra error:', err);
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = '<strong>Hydra Error:</strong><br>' + err.message;
        }
    </script>
</body>
</html>`;
  }

  private static wrapShader(code: string): string {
    const normalizedCode = this.normalizeShaderForWebGL1(code);
    const safeCode = normalizedCode.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>GLSL Shader</title>
    <style>
        body { margin: 0; overflow: hidden; background: #000; }
        canvas { display: block; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="glCanvas"></canvas>
    <script>
        const canvas = document.getElementById('glCanvas');
        const gl = canvas.getContext('webgl');

        if (!gl) {
            alert('WebGL not supported');
            throw new Error('WebGL not supported');
        }

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
        }
        window.addEventListener('resize', resize);
        resize();

        const vsSource = \`attribute vec4 aVertexPosition; void main() { gl_Position = aVertexPosition; }\`;
        const fsSource = \`${safeCode}\`;

        function loadShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                Logger.error('GenericWrapper', 'Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        if (!vertexShader || !fragmentShader) {
            Logger.error('GenericWrapper', 'Shader compilation failed');
            document.body.innerHTML = '<div style="color:#f66;padding:2rem;font-family:monospace;">Shader compile error — see console</div>';
        } else {
            const shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                Logger.error('GenericWrapper', 'Program link error:', gl.getProgramInfoLog(shaderProgram));
            } else {
                const positions = new Float32Array([-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0]);
                const positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

                const vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
                gl.enableVertexAttribArray(vertexPosition);
                gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);

                const uResolution = gl.getUniformLocation(shaderProgram, 'u_resolution');
                const uTime = gl.getUniformLocation(shaderProgram, 'u_time');
                const uMouse = gl.getUniformLocation(shaderProgram, 'u_mouse');

                let mouseX = 0, mouseY = 0;
                canvas.addEventListener('mousemove', (e) => {
                    mouseX = e.clientX;
                    mouseY = canvas.height - e.clientY;
                });

                let startTime = Date.now();
                function render() {
                    const time = (Date.now() - startTime) / 1000;
                    gl.useProgram(shaderProgram);
                    gl.uniform2f(uResolution, canvas.width, canvas.height);
                    gl.uniform1f(uTime, time);
                    gl.uniform2f(uMouse, mouseX, mouseY);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    requestAnimationFrame(render);
                }
                render();
            }
        }
    </script>
</body>
</html>`;
  }

  private static normalizeShaderForWebGL1(code: string): string {
    let normalized = code
      .replace(/\biTime\b/g, 'u_time')
      .replace(/\biResolution\b/g, 'u_resolution');

    if (/^\s*#version\s+300\s+es\b/m.test(normalized)) {
      const outVar = normalized.match(/\bout\s+vec4\s+([A-Za-z_$][\w$]*)\s*;/)?.[1];
      normalized = normalized
        .replace(/^\s*#version\s+300\s+es\s*/m, '')
        .replace(/\bout\s+vec4\s+[A-Za-z_$][\w$]*\s*;\s*/g, '');
      if (outVar) {
        normalized = normalized.replace(new RegExp(`\\b${outVar}\\b`, 'g'), 'gl_FragColor');
      }
    }

    return normalized;
  }

  private static wrapRemotion(code: string, _showPreview = false): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const durationMatch = code.match(/durationInFrames[=:]\s*(\d+)/);
    const fpsMatch = code.match(/fps[=:]\s*(\d+)/);
    const widthMatch = code.match(/width[=:]\s*(\d+)/);
    const heightMatch = code.match(/height[=:]\s*(\d+)/);
    
    const duration = durationMatch ? parseInt(durationMatch[1]) : 150;
    const fps = fpsMatch ? parseInt(fpsMatch[1]) : 30;
    const width = widthMatch ? parseInt(widthMatch[1]) : 1920;
    const height = heightMatch ? parseInt(heightMatch[1]) : 1080;
    const durationSec = (duration / fps).toFixed(1);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Remotion Composition</title>
    <style>
        body { 
            margin: 0; 
            padding: 2rem; 
            background: #0a0a0f; 
            color: #e0e0e0; 
            font-family: 'Monaco', 'Menlo', monospace; 
            font-size: 0.85rem; 
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2));
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            border: 1px solid rgba(139, 92, 246, 0.3);
        }
        .badge { 
            display: inline-block; 
            padding: 0.25rem 0.75rem; 
            border-radius: 6px; 
            background: rgba(139, 92, 246, 0.3); 
            color: #a78bfa; 
            font-size: 0.8rem; 
            margin-right: 0.5rem;
        }
        .meta {
            display: flex;
            gap: 1.5rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        .meta-item {
            color: #94a3b8;
        }
        .meta-value {
            color: #e2e8f0;
            font-weight: 600;
        }
        pre { 
            white-space: pre-wrap; 
            word-wrap: break-word;
            background: #0f0f1a;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #1e293b;
            overflow-x: auto;
        }
        .note { 
            color: #94a3b8; 
            font-size: 0.8rem; 
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="badge">Remotion</span>
        <span class="badge">React</span>
        <div class="meta">
            <div class="meta-item">Duration: <span class="meta-value">${durationSec}s</span> (${duration} frames @ ${fps}fps)</div>
            <div class="meta-item">Resolution: <span class="meta-value">${width}×${height}</span></div>
        </div>
    </div>
    <pre><code>${escaped}</code></pre>
    <p class="note">
        💡 <strong>Note:</strong> Remotion compositions require the Remotion CLI or bundler to render. 
        Use <code>npx remotion render</code> to generate the video from this code.
    </p>
</body>
</html>`;
  }

  private static wrapRevideo(code: string, _showPreview = false): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const durationMatch = code.match(/durationInFrames[=:]\s*(\d+)/);
    const fpsMatch = code.match(/fps[=:]\s*(\d+)/);
    const widthMatch = code.match(/width[=:]\s*(\d+)/);
    const heightMatch = code.match(/height[=:]\s*(\d+)/);

    const duration = durationMatch ? parseInt(durationMatch[1]) : 150;
    const fps = fpsMatch ? parseInt(fpsMatch[1]) : 30;
    const width = widthMatch ? parseInt(widthMatch[1]) : 1920;
    const height = heightMatch ? parseInt(heightMatch[1]) : 1080;
    const durationSec = (duration / fps).toFixed(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Revideo Composition</title>
    <style>
        body {
            margin: 0;
            padding: 2rem;
            background: #0a0a0f;
            color: #e0e0e0;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.85rem;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(236, 72, 153, 0.2));
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            background: rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            font-size: 0.8rem;
            margin-right: 0.5rem;
        }
        .meta {
            display: flex;
            gap: 1.5rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        .meta-item {
            color: #94a3b8;
        }
        .meta-value {
            color: #e2e8f0;
            font-weight: 600;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background: #0f0f1a;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #1e293b;
            overflow-x: auto;
        }
        .note {
            color: #94a3b8;
            font-size: 0.8rem;
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
        }
    </style>
</head>
<body>
    <div class="header">
        <span class="badge">Revideo</span>
        <span class="badge">TypeScript</span>
        <div class="meta">
            <div class="meta-item">Duration: <span class="meta-value">${durationSec}s</span> (${duration} frames @ ${fps}fps)</div>
            <div class="meta-item">Resolution: <span class="meta-value">${width}×${height}</span></div>
        </div>
    </div>
    <pre><code>${escaped}</code></pre>
    <p class="note">
        💡 <strong>Note:</strong> Revideo compositions require the Revideo CLI to render.
        Use <code>npx revideo render</code> to generate the video from this code.
    </p>
</body>
</html>`;
  }

  private static wrapASCII(code: string, _width: number): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>ASCII Art</title>
    <style>
        body { 
            margin: 0; 
            background: #0a0a0f; 
            color: #00ff00;
            font-family: 'Courier New', 'Courier', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            text-align: center;
        }
        pre { 
            font-size: 10px;
            line-height: 1.2;
            background: #000;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #1a1a2e;
            display: inline-block;
            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
        }
        .label {
            color: #6b7280;
            font-size: 12px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="label">ASCII Art</div>
        <pre>${escaped}</pre>
    </div>
</body>
</html>`;
  }

  private static wrapToneJS(code: string): string {
    const safeCode = code.replace(/`/g, '\\`');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Tone.js Audio Synthesizer</title>
    <script src="${TONE_CDN}"></script>
    <style>
        body { 
            margin: 0; 
            background: #0a0a0f; 
            color: #e2e8f0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        h3 {
            color: #f59e0b;
            margin-bottom: 20px;
        }
        #controls {
            display: flex;
            gap: 16px;
            margin-bottom: 20px;
        }
        button {
            padding: 12px 24px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: inherit;
        }
        #playBtn {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
            color: white;
        }
        #playBtn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
        }
        #stopBtn {
            background: #334155;
            color: #e2e8f0;
        }
        #stopBtn:hover {
            background: #475569;
        }
        #status {
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
        }
        #status.ready { color: #94a3b8; }
        #status.playing { color: #f59e0b; }
        #visualizer {
            width: 300px;
            height: 100px;
            background: #1e293b;
            border-radius: 8px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h3>🎹 Tone.js Audio Synthesizer</h3>
    <div id="controls">
        <button id="playBtn">▶ Play</button>
        <button id="stopBtn">⏹ Stop</button>
    </div>
    <div id="status" class="ready">Ready to play (click Start Audio)</div>
    <canvas id="visualizer"></canvas>
    <script>
        let isPlaying = false;
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const statusEl = document.getElementById('status');
        
        ${safeCode}
        
        playBtn.addEventListener('click', async () => {
            await Tone.start();
            isPlaying = true;
            statusEl.className = 'playing';
            statusEl.textContent = '🔊 Playing';
            if (typeof play === 'function') play();
        });
        
        stopBtn.addEventListener('click', () => {
            isPlaying = false;
            statusEl.className = 'ready';
            statusEl.textContent = 'Stopped';
            if (typeof stop === 'function') stop();
        });
    </script>
</body>
</html>`;
  }
}

export default GenericWrapper;
