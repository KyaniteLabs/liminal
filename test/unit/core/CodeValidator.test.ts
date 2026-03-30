import { describe, it, expect } from 'vitest';
import { CodeValidator } from '../../../src/core/CodeValidator.js';

describe('CodeValidator', () => {
  describe('stripReasoningText', () => {
    it('should strip LLM reasoning preamble and return clean code', () => {
      const input = `The user wants a p5.js sketch with particles.
I'll create a simple particle system.
Here's a p5.js sketch that does this:

function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(0);
}`;

      const result = CodeValidator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.cleanedCode).toContain('function setup()');
      expect(result.cleanedCode).toContain('function draw()');
      expect(result.cleanedCode).not.toContain("The user wants");
      expect(result.cleanedCode).not.toContain("I'll create");
    });

    it('should return invalid when code is ONLY reasoning text', () => {
      const input = `The user wants a p5.js sketch with particles.
I'll create a simple particle system with flowing colors.
Key elements: setup, draw, particles, color.`;

      const result = CodeValidator.validate(input);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should strip numbered list items with filler', () => {
      const input = `1. The first thing to do
2. A nice particle effect
3. It should look good

function setup() { createCanvas(400,400); }
function draw() { background(0); }`;

      const result = CodeValidator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.cleanedCode).not.toContain('1. The first');
    });

    it('should preserve code inside markdown fences', () => {
      const input = `Here's a sketch:
\`\`\`javascript
function setup() {
  createCanvas(400, 400);
}
\`\`\``;

      const result = CodeValidator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.cleanedCode).toContain('function setup()');
    });
  });

  describe('p5.js structural validation', () => {
    it('should validate valid p5.js code with setup()', () => {
      const code = `function setup() {
  createCanvas(400, 400);
}
function draw() {
  background(0);
  ellipse(200, 200, 50, 50);
}`;
      const result = CodeValidator.validate(code, 'p5');
      expect(result.valid).toBe(true);
    });

    it('should reject p5.js code without setup/draw/createCanvas', () => {
      const code = `console.log("hello");
// This is not p5 code
var x = 5;`;
      const result = CodeValidator.validate(code, 'p5');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('setup');
    });

    it('should accept code with only createCanvas', () => {
      const code = `createCanvas(800, 600);
background(100);`;
      const result = CodeValidator.validate(code, 'p5');
      expect(result.valid).toBe(true);
    });
  });

  describe('GLSL structural validation', () => {
    it('should validate valid GLSL fragment shader', () => {
      const code = `precision mediump float;
uniform vec2 u_resolution;
void main() {
  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}`;
      const result = CodeValidator.validate(code, 'shader');
      expect(result.valid).toBe(true);
    });

    it('should reject non-GLSL code', () => {
      const code = `function setup() { createCanvas(400,400); }`;
      const result = CodeValidator.validate(code, 'shader');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('void main');
    });
  });

  describe('Three.js structural validation', () => {
    it('should validate valid Three.js code', () => {
      const code = `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();`;
      const result = CodeValidator.validate(code, 'three');
      expect(result.valid).toBe(true);
    });

    it('should reject code without THREE references', () => {
      const code = `const scene = {};
const camera = {};`;
      const result = CodeValidator.validate(code, 'three');
      expect(result.valid).toBe(false);
    });
  });

  describe('Remotion structural validation', () => {
    it('should validate valid Remotion code', () => {
      const code = `import { useCurrentFrame, AbsoluteFill } from 'remotion';
export default function MyComp() {
  const frame = useCurrentFrame();
  return <AbsoluteFill><div style={{ opacity: frame / 100 }} /></AbsoluteFill>;
}`;
      const result = CodeValidator.validate(code, 'remotion');
      expect(result.valid).toBe(true);
    });

    it('should reject non-Remotion code', () => {
      const code = `function setup() { createCanvas(400,400); }`;
      const result = CodeValidator.validate(code, 'remotion');
      expect(result.valid).toBe(false);
    });
  });

  describe('Music structural validation', () => {
    it('should validate Strudel music code', () => {
      const code = `$: s("bd sd").slow(2)
$: s("hh").fast(4)
bpm(120)`;
      const result = CodeValidator.validate(code, 'music');
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra visual code', () => {
      const code = `osc(10, 0.1, 0.5).out()
render()`;
      const result = CodeValidator.validate(code, 'music');
      expect(result.valid).toBe(true);
    });

    it('should reject non-music code', () => {
      const code = `function setup() { createCanvas(400,400); }`;
      const result = CodeValidator.validate(code, 'music');
      expect(result.valid).toBe(false);
    });
  });

  describe('Self-contained HTML check', () => {
    it('should validate HTML-wrapped p5.js with CDN', () => {
      const code = `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.js"></script>
</head>
<body>
<script>
function setup() { createCanvas(400,400); }
function draw() { background(0); }
</script>
</body>
</html>`;
      const result = CodeValidator.validate(code);
      expect(result.valid).toBe(true);
    });

    it('should reject HTML-wrapped p5.js without CDN', () => {
      const code = `<!DOCTYPE html>
<html>
<head></head>
<body>
<script>
function setup() { createCanvas(400,400); }
function draw() { background(0); }
</script>
</body>
</html>`;
      const result = CodeValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CDN'))).toBe(true);
    });

    it('should pass raw JS without self-contained check', () => {
      const code = `function setup() { createCanvas(400,400); }
function draw() { background(0); }`;
      const result = CodeValidator.validate(code);
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = CodeValidator.validate('');
      expect(result.valid).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(CodeValidator.validate(null as any).valid).toBe(false);
      expect(CodeValidator.validate(undefined as any).valid).toBe(false);
    });

    it('should handle whitespace-only code', () => {
      const result = CodeValidator.validate('   \n\t\n  ');
      expect(result.valid).toBe(false);
    });

    it('should auto-detect domain when not specified', () => {
      const p5Code = `function setup() { createCanvas(400,400); }`;
      expect(CodeValidator.detectDomain(p5Code)).toBe('p5');

      const glslCode = `void main() { gl_FragColor = vec4(1.0); }`;
      expect(CodeValidator.detectDomain(glslCode)).toBe('shader');
    });
  });
});
