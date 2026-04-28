/**
 * Unit tests for PromptEnhancer (cross-layer integration)
 *
 * TDD Process:
 * 1. RED: Write tests for context extraction, formatting, instructions
 * 2. GREEN: Implement enhancer
 * 3. REFACTOR: Clean code, optimize
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PromptEnhancer,
  EnhancementContext,
  EnhancedPrompt,
} from '../../../src/composition/PromptEnhancer.js';
import { Layer, DomainType } from '../../../src/composition/types.js';

describe('PromptEnhancer', () => {
  let enhancer: PromptEnhancer;

  beforeEach(() => {
    enhancer = new PromptEnhancer();
  });

  describe('Basic Functionality', () => {
    it('should create a PromptEnhancer instance', () => {
      expect(enhancer).toBeInstanceOf(PromptEnhancer);
    });

    it('should enhance a prompt with single existing layer', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() { createCanvas(800, 600); }\nfunction draw() { circle(mouseX, mouseY, 50); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'interactive circles following mouse',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'tone',
      };

      const result = enhancer.enhance(context);

      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('instructions');
      expect(typeof result.prompt).toBe('string');
      expect(typeof result.context).toBe('string');
      expect(typeof result.instructions).toBe('string');
    });

    it('should enhance a prompt with multiple existing layers', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function draw() { background(0); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'dark background',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const threeLayer: Layer = {
        id: 'layer_2',
        type: 'three',
        code: 'const scene = new THREE.Scene();',
        config: {
          zIndex: 1,
          blendMode: 'normal',
          opacity: 0.8,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: '3d rotating cube',
          generator: 'ThreeGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer, threeLayer],
        targetDomain: 'shader',
      };

      const result = enhancer.enhance(context);

      expect(result.prompt).toMatch(/p5/i);
      expect(result.prompt).toMatch(/three/i);
      expect(result.context).toMatch(/p5/i);
      expect(result.context).toMatch(/three/i);
    });
  });

  describe('Context Extraction', () => {
    it('should extract context from p5 layer', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() { createCanvas(800, 600); }\nfunction draw() { circle(mouseX, mouseY, 50); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'interactive circles following mouse',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(p5Layer);

      expect(context).toMatch(/p5/i);
      expect(context).toContain('interactive circles following mouse');
      // Key elements extraction includes function setup, createCanvas, function draw, mouseX
      expect(context).toContain('mouseX');
    });

    it('should extract context from Tone.js layer', () => {
      const toneLayer: Layer = {
        id: 'layer_1',
        type: 'tone',
        code: 'const synth = new Tone.Synth().toDestination();\nsynth.triggerAttackRelease("C4", "8n");',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'simple synth melody',
          generator: 'ToneGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(toneLayer);

      expect(context).toMatch(/tone/i);
      expect(context).toContain('simple synth melody');
      expect(context).toContain('Synth');
    });

    it('should extract context from Three.js layer', () => {
      const threeLayer: Layer = {
        id: 'layer_1',
        type: 'three',
        code: 'const geometry = new THREE.BoxGeometry();\nconst material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'green cube scene',
          generator: 'ThreeGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(threeLayer);

      expect(context).toMatch(/three/i);
      expect(context).toContain('green cube scene');
      expect(context).toContain('BoxGeometry');
    });

    it('should extract context from shader layer', () => {
      const shaderLayer: Layer = {
        id: 'layer_1',
        type: 'shader',
        code: 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  vec2 uv = fragCoord/iResolution.xy;\n  fragColor = vec4(uv, 0.0, 1.0);\n}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'gradient shader',
          generator: 'ShaderGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(shaderLayer);

      expect(context).toContain('shader');
      expect(context).toContain('gradient shader');
      expect(context).toContain('mainImage');
    });

    it('should include exports in context extraction', () => {
      const layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}\nfunction draw() {}\nfunction getMousePos() { return { x: mouseX, y: mouseY }; }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'export mouse position',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(layer);

      expect(context).toContain('export');
    });
  });

  describe('Integration Instructions', () => {
    it('should generate P5 + Tone integration instructions', () => {
      const sourceDomains: DomainType[] = ['p5'];
      const instructions = enhancer.generateInstructions('tone', sourceDomains);

      expect(instructions).toContain('p5');
      expect(instructions).toContain('tone');
      expect(instructions.length).toBeGreaterThan(0);
    });

    it('should generate Three + Shader integration instructions', () => {
      const sourceDomains: DomainType[] = ['three'];
      const instructions = enhancer.generateInstructions('shader', sourceDomains);

      expect(instructions).toContain('three');
      expect(instructions).toContain('shader');
    });

    it('should generate P5 + Strudel integration instructions', () => {
      const sourceDomains: DomainType[] = ['p5'];
      const instructions = enhancer.generateInstructions('strudel', sourceDomains);

      expect(instructions).toContain('p5');
      expect(instructions).toContain('strudel');
    });

    it('should handle multiple source domains', () => {
      const sourceDomains: DomainType[] = ['p5', 'three'];
      const instructions = enhancer.generateInstructions('shader', sourceDomains);

      expect(instructions).toContain('p5');
      expect(instructions).toContain('three');
      expect(instructions).toContain('shader');
    });
  });

  describe('Domain Combinations', () => {
    it('should handle P5 + Tone combination', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function draw() { circle(mouseX, mouseY, 50); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'mouse-following circles',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'tone',
        integrationHints: ['The audio should react to the mouse position'],
      };

      const result = enhancer.enhance(context);

      expect(result.instructions).toContain('mouse');
      expect(result.instructions).toContain('audio');
    });

    it('should handle Three + Shader combination', () => {
      const threeLayer: Layer = {
        id: 'layer_1',
        type: 'three',
        code: 'const scene = new THREE.Scene();',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: '3d scene with objects',
          generator: 'ThreeGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [threeLayer],
        targetDomain: 'shader',
        integrationHints: ['Use the 3D scene as input texture'],
      };

      const result = enhancer.enhance(context);

      expect(result.instructions).toContain('3D');
      expect(result.instructions).toContain('texture');
    });

    it('should handle P5 + Strudel combination', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function draw() { background(0); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'visual animation',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'strudel',
        integrationHints: ['Sync the visual animation to the music pattern'],
      };

      const result = enhancer.enhance(context);

      expect(result.instructions).toContain('sync');
      expect(result.instructions).toContain('visual');
      expect(result.instructions).toContain('music');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty existing layers array', () => {
      const context: EnhancementContext = {
        existingLayers: [],
        targetDomain: 'p5',
      };

      const result = enhancer.enhance(context);

      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('instructions');
      expect(result.context).toContain('No existing layers');
    });

    it('should handle layer without metadata prompt', () => {
      const layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: '',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(layer);

      expect(context).toMatch(/p5/i);
    });

    it('should handle layer with very long code', () => {
      const longCode = 'function setup() {}\n'.repeat(100);
      const layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: longCode,
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'long code test',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context = enhancer.extractContext(layer);

      // Context should be truncated for very long code
      expect(context.length).toBeLessThan(longCode.length + 500);
    });

    it('should handle disabled layers', () => {
      const enabledLayer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'enabled layer',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const disabledLayer: Layer = {
        id: 'layer_2',
        type: 'tone',
        code: 'const synth = new Tone.Synth();',
        config: {
          zIndex: 1,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'disabled layer',
          generator: 'ToneGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: false,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [enabledLayer, disabledLayer],
        targetDomain: 'shader',
      };

      const result = enhancer.enhance(context);

      // Should include enabled layer
      expect(result.context).toContain('enabled layer');
      // Disabled layers should be noted but marked as disabled
      expect(result.context).toContain('disabled');
    });

    it('should handle all supported domain types', () => {
      const domains: DomainType[] = [
        'p5',
        'three',
        'shader',
        'tone',
        'strudel',
        'hydra',
        'ascii',
        'revideo',
        'html',
        'textgen',
      ];

      for (const domain of domains) {
        const layer: Layer = {
          id: `layer_${domain}`,
          type: domain,
          code: '// test code',
          config: {
            zIndex: 0,
            blendMode: 'normal',
            opacity: 1,
            position: { x: 0, y: 0 },
            scale: 1,
          },
          metadata: {
            prompt: `${domain} test`,
            generator: 'TestGenerator',
            model: 'test',
            generatedAt: new Date().toISOString(),
          },
          enabled: true,
          locked: false,
        };

        const context = enhancer.extractContext(layer);
        expect(context).toContain(domain);
      }
    });
  });

  describe('Integration Hints', () => {
    it('should include integration hints in instructions', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function draw() { circle(mouseX, mouseY, 50); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'mouse circles',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'tone',
        integrationHints: [
          'The audio should react to the mouse position from the p5 sketch',
          'Use smooth transitions',
        ],
      };

      const result = enhancer.enhance(context);

      expect(result.instructions).toContain('mouse position');
      expect(result.instructions).toContain('smooth transitions');
    });

    it('should handle empty integration hints', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'test',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'tone',
        integrationHints: [],
      };

      const result = enhancer.enhance(context);

      expect(result).toHaveProperty('instructions');
      expect(typeof result.instructions).toBe('string');
    });

    it('should handle undefined integration hints', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'test',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer],
        targetDomain: 'tone',
      };

      const result = enhancer.enhance(context);

      expect(result).toHaveProperty('instructions');
    });
  });

  describe('Prompt Formatting', () => {
    it('should format prompt with proper structure', () => {
      const layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() { createCanvas(800, 600); }',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'canvas setup',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [layer],
        targetDomain: 'tone',
      };

      const result = enhancer.enhance(context);

      // Should have clear section markers
      expect(result.prompt).toContain('---');
      expect(result.prompt).toMatch(/context/i);
      expect(result.prompt).toMatch(/target/i);
      expect(result.prompt).toMatch(/integration/i);
    });

    it('should include layer type summary in prompt', () => {
      const p5Layer: Layer = {
        id: 'layer_1',
        type: 'p5',
        code: 'function setup() {}',
        config: {
          zIndex: 0,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'visuals',
          generator: 'P5Generator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const toneLayer: Layer = {
        id: 'layer_2',
        type: 'tone',
        code: 'const synth = new Tone.Synth();',
        config: {
          zIndex: 1,
          blendMode: 'normal',
          opacity: 1,
          position: { x: 0, y: 0 },
          scale: 1,
          role: 'standalone',
          transparentBackground: false,
        },
        metadata: {
          prompt: 'audio',
          generator: 'ToneGenerator',
          model: 'qwen2.5-coder',
          generatedAt: new Date().toISOString(),
        },
        enabled: true,
        locked: false,
      };

      const context: EnhancementContext = {
        existingLayers: [p5Layer, toneLayer],
        targetDomain: 'shader',
      };

      const result = enhancer.enhance(context);

      expect(result.prompt).toMatch(/existing layers/i);
    });
  });
});
