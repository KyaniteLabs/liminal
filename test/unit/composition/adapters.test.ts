import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ASCIIArtAdapter, asciiArtAdapter } from '../../../src/composition/adapters/ASCIIArtAdapter.js';
import { HTMLAdapter, htmlAdapter } from '../../../src/composition/adapters/HTMLAdapter.js';
import { HydraAdapter, hydraAdapter } from '../../../src/composition/adapters/HydraAdapter.js';
import { P5Adapter, p5Adapter } from '../../../src/composition/adapters/P5Adapter.js';
import { StrudelAdapter, strudelAdapter } from '../../../src/composition/adapters/StrudelAdapter.js';
import { ThreeAdapter, threeAdapter } from '../../../src/composition/adapters/ThreeAdapter.js';
import { ToneAdapter, toneAdapter } from '../../../src/composition/adapters/ToneAdapter.js';
import { ShaderAdapter, shaderAdapter } from '../../../src/composition/adapters/ShaderAdapter.js';
import { AdapterRegistry } from '../../../src/composition/adapters/index.js';
import type { Layer } from '../../../src/composition/types.js';

// ---------------------------------------------------------------------------
// Helper: factory for Layer objects
// ---------------------------------------------------------------------------

function makeLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'test-layer-1',
    domain: 'p5',
    code: 'function setup() { createCanvas(400, 400); }',
    config: {
      zIndex: 1,
      opacity: 1,
      blendMode: 'normal',
    },
    ...overrides,
  };
}

// ===========================================================================
// ASCIIArtAdapter
// ===========================================================================

