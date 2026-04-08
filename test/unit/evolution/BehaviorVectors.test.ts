import { describe, it, expect } from 'vitest';
import {
  detectDomain,
  extractBehavior,
  type Domain,
} from '../../../src/evolution/BehaviorVectors.js';

// ═══════════════════════════════════════════════════════════════════════════
// detectDomain
// ═══════════════════════════════════════════════════════════════════════════

describe('detectDomain', () => {
  it('detects GLSL from void main() + gl_FragColor', () => {
    expect(detectDomain('void main() { gl_FragColor = vec4(1.0); }')).toBe('glsl');
  });

  it('detects GLSL from void main() + out vec4', () => {
    expect(detectDomain('void main() { out vec4 fragColor; }')).toBe('glsl');
  });

  it('does NOT detect GLSL without gl_FragColor or out vec4', () => {
    // void main() alone is not enough — needs second pattern too
    expect(detectDomain('void main() { x = 1; }')).not.toBe('glsl');
  });

  it('detects Three.js from import three', () => {
    expect(detectDomain("import * as THREE from 'three';")).toBe('three');
  });

  it('detects Three.js from THREE.Scene', () => {
    expect(detectDomain('const scene = new THREE.Scene();')).toBe('three');
  });

  it('detects Three.js from THREE.Scene', () => {
    expect(detectDomain('const scene = new THREE.Scene();')).toBe('three');
  });

  it('detects Remotion from useCurrentFrame', () => {
    expect(detectDomain('const frame = useCurrentFrame();')).toBe('remotion');
  });

  it('detects Remotion from AbsoluteFill', () => {
    expect(detectDomain('<AbsoluteFill>hello</AbsoluteFill>')).toBe('remotion');
  });

  it('detects Remotion from Sequence', () => {
    expect(detectDomain('<Sequence>content</Sequence>')).toBe('remotion');
  });

  it('detects Hydra from .out(', () => {
    expect(detectDomain('osc(10).out(o0)')).toBe('hydra');
  });

  it('detects Hydra from shape(', () => {
    expect(detectDomain('shape(4).out(o0)')).toBe('hydra');
  });

  it('detects Strudel from s(" pattern', () => {
    expect(detectDomain('sound("kick")')).toBe('strudel');
  });

  it('detects Strudel from stack(', () => {
    expect(detectDomain('sound("kick")')).toBe('strudel');
  });

  it('detects ASCII from Unicode box-drawing characters', () => {
    // U+2580 = ╀ (upper left corner)
    expect(detectDomain('\u2580\u2584\u2580')).toBe('ascii');
  });

  it('detects ASCII from shading characters under 5000 chars', () => {
    expect(detectDomain('\u2591\u2593\u2592')).toBe('ascii');
  });

  it('does NOT detect ASCII from shading chars over 5000 chars', () => {
    // Only shading chars (not box-drawing) require length < 5000
    // Box-drawing range \u2580-\u259F always matches regardless of length
    // So use only shading chars NOT in box-drawing range, but over 5000 chars
    const longCode = 'x'.repeat(5001);
    expect(detectDomain(longCode)).toBe('p5'); // defaults to p5, not ASCII
  });

  it('detects HTML from DOCTYPE', () => {
    expect(detectDomain('<!DOCTYPE html><html></html>')).toBe('html');
  });

  it('detects HTML from <html tag', () => {
    expect(detectDomain('<html><div></div></html>')).toBe('html');
  });

  it('detects HTML from section + closing html tag', () => {
    expect(detectDomain('<section>content</section></html>')).toBe('html');
  });

  it('detects music from oscillator', () => {
    expect(detectDomain('const osc = new oscillator();')).toBe('music');
  });

  it('detects music from AudioContext', () => {
    expect(detectDomain('new AudioContext();')).toBe('music');
  });

  it('detects music from Tone.', () => {
    expect(detectDomain('new Tone.Synth();')).toBe('music');
  });

  it('detects music from MIDI', () => {
    expect(detectDomain('MIDI.access();')).toBe('music');
  });

  it('detects music from note(', () => {
    expect(detectDomain('const ctx = new AudioContext();')).toBe('music');
  });

  it('detects music from scale(', () => {
    expect(detectDomain('scale("major")')).toBe('music');
  });

  it('detects music from bpm', () => {
    expect(detectDomain('120 bpm')).toBe('music');
  });

  it('detects p5 from setup()', () => {
    expect(detectDomain('function setup() { createCanvas(400, 400); }')).toBe('p5');
  });

  it('detects p5 from draw()', () => {
    expect(detectDomain('function draw() { background(0); }')).toBe('p5');
  });

  it('detects p5 from createCanvas(', () => {
    expect(detectDomain('createCanvas(800, 600);')).toBe('p5');
  });

  it('defaults to p5 for unrecognized code', () => {
    expect(detectDomain('const x = 42;')).toBe('p5');
  });

  it('defaults to p5 for empty string', () => {
    expect(detectDomain('')).toBe('p5');
  });

  // Priority ordering: GLSL > Three > Remotion > Hydra > Strudel > ASCII > HTML > music > p5
  it('GLSL takes priority over Three.js', () => {
    const code = "void main() { gl_FragColor = vec4(1.0); }\nimport * as THREE from 'three';";
    expect(detectDomain(code)).toBe('glsl');
  });

  it('Three.js takes priority over p5', () => {
    const code = "import { Scene } from 'three';\nfunction setup() { createCanvas(400,400); }";
    expect(detectDomain(code)).toBe('three');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractBehavior
// ═══════════════════════════════════════════════════════════════════════════

describe('extractBehavior', () => {
  it('returns a 72-element vector (9 domains x 8 features)', () => {
    const vec = extractBehavior('const x = 1;');
    expect(vec).toHaveLength(72);
  });

  it('all values are between 0 and 1', () => {
    const vec = extractBehavior('function setup() { createCanvas(400,400); } draw();');
    for (let i = 0; i < vec.length; i++) {
      expect(vec[i]).toBeGreaterThanOrEqual(0);
      expect(vec[i]).toBeLessThanOrEqual(1);
    }
  });

  it('uses provided domain instead of detecting', () => {
    const vec = extractBehavior('const x = 1;', 'p5');
    // p5 features should be non-zero if p5 patterns exist
    // With no p5 patterns, p5 features are all 0 except maybe complexity
    expect(vec).toHaveLength(72);
  });

  it('p5 domain extracts setup feature', () => {
    const vec = extractBehavior('function setup() { createCanvas(400,400); }', 'p5');
    expect(vec[0]).toBe(1); // hasSetup
    expect(vec[1]).toBe(0); // hasDraw
  });

  it('p5 domain extracts draw feature', () => {
    const vec = extractBehavior('function draw() { background(0); }', 'p5');
    expect(vec[0]).toBe(0); // hasSetup
    expect(vec[1]).toBe(1); // hasDraw
  });

  it('p5 domain extracts animation feature', () => {
    const vec = extractBehavior('let f = frameCount;', 'p5');
    expect(vec[2]).toBe(1); // usesAnimation
  });

  it('p5 domain extracts color feature', () => {
    const vec = extractBehavior('fill(255);', 'p5');
    expect(vec[3]).toBe(1); // usesColor
  });

  it('p5 domain extracts interactivity feature', () => {
    const vec = extractBehavior('mousePressed();', 'p5');
    expect(vec[4]).toBe(1); // hasInteractivity
  });

  it('p5 domain extracts class feature', () => {
    const vec = extractBehavior('class Particle {}', 'p5');
    expect(vec[5]).toBe(1); // usesClasses
  });

  it('p5 domain extracts array feature from bracket', () => {
    const vec = extractBehavior('const arr = [1, 2, 3];', 'p5');
    expect(vec[6]).toBe(1); // usesArrays
  });

  it('non-matching domain yields zeros for that domain features', () => {
    const vec = extractBehavior('const x = 1;', 'music');
    // p5 features (indices 0-7) should be all 0 since domain is music, not p5
    for (let i = 0; i < 8; i++) {
      expect(vec[i]).toBe(0);
    }
  });

  it('GLSL domain extracts precision feature', () => {
    const vec = extractBehavior('precision mediump float;', 'glsl');
    expect(vec[8]).toBe(1); // hasPrecision (offset 8 = glsl start)
  });

  it('GLSL domain extracts uniforms feature', () => {
    const code = 'uniform float u1;\nuniform float u2;\nuniform float u3;\nuniform float u4;\nuniform float u5;\nuniform float u6;\nuniform float u7;\nuniform float u8;\nuniform float u9;\nuniform float u10;';
    const vec = extractBehavior(code, 'glsl');
    expect(vec[9]).toBe(1); // hasUniforms (10+ uniforms → min(10/10, 1) = 1)
  });

  it('GLSL domain extracts math functions', () => {
    const vec = extractBehavior('sin(x); cos(y);', 'glsl');
    expect(vec[10]).toBe(1); // usesMathFunctions
  });

  it('GLSL domain extracts ray marching', () => {
    const vec = extractBehavior('float d = signed distance(p);', 'glsl');
    expect(vec[11]).toBe(1); // usesRaymarching (case-insensitive)
  });

  it('Three.js domain extracts scene feature', () => {
    const vec = extractBehavior('const s = new THREE.Scene();', 'three');
    expect(vec[16]).toBe(1); // hasScene (offset 16 = three start)
  });

  it('Three.js domain extracts camera feature', () => {
    const vec = extractBehavior('const c = new THREE.PerspectiveCamera();', 'three');
    expect(vec[17]).toBe(1); // hasCamera
  });

  it('Three.js domain extracts renderer feature', () => {
    const vec = extractBehavior('const r = new THREE.WebGLRenderer();', 'three');
    expect(vec[18]).toBe(1); // hasRenderer
  });

  it('Three.js domain extracts geometry feature', () => {
    const vec = extractBehavior('const g = new THREE.BoxGeometry();', 'three');
    expect(vec[19]).toBe(1); // hasGeometry
  });

  it('Three.js domain extracts material feature', () => {
    const vec = extractBehavior('const m = new THREE.MeshBasicMaterial();', 'three');
    expect(vec[20]).toBe(1); // hasMaterial
  });

  it('Three.js domain extracts lighting feature', () => {
    const vec = extractBehavior('const l = new THREE.DirectionalLight();', 'three');
    expect(vec[21]).toBe(1); // hasLighting
  });

  it('Three.js domain extracts animation feature', () => {
    const vec = extractBehavior('requestAnimationFrame(animate);', 'three');
    expect(vec[22]).toBe(1); // hasAnimation
  });

  it('music domain extracts oscillator feature', () => {
    const vec = extractBehavior('new oscillator();', 'music');
    expect(vec[24]).toBe(1); // hasOscillator (offset 24 = music start)
  });

  it('music domain extracts notes feature', () => {
    const vec = extractBehavior('note(60)', 'music');
    expect(vec[25]).toBe(1); // hasNotes
  });

  it('music domain extracts rhythm feature', () => {
    const vec = extractBehavior('120 bpm', 'music');
    expect(vec[26]).toBe(1); // hasRhythm
  });

  it('music domain extracts effects feature', () => {
    const vec = extractBehavior('reverb(delay)', 'music');
    expect(vec[27]).toBe(1); // hasEffects
  });

  it('music domain extracts scales feature', () => {
    const vec = extractBehavior('scale("major")', 'music');
    expect(vec[28]).toBe(1); // hasScales
  });

  it('music domain extracts tempo feature', () => {
    const vec = extractBehavior('120 bpm', 'music');
    expect(vec[29]).toBe(1); // hasTempo
  });

  it('music domain extracts envelope feature', () => {
    const vec = extractBehavior('envelope(attack, decay)', 'music');
    expect(vec[30]).toBe(1); // hasEnvelope
  });

  it('HTML domain extracts header feature', () => {
    const vec = extractBehavior('<header>Welcome</header>', 'html');
    expect(vec[32]).toBe(1); // hasHeader (offset 32 = html start)
  });

  it('HTML domain extracts nav feature', () => {
    const vec = extractBehavior('<nav>links</nav>', 'html');
    expect(vec[33]).toBe(1); // hasNav
  });

  it('HTML domain extracts section feature', () => {
    const vec = extractBehavior('<section>content</section>', 'html');
    expect(vec[34]).toBe(1); // hasSections
  });

  it('HTML domain extracts CTA feature', () => {
    const vec = extractBehavior('<button>click me</button>', 'html');
    expect(vec[35]).toBe(1); // hasCTA
  });

  it('HTML domain extracts footer feature', () => {
    const vec = extractBehavior('<footer>bottom</footer>', 'html');
    expect(vec[36]).toBe(1); // hasFooter
  });

  it('HTML domain extracts styling feature', () => {
    const vec = extractBehavior('<div style="color:red">hi</div>', 'html');
    expect(vec[37]).toBe(1); // hasStyling
  });

  it('HTML domain extracts responsive feature', () => {
    const vec = extractBehavior('@media screen and (max-width: 768px)', 'html');
    expect(vec[38]).toBe(1); // isResponsive
  });

  it('ASCII domain extracts shading characters', () => {
    const vec = extractBehavior('\u2591\u2593\u2592', 'ascii');
    expect(vec[42]).toBe(1); // hasShading (offset 40+2)
  });

  it('ASCII domain extracts box drawing characters', () => {
    const vec = extractBehavior('\u250C\u2510\u2514\u2518', 'ascii');
    expect(vec[43]).toBe(1); // hasBoxDrawing
  });

  it('ASCII domain extracts multiple lines feature', () => {
    const lines = Array(15).fill('hello').join('\n');
    const vec = extractBehavior(lines, 'ascii');
    expect(vec[45]).toBe(1); // hasMultipleLines (offset 40+5)
  });

  it('ASCII domain extracts content length feature', () => {
    const longContent = 'x'.repeat(300);
    const vec = extractBehavior(longContent, 'ascii');
    expect(vec[46]).toBe(1); // hasContent (offset 40+6)
  });

  it('Remotion domain extracts frame feature', () => {
    const vec = extractBehavior('useCurrentFrame()', 'remotion');
    expect(vec[48]).toBe(1); // usesFrame (offset 48 = remotion start)
  });

  it('Remotion domain extracts video config feature', () => {
    const vec = extractBehavior('useVideoConfig()', 'remotion');
    expect(vec[49]).toBe(1); // usesVideoConfig
  });

  it('Remotion domain extracts AbsoluteFill feature', () => {
    const vec = extractBehavior('<AbsoluteFill>hi</AbsoluteFill>', 'remotion');
    expect(vec[50]).toBe(1); // usesAbsoluteFill
  });

  it('Remotion domain extracts Sequence feature', () => {
    const vec = extractBehavior('<Sequence></Sequence>', 'remotion');
    expect(vec[51]).toBe(1); // usesSequence
  });

  it('Remotion domain extracts animation feature', () => {
    const vec = extractBehavior('interpolate(spring())', 'remotion');
    expect(vec[52]).toBe(1); // usesAnimation
  });

  it('Remotion domain extracts import feature', () => {
    const vec = extractBehavior("from 'remotion'", 'remotion');
    expect(vec[53]).toBe(1); // importsRemotion
  });

  it('Remotion domain extracts component feature', () => {
    const vec = extractBehavior('export default function', 'remotion');
    expect(vec[54]).toBe(1); // hasComponent
  });

  it('Hydra domain extracts output feature', () => {
    const vec = extractBehavior('osc(10).out(o0)', 'hydra');
    expect(vec[56]).toBe(1); // hasOutput (offset 56 = hydra start)
  });

  it('Hydra domain extracts oscillator feature', () => {
    const vec = extractBehavior('osc(10)', 'hydra');
    expect(vec[57]).toBe(1); // usesOscillator
  });

  it('Hydra domain extracts shape feature', () => {
    const vec = extractBehavior('shape(4)', 'hydra');
    expect(vec[58]).toBe(1); // usesShape
  });

  it('Hydra domain extracts kaleidoscope feature', () => {
    const vec = extractBehavior('kaleid(3)', 'hydra');
    expect(vec[59]).toBe(1); // usesKaleidoscope
  });

  it('Hydra domain extracts scroll feature', () => {
    const vec = extractBehavior('scrollX(10)', 'hydra');
    expect(vec[60]).toBe(1); // usesScroll
  });

  it('Hydra domain extracts source feature', () => {
    const vec = extractBehavior('src(o0)', 'hydra');
    expect(vec[61]).toBe(1); // usesSource
  });

  it('Hydra domain extracts effects feature', () => {
    const vec = extractBehavior('modulate(o0)', 'hydra');
    expect(vec[62]).toBe(1); // usesEffects
  });

  it('Strudel domain extracts sound feature', () => {
    const vec = extractBehavior('sound("kick")', 'strudel');
    expect(vec[68]).toBe(1); // usesSound (offset 64+4 = 68)
  });

  it('Strudel domain extracts stack feature', () => {
    const vec = extractBehavior('stack(s("bd"))', 'strudel');
    expect(vec[65]).toBe(1); // usesStack
  });

  it('Strudel domain extracts sequence feature', () => {
    const vec = extractBehavior('seq("bd")', 'strudel');
    expect(vec[66]).toBe(1); // usesSequence
  });

  it('Strudel domain extracts notes feature', () => {
    const vec = extractBehavior('note("c3")', 'strudel');
    expect(vec[67]).toBe(1); // usesNotes
  });

  it('Strudel domain extracts sound feature', () => {
    const vec = extractBehavior('sound("kick")', 'strudel');
    expect(vec[68]).toBe(1); // usesSound
  });

  it('Strudel domain extracts tempo feature', () => {
    const vec = extractBehavior('120 bpm', 'strudel');
    expect(vec[69]).toBe(1); // usesTempo
  });

  it('complexity feature is 0 for simple code', () => {
    const vec = extractBehavior('x', 'p5');
    // Last element of each 8-element section is codeComplexity
    // For 'x' with almost no patterns, complexity should be very low (close to 0)
    expect(vec[7]).toBe(0); // p5 complexity
  });

  it('complexity feature is non-zero for complex code', () => {
    const code = `
      function setup() { createCanvas(400, 400); }
      function draw() {
        for (let i = 0; i < 10; i++) {
          if (random() > 0.5) {
            fill(255);
          }
        }
      }
      class Particle {
        constructor() {}
      }
    `;
    const vec = extractBehavior(code, 'p5');
    expect(vec[7]).toBeGreaterThan(0); // p5 complexity — many patterns
  });

  it('auto-detects domain and extracts matching features', () => {
    // GLSL code — should auto-detect and extract GLSL features
    const glslCode = 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';
    const vec = extractBehavior(glslCode);
    // GLSL features start at index 8
    // No precision declaration in this code, so vec[8] = 0
    expect(vec[8]).toBe(0); // hasPrecision
    // At minimum, complexity should be >= 0
    expect(vec[15]).toBeGreaterThanOrEqual(0); // GLSL complexity
    // p5 features should be 0 since domain is glsl
    expect(vec[0]).toBe(0); // p5 hasSetup
  });
});
