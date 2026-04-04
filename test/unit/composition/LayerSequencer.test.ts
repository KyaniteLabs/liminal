/**
 * LayerSequencer Tests - TDD Approach
 *
 * Tests for sequential layer generation with context passing.
 * Following RED-GREEN-REFACTOR TDD cycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LayerSequencer,
  LayerSequencerOptions,
  SequencerResult,
} from '../../../src/composition/LayerSequencer.js';
import { TierBasedGenerator } from '../../../src/generators/TierBasedGenerator.js';
import { DomainType, Layer } from '../../../src/composition/types.js';
import { LLMClient, LLMConfig } from '../../../src/llm/LLMClient.js';

// Mock generator for testing
class MockGenerator extends TierBasedGenerator {
  private mockCode: string;
  private shouldFail: boolean;
  private delay: number;

  constructor(
    domain: string,
    mockCode: string = `// Mock ${domain} code`,
    shouldFail: boolean = false,
    delay: number = 0
  ) {
    // Pass a minimal config to avoid LLM setup
    super(domain, { model: 'mock-model', provider: 'mock' } as LLMConfig);
    this.mockCode = mockCode;
    this.shouldFail = shouldFail;
    this.delay = delay;
  }

  async generateLayer(prompt: string): Promise<Layer> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    if (this.shouldFail) {
      throw new Error(`Mock ${this.domain} generation failed`);
    }

    return {
      id: `layer_${this.domain}_${Date.now()}`,
      type: this.domain as DomainType,
      code: this.mockCode,
      config: {
        zIndex: 0,
        blendMode: 'normal',
        opacity: 1.0,
        position: { x: 0, y: 0 },
        scale: 1.0,
      },
      metadata: {
        prompt,
        generator: 'MockGenerator',
        model: 'mock-model',
        generatedAt: new Date().toISOString(),
      },
      enabled: true,
      locked: false,
    };
  }
}

describe('LayerSequencer', () => {
  let sequencer: LayerSequencer;

  beforeEach(() => {
    sequencer = new LayerSequencer();
  });

  describe('generateLayers - Sequential Generation', () => {
    it('should generate layers in the specified order', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '// P5 background')],
        ['three', new MockGenerator('three', '// Three.js overlay')],
      ]);

      const order: string[] = [];
      const result = await sequencer.generateLayers(
        'Create a scene',
        ['p5', 'three'],
        {
          generators,
          onProgress: (completed, total) => {
            order.push(`progress:${completed}/${total}`);
          },
        }
      );

      expect(result.layers).toHaveLength(2);
      expect(result.layers[0].type).toBe('p5');
      expect(result.layers[1].type).toBe('three');
      expect(result.errors).toHaveLength(0);
      expect(order).toEqual(['progress:1/2', 'progress:2/2']);
    });

    it('should handle empty domains array', async () => {
      const result = await sequencer.generateLayers('test', [], {
        generators: new Map(),
      });

      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip domains without registered generators', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5')],
      ]);

      const result = await sequencer.generateLayers(
        'test',
        ['p5', 'three'], // 'three' has no generator
        { generators }
      );

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].type).toBe('p5');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].domain).toBe('three');
      expect(result.errors[0].error.message).toContain('No generator registered');
    });
  });

  describe('generateLayers - Context Passing', () => {
    it('should pass context from layer N to layer N+1', async () => {
      const capturedPrompts: string[] = [];

      class ContextCapturingGenerator extends MockGenerator {
        async generateLayer(prompt: string): Promise<Layer> {
          capturedPrompts.push(prompt);
          return super.generateLayer(prompt);
        }
      }

      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new ContextCapturingGenerator('p5', '// P5 code')],
        ['three', new ContextCapturingGenerator('three', '// Three code')],
      ]);

      await sequencer.generateLayers('Base prompt', ['p5', 'three'], {
        generators,
      });

      // First layer gets base prompt
      expect(capturedPrompts[0]).toBe('Base prompt');

      // Second layer gets enhanced prompt with context from first
      expect(capturedPrompts[1]).toContain('Base prompt');
      expect(capturedPrompts[1]).toContain('p5');
      expect(capturedPrompts[1]).toContain('// P5 code');
    });

    it('should include layer metadata in context enhancement', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', 'createCanvas(800, 600)')],
        ['tone', new MockGenerator('tone', 'new Synth()')],
      ]);

      const result = await sequencer.generateLayers('Audio visualization', ['p5', 'tone'], {
        generators,
      });

      expect(result.layers).toHaveLength(2);
      // Second layer prompt should reference first layer's code
      expect(result.layers[1].metadata.prompt).toContain('p5');
      expect(result.layers[1].metadata.prompt).toContain('createCanvas');
    });

    it('should accumulate context across multiple layers', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '// Layer 1')],
        ['three', new MockGenerator('three', '// Layer 2')],
        ['tone', new MockGenerator('tone', '// Layer 3')],
      ]);

      const result = await sequencer.generateLayers('Base', ['p5', 'three', 'tone'], {
        generators,
      });

      expect(result.layers).toHaveLength(3);
      // Third layer should have context from both previous layers
      const thirdPrompt = result.layers[2].metadata.prompt;
      expect(thirdPrompt).toContain('p5');
      expect(thirdPrompt).toContain('three');
    });
  });

  describe('generateParallel - Parallel Generation', () => {
    it('should generate independent domains in parallel', async () => {
      const startTime = Date.now();
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '// P5', false, 50)],
        ['tone', new MockGenerator('tone', '// Tone', false, 50)],
      ]);

      const result = await sequencer.generateParallel(
        [
          { domain: 'p5', prompt: 'Visual' },
          { domain: 'tone', prompt: 'Audio' },
        ],
        { generators }
      );

      const duration = Date.now() - startTime;

      expect(result.layers).toHaveLength(2);
      // Parallel execution should be faster than sequential (100ms vs ~50ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle mix of success and failure in parallel generation', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '// P5')],
        ['three', new MockGenerator('three', '// Three', true)], // Will fail
      ]);

      const result = await sequencer.generateParallel(
        [
          { domain: 'p5', prompt: 'Visual' },
          { domain: 'three', prompt: '3D' },
        ],
        { generators }
      );

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].type).toBe('p5');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].domain).toBe('three');
    });

    it('should call progress callback for parallel generation', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5')],
        ['tone', new MockGenerator('tone')],
      ]);

      const progressCalls: number[] = [];
      await sequencer.generateParallel(
        [
          { domain: 'p5', prompt: 'Visual' },
          { domain: 'tone', prompt: 'Audio' },
        ],
        {
          generators,
          onProgress: (completed) => progressCalls.push(completed),
        }
      );

      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(progressCalls[progressCalls.length - 1]).toBe(2);
    });
  });

  describe('Error Handling and Rollback', () => {
    it('should rollback all layers on failure when configured', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5')],
        ['three', new MockGenerator('three', '', true)], // Will fail
      ]);

      const result = await sequencer.generateLayers(
        'test',
        ['p5', 'three'],
        {
          generators,
          rollbackOnError: true,
        }
      );

      // All layers should be rolled back on error
      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should keep successful layers when rollback is disabled', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5')],
        ['three', new MockGenerator('three', '', true)], // Will fail
      ]);

      const result = await sequencer.generateLayers(
        'test',
        ['p5', 'three'],
        {
          generators,
          rollbackOnError: false,
        }
      );

      // First layer should be kept
      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].type).toBe('p5');
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when continueOnError is false', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '', true)], // Will fail
        ['three', new MockGenerator('three')], // Should not be called
      ]);

      const threeSpy = vi.spyOn(generators.get('three')!, 'generateLayer');

      const result = await sequencer.generateLayers(
        'test',
        ['p5', 'three'],
        {
          generators,
          continueOnError: false,
        }
      );

      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(threeSpy).not.toHaveBeenCalled();
    });

    it('should continue with remaining layers when continueOnError is true', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '', true)], // Will fail
        ['three', new MockGenerator('three')], // Should still be called
      ]);

      const result = await sequencer.generateLayers(
        'test',
        ['p5', 'three'],
        {
          generators,
          continueOnError: true,
        }
      );

      expect(result.layers).toHaveLength(1);
      expect(result.layers[0].type).toBe('three');
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Optimal Generation Order', () => {
    it('should prioritize base layers first', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['tone', new MockGenerator('tone', '// Audio')],
        ['p5', new MockGenerator('p5', '// Visual')],
        ['three', new MockGenerator('three', '// 3D')],
      ]);

      // Request in non-optimal order
      const result = await sequencer.generateLayers(
        'test',
        ['tone', 'three', 'p5'],
        {
          generators,
          optimizeOrder: true,
        }
      );

      // Visual layers should come before audio
      const types = result.layers.map((l) => l.type);
      const p5Index = types.indexOf('p5');
      const threeIndex = types.indexOf('three');
      const toneIndex = types.indexOf('tone');

      // Visual layers should be before audio
      expect(p5Index).toBeLessThan(toneIndex);
      expect(threeIndex).toBeLessThan(toneIndex);
    });

    it('should respect original order when optimizeOrder is false', async () => {
      const order: string[] = [];
      const generators = new Map<DomainType, TierBasedGenerator>([
        [
          'tone',
          new (class extends MockGenerator {
            async generateLayer(prompt: string) {
              order.push('tone');
              return super.generateLayer(prompt);
            }
          })('tone'),
        ],
        [
          'p5',
          new (class extends MockGenerator {
            async generateLayer(prompt: string) {
              order.push('p5');
              return super.generateLayer(prompt);
            }
          })('p5'),
        ],
      ]);

      await sequencer.generateLayers('test', ['tone', 'p5'], {
        generators,
        optimizeOrder: false,
      });

      expect(order).toEqual(['tone', 'p5']);
    });
  });

  describe('Context Enhancement', () => {
    it('should enhance prompts with previous layer context', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', 'background(255, 0, 0)')],
        ['three', new MockGenerator('three', 'new Mesh()')],
      ]);

      const result = await sequencer.generateLayers('Scene', ['p5', 'three'], {
        generators,
      });

      // Second layer should have enhanced prompt
      const enhancedPrompt = result.layers[1].metadata.prompt;
      expect(enhancedPrompt).toContain('background(255, 0, 0)');
    });

    it('should include domain information in context', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', 'ellipse(50, 50, 80, 80)')],
      ]);

      const result = await sequencer.generateLayers('Draw', ['p5'], {
        generators,
      });

      expect(result.layers[0].type).toBe('p5');
      expect(result.layers[0].code).toContain('ellipse');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single domain generation', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5')],
      ]);

      const result = await sequencer.generateLayers('test', ['p5'], { generators });

      expect(result.layers).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle all domains failing', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '', true)],
        ['three', new MockGenerator('three', '', true)],
      ]);

      const result = await sequencer.generateLayers('test', ['p5', 'three'], {
        generators,
        continueOnError: true,
      });

      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });

    it('should handle generator returning invalid layer', async () => {
      class InvalidGenerator extends TierBasedGenerator {
        async generateLayer(): Promise<Layer> {
          // Return invalid layer (missing required fields)
          return {
            id: 'invalid',
            type: 'p5' as DomainType,
            code: '',
          } as Layer;
        }
      }

      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new InvalidGenerator('p5')],
      ]);

      const result = await sequencer.generateLayers('test', ['p5'], { generators });

      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle aborted signal', async () => {
      const generators = new Map<DomainType, TierBasedGenerator>([
        ['p5', new MockGenerator('p5', '// code')],
      ]);

      const controller = new AbortController();
      
      // Abort before starting
      controller.abort();
      
      const result = await sequencer.generateLayers('test', ['p5'], {
        generators,
        signal: controller.signal,
      });

      expect(result.layers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error.name).toBe('AbortError');
    });
  });
});
