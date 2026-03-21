/**
 * Compost prompt templates test — verify PromptLibrary registration and rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import PromptLibrary and ensure compost prompts are registered
import { PromptLibrary } from '../../../src/prompts/PromptLibrary.js';
import '../../../src/prompts/compost.js';

describe('compost prompt templates', () => {
  it('compost.extract-code is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.extract-code', {
      filename: 'sketch.js',
      extension: 'js',
      content: 'function setup() { createCanvas(400, 400); }',
    });

    expect(system).toContain('code analyst');
    expect(user).toContain('sketch.js');
    expect(user).toContain('(js)');
    expect(user).toContain('createCanvas');
  });

  it('compost.extract-image is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.extract-image', {
      filename: 'photo.png',
    });

    expect(system).toContain('image');
    expect(user).toContain('photo.png');
  });

  it('compost.collision-merge is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.collision-merge', {
      domainA: 'visual',
      contentA: 'Particle field',
      domainB: 'audio',
      contentB: 'Resonance pattern',
    });

    expect(system).toContain('collision engine');
    expect(user).toContain('visual');
    expect(user).toContain('audio');
    expect(user).toContain('Particle field');
    expect(user).toContain('Resonance pattern');
  });

  it('compost.offspring-scoring is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.offspring-scoring', {
      domain: 'code',
      layer: 'semantic',
      tags: 'recursion, tree',
      content: 'function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }',
    });

    expect(system).toContain('quality evaluator');
    expect(user).toContain('code');
    expect(user).toContain('fib');
  });

  it('compost.synthesis is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.synthesis', {
      creatorOutput: 'Practical implementation',
      visionaryOutput: 'Creative vision',
      prompt: 'Build something cool',
    });

    expect(system).toContain('synthesizer');
    expect(user).toContain('Practical implementation');
    expect(user).toContain('Creative vision');
    expect(user).toContain('Build something cool');
  });

  it('compost.digest-narrative is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.digest-narrative', {
      stats: '50 files, 100 fragments',
      seeds: '5 seeds promoted',
      highlights: 'Great collision between music and code',
    });

    expect(system).toContain('digest writer');
    expect(user).toContain('50 files');
  });

  it('compost.seed-extraction is registered and renders', () => {
    const { system, user } = PromptLibrary.render('compost.seed-extraction', {
      content: 'A shimmering field of particles that respond to audio',
    });

    expect(system).toContain('seed extractor');
    expect(user).toContain('shimmering field');
  });
});
