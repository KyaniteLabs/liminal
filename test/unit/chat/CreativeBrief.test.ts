import { describe, it, expect } from 'vitest';
import { buildCreativeBrief } from '../../../dist/chat/CreativeBrief.js';
import type { CreativeBrief, InterviewAnswers, Domain, Technique } from '../../../dist/chat/types.js';

describe('CreativeBrief', () => {
  describe('buildCreativeBrief', () => {
    it('should build brief with all answers provided', () => {
      const answers: InterviewAnswers = {
        intent: 'Create a flowing particle system',
        context: 'Exploring emergent behavior',
        mood: 'ethereal',
        constraints: ['max 100 particles', 'use perlin noise'],
        references: [
          { type: 'past-work', id: 'work-1', description: 'Previous particle study' }
        ],
        preferredDomain: 'p5'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.intent).toBe('Create a flowing particle system');
      expect(brief.context).toBe('Exploring emergent behavior');
      expect(brief.mood).toBe('ethereal');
      expect(brief.constraints).toEqual(['max 100 particles', 'use perlin noise']);
      expect(brief.references).toEqual([
        { type: 'past-work', id: 'work-1', description: 'Previous particle study' }
      ]);
      expect(brief.domain).toBe('p5');
    });

    it('should build brief with minimal answers (only intent)', () => {
      const answers: InterviewAnswers = {
        intent: 'Simple sketch'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.intent).toBe('Simple sketch');
      expect(brief.context).toBe('');
      expect(brief.mood).toBe('');
      expect(brief.constraints).toEqual([]);
      expect(brief.references).toEqual([]);
      expect(brief.domain).toBe('p5');
      expect(brief.complexity).toBe('simple');
    });

    it('should build brief with no answers (defaults)', () => {
      const answers: InterviewAnswers = {};

      const brief = buildCreativeBrief(answers);

      expect(brief.intent).toBe('');
      expect(brief.context).toBe('');
      expect(brief.mood).toBe('');
      expect(brief.constraints).toEqual([]);
      expect(brief.references).toEqual([]);
      expect(brief.domain).toBe('p5');
      expect(brief.complexity).toBe('simple');
      expect(brief.techniques).toEqual([]);
    });

    it('should infer techniques from keywords - particle systems', () => {
      const answers: InterviewAnswers = {
        intent: 'Create a particle system'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.techniques).toHaveLength(1);
      expect(brief.techniques[0].name.toLowerCase()).toContain('particle');
      expect(brief.techniques[0].keywords).toContain('particle');
    });

    it('should infer techniques from keywords - flow fields', () => {
      const answers: InterviewAnswers = {
        intent: 'Explore flow fields'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.techniques).toHaveLength(1);
      expect(brief.techniques[0].name.toLowerCase()).toContain('flow');
      expect(brief.techniques[0].keywords).toContain('flow');
    });

    it('should infer techniques from keywords - perlin noise', () => {
      const answers: InterviewAnswers = {
        intent: 'Use noise for textures'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.techniques).toHaveLength(1);
      expect(brief.techniques[0].keywords).toContain('noise');
    });

    it('should infer techniques from keywords - cellular automata', () => {
      const answers: InterviewAnswers = {
        intent: 'Build cellular automata'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.techniques).toHaveLength(1);
      expect(brief.techniques[0].keywords).toContain('cellular');
    });

    it('should infer multiple techniques from multiple keywords', () => {
      const answers: InterviewAnswers = {
        intent: 'Create a flowing particle system with noise'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.techniques.length).toBeGreaterThanOrEqual(2);
      const techniqueNames = brief.techniques.map(t => t.name.toLowerCase());
      expect(techniqueNames.some(n => n.includes('particle'))).toBe(true);
      expect(techniqueNames.some(n => n.includes('flow') || n.includes('noise'))).toBe(true);
    });

    it('should infer complexity - simple (short intent, few constraints)', () => {
      const answers: InterviewAnswers = {
        intent: 'Simple sketch'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.complexity).toBe('simple');
    });

    it('should infer complexity - complex (long intent)', () => {
      const answers: InterviewAnswers = {
        intent: 'Create a complex interactive particle system with multiple layers of flow fields and cellular automata that respond to audio input'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.complexity).toBe('complex');
    });

    it('should infer complexity - complex (many constraints)', () => {
      const answers: InterviewAnswers = {
        intent: 'Moderate sketch',
        constraints: ['constraint 1', 'constraint 2', 'constraint 3']
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.complexity).toBe('complex');
    });

    it('should infer complexity - medium (middle ground)', () => {
      const answers: InterviewAnswers = {
        intent: 'A moderately complex sketch with some details',
        constraints: ['one constraint']
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.complexity).toBe('medium');
    });

    it('should use preferred domain when provided', () => {
      const answers: InterviewAnswers = {
        intent: 'Some sketch',
        preferredDomain: 'shader'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.domain).toBe('shader');
    });

    it('should default to p5 domain when not provided', () => {
      const answers: InterviewAnswers = {
        intent: 'Some sketch'
      };

      const brief = buildCreativeBrief(answers);

      expect(brief.domain).toBe('p5');
    });
  });
});
