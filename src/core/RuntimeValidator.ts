/**
 * RuntimeValidator - Test generated code actually works before accepting it
 * 
 * This addresses the gap between static analysis (CreativeEvaluator)
 * and actual runtime behavior (does it render? does it compile?)
 */

// RuntimeValidator - Test generated code actually works before accepting it

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

export class RuntimeValidator {
  /**
   * Test GLSL shader compiles in WebGL
   */
  static testGLSL(shaderCode: string): ValidationResult {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      
      if (!gl) {
        return { valid: false, error: 'WebGL not available' };
      }

      // Extract fragment shader from code
      const fsMatch = shaderCode.match(/const\s+fsSource\s*=\s*`([^`]+)`/);
      const fsSource = fsMatch ? fsMatch[1] : shaderCode;

      // Try to compile
      const shader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!shader) {
        return { valid: false, error: 'Could not create shader' };
      }

      gl.shaderSource(shader, fsSource);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader) || 'Unknown shader error';
        gl.deleteShader(shader);
        return { 
          valid: false, 
          error: 'GLSL Compile Error',
          details: error
        };
      }

      gl.deleteShader(shader);
      return { valid: true };
    } catch (err) {
      return { 
        valid: false, 
        error: 'Validation error',
        details: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Test Three.js scene renders visible pixels
   */
  static testThreeJS(htmlContent: string): ValidationResult {
    // For server-side, we can't actually render
    // But we can check for common issues
    
    // Check for scene setup
    if (!htmlContent.includes('Scene') && !htmlContent.includes('scene')) {
      return { valid: false, error: 'Missing scene initialization' };
    }

    // Check for camera
    if (!htmlContent.includes('Camera') && !htmlContent.includes('camera')) {
      return { valid: false, error: 'Missing camera' };
    }

    // Check for renderer
    if (!htmlContent.includes('WebGLRenderer') && !htmlContent.includes('renderer')) {
      return { valid: false, error: 'Missing renderer' };
    }

    // Check for animate/render loop
    if (!htmlContent.includes('animate') && !htmlContent.includes('render')) {
      return { valid: false, error: 'Missing animation loop' };
    }

    return { valid: true };
  }

  /**
   * Generate HTML wrapper for non-HTML outputs (Hydra, Strudel)
   */
  static generateHTMLWrapper(code: string, type: 'hydra' | 'strudel'): string {
    if (type === 'hydra') {
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Hydra Visual</title>
    <script src="https://unpkg.com/hydra-synth"></script>
    <style>
        body { margin: 0; background: #000; overflow: hidden; }
        canvas { display: block; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="hydra-canvas"></canvas>
    <script>
        const hydra = new Hydra({ canvas: document.getElementById('hydra-canvas') });
        ${code.replace(/<think>[\s\S]*?<\/think>/g, '')}
    </script>
</body>
</html>`;
    }

    if (type === 'strudel') {
      return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Strudel Music</title>
    <style>
        body { 
            margin: 0; 
            background: #0a0a12; 
            color: #fff;
            font-family: system-ui;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        iframe { flex: 1; border: none; width: 100%; }
    </style>
</head>
<body>
    <iframe src="https://strudel.tidalcycles.org/#${encodeURIComponent(code.replace(/<think>[\s\S]*?<\/think>/g, ''))}"></iframe>
</body>
</html>`;
    }

    return code;
  }

  /**
   * Detect output type from code
   */
  static detectType(code: string): 'p5' | 'three' | 'glsl' | 'hydra' | 'strudel' | 'remotion' | 'unknown' {
    if (code.includes('function setup()') || code.includes('createCanvas')) {
      return 'p5';
    }
    if (code.includes('THREE.') || code.includes('WebGLRenderer')) {
      return 'three';
    }
    if (code.includes('void main') && code.includes('gl_FragColor')) {
      return 'glsl';
    }
    if (code.includes('.out(o0)') || code.includes('src(o0)')) {
      return 'hydra';
    }
    if (code.includes('.s(') && (code.includes('stack') || code.includes('$:'))) {
      return 'strudel';
    }
    if (code.includes('Remotion') || code.includes('useCurrentFrame')) {
      return 'remotion';
    }
    return 'unknown';
  }
}
