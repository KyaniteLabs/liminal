import { describe, it, expect } from 'vitest';
import { buildCreativeBrief } from '../../../src/chat/CreativeBrief.js';
import type { InterviewAnswers } from '../../../src/chat/CreativeBrief.js';

describe('CreativeBrief', () => {
  describe('buildCreativeBrief', () => {
    it('returns defaults for empty answers', () => {
      const brief = buildCreativeBrief({});
      expect(brief.intent).toBe('');
      expect(brief.context).toBe('');
      expect(brief.mood).toBe('');
      expect(brief.constraints).toEqual([]);
      expect(brief.references).toEqual([]);
      expect(brief.domain).toBe('p5');
      expect(brief.techniques).toEqual([]);
      expect(brief.complexity).toBe('simple');
    });

    it('uses provided answers directly', () => {
      const answers: InterviewAnswers = {
        intent: 'create a flowing particle system',
        context: 'for a gallery exhibition',
        mood: 'contemplative',
        constraints: ['no audio', 'dark background'],
        references: [{ name: 'Refik Anadol', url: 'https://example.com' }],
        preferredDomain: 'hydra',
      };
      const brief = buildCreativeBrief(answers);
      expect(brief.intent).toBe('create a flowing particle system');
      expect(brief.context).toBe('for a gallery exhibition');
      expect(brief.mood).toBe('contemplative');
      expect(brief.constraints).toEqual(['no audio', 'dark background']);
      expect(brief.references).toEqual([{ name: 'Refik Anadol', url: 'https://example.com' }]);
      expect(brief.domain).toBe('hydra');
    });

    it('infers particle technique from intent', () => {
      const brief = buildCreativeBrief({ intent: 'a system of particles floating in space' });
      expect(brief.techniques.length).toBeGreaterThan(0);
      expect(brief.techniques[0].name).toBe('Particle Systems');
      expect(brief.techniques[0].domain).toBe('p5');
    });

    it('infers flow field technique from intent', () => {
      const brief = buildCreativeBrief({ intent: 'flowing colors across the screen' });
      expect(brief.techniques.some(t => t.name === 'Flow Fields')).toBe(true);
    });

    it('infers noise technique from intent', () => {
      const brief = buildCreativeBrief({ intent: 'use noise for organic movement' });
      expect(brief.techniques.some(t => t.name === 'Perlin Noise')).toBe(true);
    });

    it('infers cellular automata technique from intent', () => {
      const brief = buildCreativeBrief({ intent: 'a cellular grid simulation' });
      expect(brief.techniques.some(t => t.name === 'Cellular Automata')).toBe(true);
    });

    it('infers multiple techniques when keywords match', () => {
      const brief = buildCreativeBrief({ intent: 'flow fields with particle noise' });
      expect(brief.techniques.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty techniques when no keywords match', () => {
      const brief = buildCreativeBrief({ intent: 'a simple gradient' });
      expect(brief.techniques).toEqual([]);
    });

    it('classifies as simple for short intent and few constraints', () => {
      const brief = buildCreativeBrief({ intent: 'hi', constraints: [] });
      expect(brief.complexity).toBe('simple');
    });

    it('classifies as complex for long intent', () => {
      const brief = buildCreativeBrief({ intent: 'a'.repeat(51), constraints: [] });
      expect(brief.complexity).toBe('complex');
    });

    it('classifies as complex for many constraints', () => {
      const brief = buildCreativeBrief({ intent: 'short', constraints: ['a', 'b', 'c'] });
      expect(brief.complexity).toBe('complex');
    });

    it('classifies as medium for moderate intent and constraints', () => {
      const brief = buildCreativeBrief({ intent: 'a'.repeat(30), constraints: ['one'] });
      expect(brief.complexity).toBe('medium');
    });

    it('sets swarm and archive learning to undefined', () => {
      const brief = buildCreativeBrief({ intent: 'test' });
      expect(brief.useSwarm).toBeUndefined();
      expect(brief.useArchiveLearning).toBeUndefined();
      expect(brief.useCompostSeeds).toBeUndefined();
    });
  });
});
