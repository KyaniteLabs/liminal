/**
 * Generic HTML wrapper for non-P5/Three domains
 * Handles: Strudel, Hydra, Tone.js, Shader, Revideo, ASCII
 */

import { SECURITY_HEADERS } from './SecurityHeaders.js';

const STRUDEL_CDN = 'https://unpkg.com/@strudel/repl@1.0.2';
const HYDRA_CDN = 'https://unpkg.com/hydra-synth';
const TONE_CDN = 'https://unpkg.com/tone@14.8.49/build/Tone.js';
const STRUDEL_SECURITY_HEADERS = SECURITY_HEADERS
  .replace("connect-src 'none'", 'connect-src https://raw.githubusercontent.com');
const HYDRA_SECURITY_HEADERS = SECURITY_HEADERS
  .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'");
const TONE_SECURITY_HEADERS = SECURITY_HEADERS
  .replace("media-src 'self';", "media-src 'self'; worker-src blob:;");

export type GenericDomain = 'strudel' | 'hydra' | 'tone' | 'shader' | 'revideo' | 'ascii' | 'hyperframes';

export interface GenericWrapOptions {
  domain: GenericDomain;
  title?: string;
  autoPlay?: boolean;
  showPreview?: boolean;
  asciiWidth?: number;
  hydraResolution?: { width: number; height: number };
}