describe('ASCIIArtAdapter', () => {
  describe('validate', () => {
    it('rejects empty content', () => {
      const layer = makeLayer({ code: '' });
      const adapter = new ASCIIArtAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('ASCII art content is empty');
    });

    it('rejects whitespace-only content', () => {
      const layer = makeLayer({ code: '   \n  \t  ' });
      const adapter = new ASCIIArtAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
    });

    it('accepts valid ASCII content', () => {
      const layer = makeLayer({ code: '  /\\_/\\\n ( o.o )\n  > ^ <' });
      const adapter = new ASCIIArtAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('accepts box-drawing characters', () => {
      const layer = makeLayer({ code: '┌───┐\n│ Hi│\n└───┘' });
      const adapter = new ASCIIArtAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('accepts block characters', () => {
      const layer = makeLayer({ code: '█████\n█   █\n█████' });
      const adapter = new ASCIIArtAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });
  });

  describe('getImports', () => {
    it('returns empty imports (self-contained)', () => {
      const adapter = new ASCIIArtAdapter();
      expect(adapter.getImports()).toEqual([]);
    });
  });

  describe('generateScript', () => {
    it('produces a pre element with the code', () => {
      const layer = makeLayer({ code: 'Hello ASCII', config: { zIndex: 5, opacity: 0.8, blendMode: 'normal' } });
      const adapter = new ASCIIArtAdapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).toContain('Hello ASCII');
      expect(script).toContain('z-index: 5');
      expect(script).toContain('opacity: 0.8');
    });

    it('escapes HTML special characters', () => {
      const layer = makeLayer({ code: '<script>alert("xss")</script>' });
      const adapter = new ASCIIArtAdapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).not.toContain('<script>alert');
      expect(script).toContain('&lt;script&gt;');
    });
  });

  describe('getExports', () => {
    it('returns empty when no instance rendered', () => {
      const adapter = new ASCIIArtAdapter();
      const layer = makeLayer();
      expect(adapter.getExports(layer)).toEqual([]);
    });
  });

  describe('destroy', () => {
    it('does not throw when no instance exists', () => {
      const adapter = new ASCIIArtAdapter();
      const layer = makeLayer();
      expect(() => adapter.destroy(layer, null)).not.toThrow();
    });
  });
});

// ===========================================================================
// HTMLAdapter
// ===========================================================================

describe('HTMLAdapter', () => {
  describe('validate', () => {
    it('rejects empty content', () => {
      const layer = makeLayer({ code: '' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTML content is empty');
    });

    it('rejects script tags for security', () => {
      const layer = makeLayer({ code: '<div><script>alert("xss")</script></div>' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      const scriptError = result.errors?.find(e => e.includes('script'));
      expect(scriptError).toBeTruthy();
    });

    it('accepts valid HTML', () => {
      const layer = makeLayer({ code: '<div><p>Hello</p></div>' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('detects mismatched tags', () => {
      const layer = makeLayer({ code: '<div><p></div>' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Mismatched'))).toBe(true);
    });

    it('detects unclosed tags', () => {
      const layer = makeLayer({ code: '<div><span>Hello' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Unclosed'))).toBe(true);
    });

    it('accepts self-closing tags', () => {
      const layer = makeLayer({ code: '<div><br/><img src="test.png"/></div>' });
      const adapter = new HTMLAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });
  });

  describe('getImports', () => {
    it('returns imports from p5 and three', () => {
      const adapter = new HTMLAdapter();
      const imports = adapter.getImports();

      expect(imports.length).toBeGreaterThan(0);
      const fromP5 = imports.filter(i => i.from === 'p5');
      expect(fromP5.length).toBeGreaterThan(0);
      const fromThree = imports.filter(i => i.from === 'three');
      expect(fromThree.length).toBeGreaterThan(0);
    });
  });

  describe('generateScript', () => {
    it('extracts and includes styles', () => {
      const layer = makeLayer({
        code: '<style>body { color: red; }</style><p>Hello</p>',
        config: { zIndex: 2, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new HTMLAdapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).toContain('color: red');
      expect(script).toContain('z-index: 2');
    });
  });
});

// ===========================================================================
// HydraAdapter
// ===========================================================================

describe('HydraAdapter', () => {
  describe('validate', () => {
    it('rejects empty code', () => {
      const layer = makeLayer({ code: '' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('requires .out() call', () => {
      const layer = makeLayer({ code: 'osc(10)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('.out()'))).toBe(true);
    });

    it('requires a source function', () => {
      const layer = makeLayer({ code: 'someFunc().out(o0)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('source function'))).toBe(true);
    });

    it('accepts valid Hydra code', () => {
      const layer = makeLayer({ code: 'osc(10).out(o0)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('rejects invalid Math methods used as Hydra methods', () => {
      const layer = makeLayer({ code: 'osc(10).sin(0.5).out(o0)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('.sin('))).toBe(true);
    });

    it('accepts noise() source function', () => {
      const layer = makeLayer({ code: 'noise(3).out(o0)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('accepts shape() source function', () => {
      const layer = makeLayer({ code: 'shape(4).out(o0)' });
      const adapter = new HydraAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });
  });

  describe('getImports', () => {
    it('returns imports from p5 and three', () => {
      const adapter = new HydraAdapter();
      const imports = adapter.getImports();

      expect(imports.length).toBe(2);
      expect(imports.some(i => i.from === 'p5')).toBe(true);
      expect(imports.some(i => i.from === 'three')).toBe(true);
    });
  });

  describe('generateScript', () => {
    it('includes Hydra CDN and layer code', () => {
      const layer = makeLayer({
        code: 'osc(10).out(o0)',
        config: { zIndex: 3, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new HydraAdapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).toContain('hydra-synth');
      expect(script).toContain('osc(10).out(o0)');
      expect(script).toContain('zIndex');
    });
  });
});

// ===========================================================================
// P5Adapter
// ===========================================================================

describe('P5Adapter', () => {
  describe('validate', () => {
    it('requires setup() function', () => {
      const layer = makeLayer({ code: 'function draw() { rect(10,10,50,50); }' });
      const adapter = new P5Adapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing setup() function');
    });

    it('requires draw() function', () => {
      const layer = makeLayer({ code: 'function setup() { createCanvas(400,400); }' });
      const adapter = new P5Adapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing draw() function');
    });

    it('accepts code with both setup and draw', () => {
      const layer = makeLayer({
        code: 'function setup() { createCanvas(400,400); }\nfunction draw() { background(0); }',
      });
      const adapter = new P5Adapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getImports', () => {
    it('returns empty (self-contained)', () => {
      const adapter = new P5Adapter();
      expect(adapter.getImports()).toEqual([]);
    });
  });

  describe('generateScript', () => {
    it('includes p5 CDN and layer code', () => {
      const layer = makeLayer({
        code: 'function setup() {}\nfunction draw() {}',
        config: { zIndex: 1, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new P5Adapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).toContain('p5.js');
      expect(script).toContain('function setup()');
    });
  });
});

// ===========================================================================
// StrudelAdapter
// ===========================================================================

describe('StrudelAdapter', () => {
  describe('validate', () => {
    it('rejects empty code', () => {
      const layer = makeLayer({ code: '' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Code is empty');
    });

    it('requires pattern functions', () => {
      const layer = makeLayer({ code: 'console.log("hello")' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('pattern functions'))).toBe(true);
    });

    it('accepts code with s() pattern function', () => {
      const layer = makeLayer({ code: 's("bd sd")' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('accepts code with note() function', () => {
      const layer = makeLayer({ code: 'note("c3 eb3 g3")' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('accepts code with sound() function', () => {
      const layer = makeLayer({ code: 'sound("kick")' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('rejects unmatched parentheses', () => {
      const layer = makeLayer({ code: 's("bd sd"' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('unmatched parentheses'))).toBe(true);
    });

    it('rejects non-ASCII characters (CJK)', () => {
      const layer = makeLayer({ code: 's("bd") // 音乐' });
      const adapter = new StrudelAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('non-ASCII'))).toBe(true);
    });
  });

  describe('getImports', () => {
    it('returns imports from tone and p5', () => {
      const adapter = new StrudelAdapter();
      const imports = adapter.getImports();

      expect(imports.length).toBeGreaterThan(0);
      expect(imports.some(i => i.from === 'tone')).toBe(true);
      expect(imports.some(i => i.from === 'p5')).toBe(true);
    });
  });

  describe('generateScript', () => {
    it('includes Strudel CDN', () => {
      const layer = makeLayer({
        code: 's("bd sd")',
        config: { zIndex: 1, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new StrudelAdapter();
      const script = adapter.generateScript(layer, { audio: { enabled: true, volume: 0.8 } } as any);

      expect(script).toContain('strudel');
    });
  });
});

// ===========================================================================
// ThreeAdapter
// ===========================================================================

describe('ThreeAdapter', () => {
  describe('validate', () => {
    it('requires THREE.Scene', () => {
      const layer = makeLayer({
        code: 'const camera = new THREE.PerspectiveCamera();\nconst renderer = new THREE.WebGLRenderer();',
      });
      const adapter = new ThreeAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing THREE.Scene creation');
    });

    it('requires THREE.PerspectiveCamera', () => {
      const layer = makeLayer({
        code: 'const scene = new THREE.Scene();\nconst renderer = new THREE.WebGLRenderer();',
      });
      const adapter = new ThreeAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing THREE.PerspectiveCamera creation');
    });

    it('requires THREE.WebGLRenderer', () => {
      const layer = makeLayer({
        code: 'const scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera();',
      });
      const adapter = new ThreeAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing THREE.WebGLRenderer creation');
    });

    it('accepts complete Three.js code', () => {
      const layer = makeLayer({
        code: 'const scene = new THREE.Scene();\nconst camera = new THREE.PerspectiveCamera();\nconst renderer = new THREE.WebGLRenderer();',
      });
      const adapter = new ThreeAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getImports', () => {
    it('returns mouse imports from p5', () => {
      const adapter = new ThreeAdapter();
      const imports = adapter.getImports(makeLayer());

      expect(imports.length).toBe(2);
      expect(imports.every(i => i.from === 'p5')).toBe(true);
    });
  });

  describe('generateScript', () => {
    it('includes Three.js CDN', () => {
      const layer = makeLayer({
        code: 'const scene = new THREE.Scene();',
        config: { zIndex: 1, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new ThreeAdapter();
      const script = adapter.generateScript(layer, {} as any);

      expect(script).toContain('three.js');
      expect(script).toContain('THREE.Scene');
    });
  });
});

// ===========================================================================
// ToneAdapter
// ===========================================================================

describe('ToneAdapter', () => {
  describe('validate', () => {
    it('requires Tone.js reference', () => {
      const layer = makeLayer({ code: 'const x = 42;' });
      const adapter = new ToneAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('Tone.');
    });

    it('accepts code referencing Tone.js', () => {
      const layer = makeLayer({ code: 'const synth = new Tone.Synth().toDestination();' });
      const adapter = new ToneAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getImports', () => {
    it('returns imports from p5', () => {
      const adapter = new ToneAdapter();
      const imports = adapter.getImports();

      expect(imports.length).toBe(3);
      expect(imports.every(i => i.from === 'p5')).toBe(true);
    });
  });

  describe('generateScript', () => {
    it('includes Tone.js CDN and converts volume to dB', () => {
      const layer = makeLayer({
        code: 'const synth = new Tone.Synth().toDestination();',
        config: { zIndex: 1, opacity: 1, blendMode: 'normal' },
      });
      const adapter = new ToneAdapter();
      const script = adapter.generateScript(layer, { audio: { volume: 0.5 } } as any);

      expect(script).toContain('Tone.js');
      expect(script).toContain('Tone.Synth');
    });
  });
});

// ===========================================================================
// ShaderAdapter
// ===========================================================================

describe('ShaderAdapter', () => {
  describe('validate', () => {
    it('rejects empty shader code', () => {
      const layer = makeLayer({ code: '' });
      const adapter = new ShaderAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Shader code is empty');
    });

    it('accepts fragment shader with gl_FragColor', () => {
      const layer = makeLayer({
        code: 'attribute vec2 a_position;\nprecision mediump float;\nvoid main() { gl_FragColor = vec4(1.0); }',
      });
      const adapter = new ShaderAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('flags missing fragment shader when only vertex indicators found', () => {
      const layer = makeLayer({
        code: 'attribute vec2 a_position;\nvoid main() { gl_Position = vec4(0.0); }',
      });
      const adapter = new ShaderAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('fragment shader'))).toBe(true);
    });

    it('validates explicit vertex + fragment sections', () => {
      const layer = makeLayer({
        code: '// Vertex Shader\nvoid main() {}\n// Fragment Shader\nvoid main() {}',
      });
      const adapter = new ShaderAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(true);
    });

    it('flags missing main in vertex section when explicit sections used', () => {
      const layer = makeLayer({
        code: '// Vertex Shader\nattribute vec2 a;\n// Fragment Shader\nvoid main() {}',
      });
      const adapter = new ShaderAdapter();
      const result = adapter.validate(layer);

      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('Vertex shader missing main'))).toBe(true);
    });
  });

  describe('getImports', () => {
    it('returns empty (shaders are self-contained)', () => {
      const adapter = new ShaderAdapter();
      expect(adapter.getImports(makeLayer())).toEqual([]);
    });
  });
});

// ===========================================================================
// AdapterRegistry
// ===========================================================================

describe('AdapterRegistry', () => {
  it('registers and retrieves adapters by domain type', () => {
    const registry = new AdapterRegistry();
    const adapter = new ASCIIArtAdapter();
    registry.register('ascii', adapter);

    expect(registry.has('ascii')).toBe(true);
    expect(registry.get('ascii')).toBe(adapter);
  });

  it('returns undefined for unregistered types', () => {
    const registry = new AdapterRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('lists all registered types', () => {
    const registry = new AdapterRegistry();
    registry.register('p5', p5Adapter);
    registry.register('ascii', asciiArtAdapter);

    const types = registry.getTypes();
    expect(types).toContain('p5');
    expect(types).toContain('ascii');
    expect(types.length).toBe(2);
  });

  it('overwrites existing adapter on re-register', () => {
    const registry = new AdapterRegistry();
    const adapter1 = new ASCIIArtAdapter();
    const adapter2 = new ASCIIArtAdapter();
    registry.register('ascii', adapter1);
    registry.register('ascii', adapter2);

    expect(registry.get('ascii')).toBe(adapter2);
  });
});

// ===========================================================================
// Singleton adapter instances
// ===========================================================================

describe('Singleton adapter instances', () => {
  it('asciiArtAdapter is an instance of ASCIIArtAdapter', () => {
    expect(asciiArtAdapter).toBeInstanceOf(ASCIIArtAdapter);
  });

  it('htmlAdapter is an instance of HTMLAdapter', () => {
    expect(htmlAdapter).toBeInstanceOf(HTMLAdapter);
  });

  it('hydraAdapter is an instance of HydraAdapter', () => {
    expect(hydraAdapter).toBeInstanceOf(HydraAdapter);
  });

  it('p5Adapter is an instance of P5Adapter', () => {
    expect(p5Adapter).toBeInstanceOf(P5Adapter);
  });

  it('strudelAdapter is an instance of StrudelAdapter', () => {
    expect(strudelAdapter).toBeInstanceOf(StrudelAdapter);
  });

  it('threeAdapter is an instance of ThreeAdapter', () => {
    expect(threeAdapter).toBeInstanceOf(ThreeAdapter);
  });

  it('toneAdapter is an instance of ToneAdapter', () => {
    expect(toneAdapter).toBeInstanceOf(ToneAdapter);
  });

  it('shaderAdapter is an instance of ShaderAdapter', () => {
    expect(shaderAdapter).toBeInstanceOf(ShaderAdapter);
  });
});
