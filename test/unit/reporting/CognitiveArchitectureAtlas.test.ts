import { describe, expect, it } from 'vitest';
import { CognitiveArchitectureAtlas } from '../../../src/reporting/CognitiveArchitectureAtlas.js';

describe('CognitiveArchitectureAtlas', () => {
  it('keeps the full creative body in scope instead of shrinking to a proof wedge', () => {
    const atlas = new CognitiveArchitectureAtlas().build();
    const domains = atlas.domains.map(domain => domain.id);
    expect(domains).toEqual(['svg', 'p5', 'glsl', 'hydra', 'three', 'tone', 'strudel', 'revideo', 'html', 'ascii', 'kinetic', 'textgen']);
  });

  it('names the cognitive organs that make Liminal a learning-inspired organism', () => {
    const atlas = new CognitiveArchitectureAtlas().build();
    expect(atlas.organs.map(organ => organ.id)).toEqual(['perception', 'memory', 'compost', 'dreaming', 'intuition', 'cortex', 'garden-evolution', 'immune-truth', 'model-assimilation']);
  });

  it('formats the creative, self-improvement, and model-assimilation loops for CLI receipts', () => {
    const formatter = new CognitiveArchitectureAtlas();
    const output = formatter.format(formatter.build());
    expect(output).toContain('Liminal Cognitive Architecture');
    expect(output).toContain('Creative Loop');
    expect(output).toContain('Self-Improvement Loop');
    expect(output).toContain('Model Assimilation Loop');
    expect(output).toContain('SVG');
    expect(output).toContain('Tone.js');
    expect(output).toContain('Strudel');
    expect(output).toContain('Revideo');
  });
});