export class GenericWrapper {
  private static escapeHTML(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static escapeScript(value: string): string {
    return value.replace(/<\/script>/gi, '<\\/script>');
  }

  private static isHTMLDocument(code: string): boolean {
    const trimmed = code.trim();
    return /^<!doctype\s+html/i.test(trimmed) || /^<html\b/i.test(trimmed) || /<body\b/i.test(trimmed);
  }

  private static extractBodyFragment(html: string): string {
    return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  }

  private static extractInlineScripts(html: string): string[] {
    return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(script => script.trim().length > 0);
  }

  private static stripExecutableHTML(fragment: string): string {
    return fragment
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .trim();
  }

  private static stripLLMToolMarkup(code: string): string {
    return code
      .replace(/```(?:\w+)?\s*/g, '')
      .replace(/```\s*$/g, '')
      .replace(/<tool_call\b[\s\S]*?<arg_value\b[^>]*>/gi, '')
      .replace(/<\/arg_value>(?:\\n|\s)*<\/tool_call>\s*$/gi, '')
      .replace(/<\/arg_value>[\s\S]*?<\/tool_call>\s*$/gi, '')
      .trim();
  }

  private static extractRevideoLabels(code: string): string[] {
    const labels = [
      ...[...code.matchAll(/<Txt\b[^>]*\btext\s*=\s*(?:\{\s*)?["'`]([^"'`]{2,90})["'`]/g)].map(match => match[1]),
      ...[...code.matchAll(/<Txt\b[^>]*>([^<]{2,90})<\/Txt>/g)].map(match => match[1]),
      ...[...code.matchAll(/["'`]([^"'`]{4,70})["'`]/g)].map(match => match[1]),
    ];
    const blocked = /^(?:@revideo\/|react|typescript|tsx|durationInFrames|width|height|fps|fill|font|fontFamily|layout|center|middle|white|black|transparent)$/i;
    return [...new Set(labels
      .map(label => label.replace(/\s+/g, ' ').trim())
      .filter(label => label.length >= 3 && !blocked.test(label) && !label.includes('@revideo/')))]
      .slice(0, 3);
  }

  /**
   * Detect domain from code content for generic wrappers
   */
  static detectDomain(code: string): GenericDomain | null {
    if (this.isStrudelCode(code)) return 'strudel';
    if (this.isHydraCode(code)) return 'hydra';
    if (this.isToneJSCode(code)) return 'tone';
    if (this.isShaderCode(code)) return 'shader';
    if (this.isRevideoCode(code)) return 'revideo';
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

  private static isRevideoCode(code: string): boolean {
    return /@revideo\/(core|2d)|\bmakeScene\s*\(|\bcreateRef\s*(?:<|\()|from\s+['"]@revideo\//.test(code);
  }

  private static isASCIICode(code: string): boolean {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const hasMultipleLines = nonEmptyLines.length >= 3;
    const artChars = code.match(/[█▓▒░@#%*+=~^_/\\|(){}[\].,:;'"-]/g)?.length ?? 0;
    const visibleChars = code.replace(/\s/g, '').length || 1;
    const hasAsciiArtDensity = artChars >= 8 && artChars / visibleChars > 0.35;
    const noJSFunctions = !/\b(function|const|let|var|import|export)\b/.test(code);
    const noHTMLTags = !/<[a-z][\s\S]*>/i.test(code);
    
    return hasMultipleLines && hasAsciiArtDensity && noJSFunctions && noHTMLTags;
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
      case 'revideo':
        return this.wrapRevideo(code, options.showPreview ?? false);
      case 'hyperframes':
        return this.wrapHyperframes(code, options.showPreview ?? false);
      case 'ascii':
        return this.wrapASCII(code, options.asciiWidth ?? 60);
      default:
        throw new Error(`Unknown domain: ${domain}`);
    }
  }

  private static wrapStrudel(code: string, _autoPlay = false): string {
    const safeCommentCode = code.replace(/-->/g, '--\\u003e');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${STRUDEL_SECURITY_HEADERS.trim()}
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
        strudel-editor { display: block; min-height: 420px; border: 1px solid #312e81; border-radius: 10px; overflow: hidden; }
        .hint { margin: 0 0 12px; color: #f9a8d4; }
    </style>
</head>
<body>
    <h3 style="color: #ec4899; margin-bottom: 8px;">🎵 Strudel Live Coding Pattern</h3>
    <p class="hint">Use the embedded Strudel editor controls to evaluate and play. Browser audio still requires a user click.</p>
    <strudel-editor><!--
${safeCommentCode}
    --></strudel-editor>
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
    ${HYDRA_SECURITY_HEADERS.trim()}
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
            const go = () => {};
            const o = typeof o0 !== 'undefined' ? o0 : undefined;
            
            ${safeCode}
            
        } catch (err) {
            console.error('Hydra error:', err);
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
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

        if (!vertexShader || !fragmentShader) {
            console.error('Shader compilation failed');
            document.body.innerHTML = '<div style="color:#f66;padding:2rem;font-family:monospace;">Shader compile error — see console</div>';
        } else {
            const shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(shaderProgram));
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

    const outVar = normalized.match(/\bout\s+vec4\s+([A-Za-z_$][\w$]*)\s*;/)?.[1];
    normalized = normalized
      .replace(/^\s*#version\s+300\s+es\s*/m, '')
      .replace(/\bout\s+vec4\s+[A-Za-z_$][\w$]*\s*;\s*/g, '');

    if (outVar) {
      normalized = normalized.replace(new RegExp(`\\b${outVar}\\b`, 'g'), 'gl_FragColor');
    }

    return normalized;
  }

  private static wrapRevideo(code: string, _showPreview = false): string {
    const escaped = this.escapeHTML(code);

    const durationMatch = code.match(/durationInFrames[=:]\s*(\d+)/);
    const fpsMatch = code.match(/fps[=:]\s*(\d+)/);
    const widthMatch = code.match(/width[=:]\s*(\d+)/);
    const heightMatch = code.match(/height[=:]\s*(\d+)/);

    const duration = durationMatch ? parseInt(durationMatch[1]) : 150;
    const fps = fpsMatch ? parseInt(fpsMatch[1]) : 30;
    const width = widthMatch ? parseInt(widthMatch[1]) : 1920;
    const height = heightMatch ? parseInt(heightMatch[1]) : 1080;
    const durationSec = (duration / fps).toFixed(1);
    const labels = this.extractRevideoLabels(code);
    const title = this.escapeHTML(labels[0] ?? 'Revideo scene');
    const subtitle = this.escapeHTML(labels[1] ?? 'Generated motion timeline');
    const caption = this.escapeHTML(labels[2] ?? 'Frame-accurate browser preview');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${SECURITY_HEADERS.trim()}
    <title>Revideo Composition</title>
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 20% 20%, rgba(96,165,250,.18), transparent 32%), #05070d; color: #e0e7ff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 36px; }
        .header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: 18px; }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 6px;
            background: rgba(59, 130, 246, 0.3);
            color: #60a5fa;
            font-size: 0.8rem;
            margin-right: 0.5rem;
        }
        .meta { display: flex; gap: 1rem; flex-wrap: wrap; color: #94a3b8; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
        .meta-value { color: #e2e8f0; font-weight: 700; }
        [data-revideo-timeline-preview] { display: grid; gap: 16px; }
        .revideo-stage { position: relative; aspect-ratio: ${width} / ${height}; min-height: 360px; overflow: hidden; border-radius: 24px; border: 1px solid rgba(148,163,184,.28); background: linear-gradient(135deg, #090b17, #14162f 50%, #250b28); box-shadow: 0 24px 80px rgba(0,0,0,.42); }
        .revideo-frame-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 80px 80px; opacity: .28; }
        .orb { position: absolute; width: 30%; aspect-ratio: 1; border-radius: 999px; filter: blur(1px); background: radial-gradient(circle at 35% 35%, #ecfeff, #22d3ee 24%, #7c3aed 58%, transparent 70%); left: 9%; top: 18%; animation: revideo-orbit ${durationSec}s ease-in-out infinite alternate; }
        .title-card { position: absolute; left: 8%; right: 8%; bottom: 14%; padding: clamp(18px, 4vw, 54px); border: 1px solid rgba(255,255,255,.18); border-radius: 22px; background: rgba(7,10,22,.58); backdrop-filter: blur(12px); animation: revideo-title ${durationSec}s ease-in-out infinite; }
        .eyebrow { color: #67e8f9; letter-spacing: .22em; text-transform: uppercase; font-size: clamp(11px, 1.1vw, 14px); font-weight: 800; }
        h1 { margin: 8px 0 0; font-size: clamp(40px, 8vw, 116px); line-height: .9; letter-spacing: -.06em; }
        .subtitle { margin-top: 14px; color: #c4b5fd; font-size: clamp(18px, 2.6vw, 42px); font-weight: 700; }
        .caption { margin-top: 8px; color: #94a3b8; font-size: clamp(13px, 1.4vw, 18px); }
        .timeline { position: relative; height: 68px; border: 1px solid rgba(148,163,184,.24); border-radius: 16px; background: rgba(15,23,42,.74); overflow: hidden; }
        .track { position: absolute; left: 18px; right: 18px; top: 22px; height: 12px; border-radius: 999px; background: linear-gradient(90deg, #38bdf8, #a78bfa, #f472b6); }
        .ticks { position: absolute; left: 18px; right: 18px; bottom: 12px; display: grid; grid-template-columns: repeat(8, 1fr); color: #64748b; font: 10px ui-monospace, monospace; }
        .timeline-playhead { position: absolute; top: 9px; bottom: 9px; width: 3px; border-radius: 999px; background: #fff; box-shadow: 0 0 18px #67e8f9; animation: revideo-playhead ${durationSec}s linear infinite; }
        .frame-readout { position: absolute; right: 18px; top: 43px; color: #cbd5e1; font: 11px ui-monospace, monospace; }
        details { margin-top: 18px; border: 1px solid rgba(148,163,184,.22); border-radius: 16px; background: rgba(2,6,23,.66); }
        summary { cursor: pointer; padding: 14px 16px; color: #bfdbfe; font-weight: 700; }
        pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; padding: 0 16px 16px; overflow-x: auto; color: #dbeafe; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
        .note { color: #94a3b8; font-size: 12px; margin-top: 10px; }
        @keyframes revideo-playhead { from { left: 18px; } to { left: calc(100% - 18px); } }
        @keyframes revideo-orbit { from { transform: translate3d(0, 0, 0) scale(.92); } to { transform: translate3d(145%, 38%, 0) scale(1.24); } }
        @keyframes revideo-title { 0% { transform: translateY(18px); opacity: .72; } 35%, 80% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-10px); opacity: .86; } }
    </style>
</head>
<body>
    <main data-revideo-timeline-preview>
        <div class="header">
            <div>
                <span class="badge">Revideo</span>
                <span class="badge">Timeline preview</span>
            </div>
            <div class="meta">
                <div>Duration: <span class="meta-value">${durationSec}s</span> (${duration} frames @ ${fps}fps)</div>
                <div>Resolution: <span class="meta-value">${width}×${height}</span></div>
            </div>
        </div>
        <section class="revideo-stage" aria-label="Rendered Revideo timeline preview">
            <div class="revideo-frame-grid"></div>
            <div class="orb"></div>
            <article class="title-card">
                <div class="eyebrow">Generated Revideo scene</div>
                <h1>${title}</h1>
                <div class="subtitle">${subtitle}</div>
                <div class="caption">${caption}</div>
            </article>
        </section>
        <section class="timeline" aria-label="Timeline scrub preview">
            <div class="track"></div>
            <div class="timeline-playhead"></div>
            <div class="ticks"><span>0f</span><span>${Math.round(duration * .14)}f</span><span>${Math.round(duration * .28)}f</span><span>${Math.round(duration * .42)}f</span><span>${Math.round(duration * .56)}f</span><span>${Math.round(duration * .70)}f</span><span>${Math.round(duration * .84)}f</span><span>${duration}f</span></div>
            <div class="frame-readout">looping ${duration} frames</div>
        </section>
        <p class="note">Browser-visible timeline approximation from the generated Revideo scene. Use the source details for exact renderer export.</p>
        <details>
            <summary>Source code and export details</summary>
            <pre><code>${escaped}</code></pre>
        </details>
    </main>
</body>
</html>`;
  }

  private static wrapHyperframes(code: string, _showPreview = false): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HyperFrames Composition</title>
  <style>
    body { margin: 0; background: #1a1a2e; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    h2 { color: #e0e0e0; margin-bottom: 16px; }
    .preview { width: 960px; height: 540px; border: 2px solid #333; border-radius: 8px; background: #fff; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #0f0f1a; padding: 1.5rem; border-radius: 8px; border: 1px solid #1e293b; max-width: 960px; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; }
    .info { color: #888; margin-top: 12px; font-size: 14px; }
  </style>
</head>
<body>
  <h2>HyperFrames Composition</h2>
  <iframe class="preview" srcdoc="${escaped}" sandbox="allow-scripts"></iframe>
  <p class="info">Renders via @hyperframes/producer — use Exporter.exportVideo() for MP4 output</p>
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
    const cleanedCode = this.stripLLMToolMarkup(code);
    if (this.isHTMLDocument(cleanedCode)) return this.wrapToneHTML(cleanedCode);

    const safeCode = cleanedCode.replace(/`/g, '\\`');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${TONE_SECURITY_HEADERS.trim()}
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
        #start {
            background: linear-gradient(135deg, #f59e0b, #ef4444);
            color: white;
        }
        #start:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);
        }
        #stop {
            background: #334155;
            color: #e2e8f0;
        }
        #stop:hover {
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
            background: linear-gradient(180deg, #020617, #1e293b);
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <h3>🎹 Tone.js Audio Synthesizer</h3>
    <div id="controls">
        <button id="start">▶ Play</button>
        <button id="stop">⏹ Stop</button>
    </div>
    <div id="status" class="ready">Ready to play (click Start Audio)</div>
    <canvas id="visualizer"></canvas>
    <script>
        let isPlaying = false;
        const playBtn = document.getElementById('start');
        const stopBtn = document.getElementById('stop');
        const statusEl = document.getElementById('status');
        const visualizer = document.getElementById('visualizer');
        const visualizerCtx = visualizer.getContext('2d');
        let toneArtifactError = null;
        function drawToneVisualizer() {
            const w = visualizer.width || 300;
            const h = visualizer.height || 100;
            const t = performance.now() / 1000;
            visualizerCtx.clearRect(0, 0, w, h);
            visualizerCtx.fillStyle = '#020617';
            visualizerCtx.fillRect(0, 0, w, h);
            for (let i = 0; i < 32; i += 1) {
                const level = isPlaying ? (Math.sin(t * 2.5 + i * 0.48) + 1) * 0.38 + 0.18 : 0.12;
                const barH = level * h * (0.52 + (i % 5) * 0.08);
                const x = i * (w / 32);
                const gradient = visualizerCtx.createLinearGradient(0, h - barH, 0, h);
                gradient.addColorStop(0, '#facc15');
                gradient.addColorStop(0.56, '#fb7185');
                gradient.addColorStop(1, '#38bdf8');
                visualizerCtx.fillStyle = gradient;
                visualizerCtx.fillRect(x + 2, h - barH - 6, Math.max(3, w / 42), barH);
            }
            requestAnimationFrame(drawToneVisualizer);
        }
        drawToneVisualizer();

        try {
            ${safeCode}
        } catch (err) {
            toneArtifactError = err;
            console.warn('Tone artifact runtime issue:', err);
            statusEl.className = 'ready';
            statusEl.textContent = 'Tone runtime issue: ' + err.message;
        }
        
        playBtn.addEventListener('click', async () => {
            await Tone.start();
            isPlaying = true;
            statusEl.className = 'playing';
            statusEl.textContent = toneArtifactError
                ? 'Preview shell running; generated Tone code has issue: ' + toneArtifactError.message
                : '🔊 Playing';
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

  private static wrapToneHTML(code: string): string {
    const bodyFragment = this.stripExecutableHTML(this.extractBodyFragment(code)) ||
      '<p class="tone-empty">The generated Tone artifact did not include visible body controls.</p>';
    const inlineScripts = this.extractInlineScripts(code)
      .map(script => this.escapeScript(script))
      .join('\n\n');
    const escapedSource = this.escapeHTML(code);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${TONE_SECURITY_HEADERS.trim()}
    <title>Tone.js Preview</title>
    <script src="${TONE_CDN}"></script>
    <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 20% 18%, rgba(245,158,11,.24), transparent 28%), radial-gradient(circle at 80% 8%, rgba(236,72,153,.18), transparent 30%), #07080f; color: #f8fafc; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: grid; place-items: center; padding: 28px; }
        [data-tone-preview-shell] { width: min(1120px, 100%); display: grid; grid-template-columns: minmax(280px, .9fr) minmax(320px, 1.1fr); gap: 20px; align-items: stretch; }
        .tone-panel, .tone-artifact { border: 1px solid rgba(248,250,252,.14); border-radius: 24px; background: rgba(15,23,42,.72); box-shadow: 0 24px 80px rgba(0,0,0,.36); overflow: hidden; }
        .tone-panel { padding: 24px; display: grid; gap: 18px; align-content: center; }
        .eyebrow { color: #fbbf24; letter-spacing: .18em; text-transform: uppercase; font-size: 12px; font-weight: 800; }
        h1 { margin: 0; font-size: clamp(36px, 6vw, 72px); line-height: .9; letter-spacing: -.06em; }
        .hint { color: #cbd5e1; line-height: 1.55; max-width: 46ch; }
        .controls { display: flex; gap: 12px; flex-wrap: wrap; }
        #liminal-tone-start, #liminal-tone-stop { border: 0; border-radius: 999px; padding: 12px 18px; color: #08111f; font-weight: 800; cursor: pointer; }
        #liminal-tone-start { background: linear-gradient(135deg, #facc15, #fb7185); }
        #liminal-tone-stop { background: #cbd5e1; }
        #liminal-tone-status { color: #fef3c7; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
        #liminal-tone-visualizer { width: 100%; height: 160px; border-radius: 18px; background: linear-gradient(180deg, rgba(2,6,23,.98), rgba(30,41,59,.86)); border: 1px solid rgba(148,163,184,.22); }
        .tone-artifact { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
        .tone-artifact h2 { margin: 0; color: #fed7aa; font-size: 13px; letter-spacing: .16em; text-transform: uppercase; }
        #tone-artifact-surface { min-height: 220px; display: grid; place-items: center; border-radius: 18px; background: rgba(2,6,23,.62); border: 1px solid rgba(148,163,184,.18); padding: 20px; }
        #tone-artifact-surface button, #tone-artifact-surface [role="button"] { border: 0; border-radius: 999px; padding: 10px 15px; background: linear-gradient(135deg, #38bdf8, #a78bfa); color: white; font-weight: 800; cursor: pointer; }
        details { border-top: 1px solid rgba(148,163,184,.18); padding-top: 8px; }
        summary { cursor: pointer; color: #93c5fd; font-weight: 700; }
        pre { white-space: pre-wrap; word-break: break-word; color: #dbeafe; font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 240px; overflow: auto; }
        @media (max-width: 820px) { [data-tone-preview-shell] { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <main data-tone-preview-shell>
        <section class="tone-panel" aria-label="Tone playback controls">
            <div class="eyebrow">Tone.js artifact</div>
            <h1>Audio preview</h1>
            <p class="hint">A polished wrapper around the generated Tone HTML. Start the preview here, or use the embedded controls preserved on the right.</p>
            <canvas id="liminal-tone-visualizer" width="640" height="240"></canvas>
            <div class="controls">
                <button id="liminal-tone-start" type="button">▶ Start preview</button>
                <button id="liminal-tone-stop" type="button">⏹ Stop</button>
            </div>
            <div id="liminal-tone-status">Ready — browser audio starts after a click.</div>
        </section>
        <section class="tone-artifact" aria-label="Embedded Tone artifact">
            <h2>Embedded Tone artifact</h2>
            <div id="tone-artifact-surface">${bodyFragment}</div>
            <details>
                <summary>Original Tone HTML source</summary>
                <pre><code>${escapedSource}</code></pre>
            </details>
        </section>
    </main>
    <script>
        const liminalToneStatus = document.getElementById('liminal-tone-status');
        const liminalToneCanvas = document.getElementById('liminal-tone-visualizer');
        const liminalToneCtx = liminalToneCanvas.getContext('2d');
        let liminalTonePlaying = false;
        function drawToneBars() {
            const w = liminalToneCanvas.width;
            const h = liminalToneCanvas.height;
            const t = performance.now() / 1000;
            liminalToneCtx.clearRect(0, 0, w, h);
            liminalToneCtx.fillStyle = '#020617';
            liminalToneCtx.fillRect(0, 0, w, h);
            for (let i = 0; i < 48; i += 1) {
                const amp = liminalTonePlaying ? (Math.sin(t * 2 + i * .42) + 1) * .42 + .16 : .12;
                const barH = amp * h * (0.45 + (i % 7) * .055);
                const x = i * (w / 48);
                const gradient = liminalToneCtx.createLinearGradient(0, h - barH, 0, h);
                gradient.addColorStop(0, '#facc15');
                gradient.addColorStop(.55, '#fb7185');
                gradient.addColorStop(1, '#38bdf8');
                liminalToneCtx.fillStyle = gradient;
                liminalToneCtx.fillRect(x + 3, h - barH - 10, Math.max(4, w / 58), barH);
            }
            requestAnimationFrame(drawToneBars);
        }
        drawToneBars();
        try {
            ${inlineScripts}
        } catch (error) {
            console.warn('Tone artifact script error:', error);
            liminalToneStatus.textContent = 'Tone artifact script error: ' + error.message;
        }
        document.getElementById('liminal-tone-start').addEventListener('click', async () => {
            try {
                if (window.Tone?.start) await Tone.start();
                liminalTonePlaying = true;
                liminalToneStatus.textContent = 'Playing — embedded artifact controls are preserved.';
                const artifactButton = document.querySelector('#tone-artifact-surface button:not([disabled]), #tone-artifact-surface [role="button"]:not([aria-disabled="true"])');
                if (artifactButton) artifactButton.click();
                else if (typeof play === 'function') play();
            } catch (error) {
                console.warn('Tone preview start error:', error);
                liminalToneStatus.textContent = 'Start error: ' + error.message;
            }
        });
        document.getElementById('liminal-tone-stop').addEventListener('click', () => {
            liminalTonePlaying = false;
            if (window.Tone?.Transport) {
                Tone.Transport.stop();
                Tone.Transport.cancel();
            }
            if (typeof stop === 'function') stop();
            liminalToneStatus.textContent = 'Stopped.';
        });
    </script>
</body>
</html>`;
  }
}

export default GenericWrapper;
