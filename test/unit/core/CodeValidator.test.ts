import { describe, it, expect } from 'vitest';
import { CodeValidator } from '../../../src/core/CodeValidator.js';

// Shared p5 code body that exceeds the 500-byte MIN_SIZE_REQUIREMENTS for p5 domain
const P5_BODY = `particles = [];
for (let i = 0; i < 50; i++) {
  particles.push({ x: random(width), y: random(height), speed: random(1, 3), col: color(random(255), 100, random(255), 200) });
}
function draw() {
  background(0, 0, 0, 25);
  for (let p of particles) {
    fill(p.col);
    noStroke();
    ellipse(p.x, p.y, 10, 10);
    p.x += random(-p.speed, p.speed);
    p.y += random(-p.speed, p.speed);
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
  }
}`;

describe('CodeValidator', () => {
  describe('stripReasoningText', () => {
    it('should strip LLM reasoning preamble and return clean code', () => {
      const input = `The user wants a p5.js sketch with particles.
I'll create a simple particle system.
Here's a p5.js sketch that does this:

function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
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

function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
}`;

      const result = CodeValidator.validate(input);
      expect(result.valid).toBe(true);
      expect(result.cleanedCode).not.toContain('1. The first');
    });

    it('should preserve code inside markdown fences', () => {
      const input = `Here's a sketch:
\`\`\`javascript
function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
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
  background(220);
  ${P5_BODY}
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
background(100);
particles = [];
for (let i = 0; i < 50; i++) {
  particles.push({ x: random(width), y: random(height), size: random(5, 30) });
  rect(particles[i].x, particles[i].y, 20, 20);
  line(particles[i].x, particles[i].y, random(width), random(height));
}
for (let p of particles) {
  fill(color(random(255), random(255), random(255)));
  noStroke();
  ellipse(p.x, p.y, p.size);
  p.x += random(-1, 1);
  p.y += random(-1, 1);
  if (p.x < 0) p.x = width;
  if (p.x > width) p.x = 0;
  if (p.y < 0) p.y = height;
  if (p.y > height) p.y = 0;
}`;
      const result = CodeValidator.validate(code, 'p5');
      expect(result.valid).toBe(true);
    });
  });

  describe('GLSL structural validation', () => {
    it('should validate valid GLSL fragment shader', () => {
      const code = `precision mediump float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
uniform vec2 u_mouse;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 mouse = u_mouse / u_resolution;
  float n = fbm(uv * 4.0 + u_time * 0.3);
  float dist = length(uv - mouse);
  float glow = smoothstep(0.3, 0.0, dist);
  vec3 col = vec3(n * u_color.r + glow, uv.y * u_color.g, sin(u_time + uv.x * 6.28) * 0.5 + 0.5);
  gl_FragColor = vec4(col, 1.0);
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
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshPhongMaterial({ color: 0x00ff00, shininess: 100 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const light = new THREE.PointLight(0xffffff, 1, 100);
light.position.set(5, 5, 5);
scene.add(light);

const ambient = new THREE.AmbientLight(0x404040);
scene.add(ambient);

camera.position.z = 5;

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  cube.position.x = Math.sin(Date.now() * 0.001) * 2;
  renderer.render(scene, camera);
}
animate();`;
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
      const code = `import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { useEffect, useState } from 'react';

export default function MyComp() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 100], [0, 1]);
  const [data, setData] = useState([]);

  useEffect(() => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100
    }));
    setData(items);
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }}>
      <div style={{ opacity, fontSize: 48, color: 'white' }}>
        Frame {frame}
      </div>
      {data.map(item => (
        <div key={item.id} style={{
          position: 'absolute', left: item.x, top: item.y,
          width: 10, height: 10, background: 'cyan', borderRadius: '50%'
        }} />
      ))}
    </AbsoluteFill>
  );
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
$: s("bd [sd bd]").gain(0.8)
$: note("c3 eb3 g3 bb3").s("sawtooth").decay(0.2)
$: s("cp").rarely(x => x.rev())
bpm(120)
setcps(0.5)`;
      const result = CodeValidator.validate(code, 'music');
      expect(result.valid).toBe(true);
    });

    it('should validate Hydra visual code', () => {
      const code = `osc(10, 0.1, 0.5).out()
s0.initCam()
src(s0).modulate(osc(5, 0.1)).out(o1)
render()
setResolution(1920, 1080)
solid(1, 0, 0).diff(osc(3)).out()`;
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
function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
}
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
function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
}
</script>
</body>
</html>`;
      const result = CodeValidator.validate(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CDN'))).toBe(true);
    });

    it('should pass raw JS without self-contained check', () => {
      const code = `function setup() {
  createCanvas(400, 400);
  background(220);
  ${P5_BODY}
}`;
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
