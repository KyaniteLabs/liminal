/**
 * Centralized HTML wrapping utility for Liminal outputs
 * Prevents double-wrapping and ensures correct templates per domain
 */

export type Domain = 'p5' | 'shader' | 'three' | 'remotion';

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
const P5_SOUND_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/addons/p5.sound.min.js';

export interface WrapOptions {
  domain?: Domain;
  title?: string;
  includeP5Sound?: boolean;
}

export class HTMLWrapper {
  /**
   * Detect if code is already wrapped in HTML
   */
  static isAlreadyWrapped(code: string): boolean {
    const trimmed = code.trim();
    return trimmed.startsWith('<!DOCTYPE html>') ||
           trimmed.startsWith('<html');
  }

  /**
   * Detect domain from code content
   */
  static detectDomain(code: string): Domain {
    if (this.isAlreadyWrapped(code)) {
      // Already wrapped - try to detect from content
      if (code.includes('import * as THREE') || code.includes('from "three"')) {
        return 'three';
      }
      // Default to p5 for wrapped code
      return 'p5';
    }

    // Three.js detection
    if (this.isThreeJSCode(code)) {
      return 'three';
    }

    // Shader detection
    if (this.isShaderCode(code)) {
      return 'shader';
    }

    // Remotion detection
    if (this.isRemotionCode(code)) {
      return 'remotion';
    }

    // p5.js detection (default)
    return 'p5';
  }

  private static isThreeJSCode(code: string): boolean {
    const hasDoctype = code.trim().startsWith('<!DOCTYPE html>');
    const hasHTMLTag = /<html[^>]*>/i.test(code);
    const hasThreeImport = /import.*\bfrom\s+['"]three['"]|from\s+['"]@three\/foundation['"]/.test(code);
    const hasImportMap = /<script\s+type="importmap">/.test(code);

    return hasDoctype && hasHTMLTag && (hasThreeImport || hasImportMap);
  }

  private static isShaderCode(code: string): boolean {
    // GLSL fragment shader patterns
    const hasVoidMain = /void\s+main\s*\(/.test(code);
    const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
    const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
    const hasPrecision = /precision\s+(highp|mediump|lowp)\s+float/.test(code);

    // Must have multiple GLSL indicators, not just one
    const glslIndicators = [hasVoidMain, hasFragColor, hasUniforms, hasPrecision]
      .filter(Boolean).length;

    return glslIndicators >= 2 && !code.includes('function setup()') && !code.includes('function draw()');
  }

  private static isRemotionCode(code: string): boolean {
    return /useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(code);
  }

  /**
   * Wrap code in appropriate HTML template
   */
  static wrap(code: string, options?: WrapOptions | Domain): string {
    // Support legacy call with just domain string
    let domain: Domain | undefined;
    let includeP5Sound = false;
    let title = 'p5.js Sketch';

    if (typeof options === 'string') {
      domain = options;
    } else if (options) {
      domain = options.domain;
      includeP5Sound = options.includeP5Sound ?? false;
      title = options.title ?? 'p5.js Sketch';
    }

    // Don't double-wrap
    if (this.isAlreadyWrapped(code)) {
      return code;
    }

    // Detect domain if not specified
    const detectedDomain = domain || this.detectDomain(code);

    // Use appropriate wrapper
    switch (detectedDomain) {
      case 'shader':
        return this.wrapShader(code);
      case 'three':
        return code; // Three.js templates already complete
      case 'remotion':
        return this.wrapRemotion(code);
      case 'p5':
      default:
        return this.wrapP5(code, includeP5Sound, title);
    }
  }

  private static wrapP5(code: string, includeP5Sound = false, title = 'p5.js Sketch'): string {
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    const usesWebAudio = /AudioContext|createOscillator|p5\.sound/i.test(code);
    const soundComment = usesWebAudio
      ? '\n    <!-- Sound may require user click to start (browser policy). -->'
      : '';
    const p5SoundScript = includeP5Sound
      ? `\n    <script src="${P5_SOUND_CDN}"></script>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="${P5_CDN}"></script>${p5SoundScript}
    <style>
        body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
        main { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body>${soundComment}
    <main>
        <script>
${safeCode}
        </script>
    </main>
</body>
</html>`;
  }

  private static wrapShader(code: string): string {
    const safeCode = code.replace(/\u003c\/script\u003e/gi, '<\\/script>');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(shaderProgram));
            return;
        }

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
    </script>
</body>
</html>`;
  }

  /**
   * Wrap Remotion React/TSX code in a minimal HTML preview.
   * Remotion normally needs a bundler, but we can show the code with syntax highlighting.
   */
  private static wrapRemotion(code: string): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remotion Composition</title>
    <style>
        body { margin: 0; padding: 2rem; background: #0a0a0f; color: #e0e0e0; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.85rem; line-height: 1.6; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 6px; background: rgba(139, 92, 246, 0.2); color: #8b5cf6; font-size: 0.8rem; margin-bottom: 1rem; }
        .note { color: #a0a0b0; font-size: 0.8rem; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="badge">Remotion</div>
    <p class="note">Remotion requires a bundler to render. This is the generated composition code:</p>
    <pre><code>${escaped}</code></pre>
</body>
</html>`;
  }
}
