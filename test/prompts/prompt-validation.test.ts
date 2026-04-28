import { describe, it, expect } from 'vitest';
/**
 * Prompt validation tests — verify all 39 prompts are properly registered
 * and meet quality standards.
 */
import { PromptLibrary } from '../../src/prompts/index.js';

// Expected prompt IDs across all categories
const EXPECTED_IDS = [
  // Generator prompts (8)
  'p5.generate',
  'p5.improve',
  'three.generate',
  'glsl.generate',
  'music.strudel',
  'music.p5-webaudio',
  'hydra.generate',
  'swarm.voting',

  // Collaboration roles (7)
  'collab.role.creator',
  'collab.role.visionary',
  'collab.role.technical-critic',
  'collab.role.artistic-critic',
  'collab.role.domain-expert',
  'collab.role.integrator',
  'collab.role.refiner',

  // Collaboration internal (4)
  'collab.synthesis',
  'collab.scoring',
  'collab.analysis',
  'collab.refine',

  // Collaboration generation (2)
  'collab.generation',
  'collab.generation.alternative',

  // Evaluation (1)
  'eval.heuristic-persona',

  // Swarm personas (5)
  'swarm.persona.kai',
  'swarm.persona.nova',
  'swarm.persona.rex',
  'swarm.persona.sam',
  'swarm.persona.max',

  // Compost prompts (7)
  'compost.extract-code',
  'compost.extract-image',
  'compost.collision-merge',
  'compost.offspring-scoring',
  'compost.digest-narrative',
  'compost.seed-extraction',
  'compost.synthesis',

  // Aesthetic / Audio / Chat (3)
  'aesthetic.constraints',
  'audio.voice-to-visual',
  'chat.assistant',
];

describe('Prompt Library Validation', () => {
  describe('registration completeness', () => {
    it('should have exactly 37 prompts registered', () => {
      const all = PromptLibrary.list();
      expect(all.length).toBe(EXPECTED_IDS.length);
    });

    it('should have all expected prompt IDs registered', () => {
      for (const id of EXPECTED_IDS) {
        expect(PromptLibrary.get(id)).not.toBeNull();
      }
    });

    it('should not have any unexpected prompt IDs', () => {
      const all = PromptLibrary.list();
      const registeredIds = all.map(t => t.id);
      for (const id of registeredIds) {
        expect(EXPECTED_IDS).toContain(id);
      }
    });
  });

  describe('prompt quality', () => {
    it('every prompt should have a non-empty systemPrompt', () => {
      const all = PromptLibrary.list();
      for (const template of all) {
        expect(template.systemPrompt.length).toBeGreaterThan(0);
      }
    });

    it('every prompt should have a version', () => {
      const all = PromptLibrary.list();
      for (const template of all) {

        expect(template.version?.length).toBeGreaterThan(0);
      }
    });

    it('every prompt should have a category', () => {
      const all = PromptLibrary.list();
      for (const template of all) {

        expect(template.category?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('versioning and metadata', () => {
    it('every prompt should have created and updated dates', () => {
      const all = PromptLibrary.list();
      for (const template of all) {
        expect(template.created).not.toBeNull();
        expect(template.updated).not.toBeNull();
        expect(template.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(template.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('every prompt should have tags', () => {
      const all = PromptLibrary.list();
      for (const template of all) {

        expect(template.tags!.length).toBeGreaterThan(0);
      }
    });

    it('all prompts should use an allowed semver family', () => {
      const all = PromptLibrary.list();
      for (const template of all) {
        expect(template.version).toMatch(/^(1\.0\.0|2\.0\.0|2\.1\.\d+|3\.0\.0)$/);
      }
    });
  });

  describe('stale name checks', () => {
    it('no prompt should contain "Atelier"', () => {
      const all = PromptLibrary.list();
      for (const template of all) {
        expect(template.systemPrompt).not.toContain('Atelier');
        if (template.userPromptTemplate) {
          expect(template.userPromptTemplate).not.toContain('Atelier');
        }
      }
    });

    it('no prompt should reference stale Three.js CDN version 0.160.0', () => {
      const threePrompt = PromptLibrary.get('three.generate');
      expect(threePrompt?.systemPrompt).not.toContain('0.160.0');
    });
  });

  describe('domain coverage', () => {
    it('generator prompts should cover all expected domains', () => {
      const categories = PromptLibrary.stats().byCategory;
      expect(categories.generator).toBeGreaterThanOrEqual(4);
      expect(categories.p5).toBeGreaterThanOrEqual(2);
    });

    it('all collaboration roles should be registered', () => {
      const collabRoles = PromptLibrary.listByCategory('collab');
      const roleIds = collabRoles
        .filter(t => t.id.startsWith('collab.role.'))
        .map(t => t.id);
      expect(roleIds).toContain('collab.role.creator');
      expect(roleIds).toContain('collab.role.visionary');
      expect(roleIds).toContain('collab.role.technical-critic');
      expect(roleIds).toContain('collab.role.artistic-critic');
      expect(roleIds).toContain('collab.role.domain-expert');
      expect(roleIds).toContain('collab.role.integrator');
      expect(roleIds).toContain('collab.role.refiner');
    });

    it('all swarm personas should be registered', () => {
      const swarmPrompts = PromptLibrary.listByCategory('swarm');
      const personaIds = swarmPrompts
        .filter(t => t.id.startsWith('swarm.persona.'))
        .map(t => t.id);
      expect(personaIds).toContain('swarm.persona.kai');
      expect(personaIds).toContain('swarm.persona.nova');
      expect(personaIds).toContain('swarm.persona.rex');
      expect(personaIds).toContain('swarm.persona.sam');
      expect(personaIds).toContain('swarm.persona.max');
    });
  });

  describe('library utilities', () => {
    it('stats() should return correct summary', () => {
      const stats = PromptLibrary.stats();
      expect(stats.total).toBe(EXPECTED_IDS.length);
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0);
      expect(stats.ids.length).toBe(EXPECTED_IDS.length);
    });

    it('validate() should report no issues for all prompts', () => {
      const results = PromptLibrary.validate();
      for (const result of results) {
        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      }
    });

    it('exportAll() should return all prompts', () => {
      const exported = PromptLibrary.exportAll();
      expect(Object.keys(exported).length).toBe(EXPECTED_IDS.length);
      for (const id of EXPECTED_IDS) {

        expect(exported[id]?.systemPrompt.length).toBeGreaterThan(0);
      }
    });

    it('render() should interpolate variables correctly', () => {
      const result = PromptLibrary.render('p5.generate', { prompt: 'flowing particles' });
      expect(result.system).toContain('senior creative technologist');
      expect(result.user).toContain('flowing particles');
    });
  });
});
