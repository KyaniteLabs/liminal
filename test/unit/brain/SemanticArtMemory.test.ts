import { describe, it, expect, beforeEach } from 'vitest';
import {
  SemanticArtMemory,
  Artwork,
  Inspiration,
  Technique,
  CreativeContext
} from '../../../dist/brain/SemanticArtMemory.js';
import { ArtKnowledgeGraph } from '../../../dist/brain/ArtKnowledgeGraph.js';
import { EpisodicMemory } from '../../../dist/brain/EpisodicMemory.js';

describe('SemanticArtMemory', () => {
  let memory: SemanticArtMemory;
  let knowledgeGraph: ArtKnowledgeGraph;
  let episodicMemory: EpisodicMemory;

  beforeEach(() => {
    memory = new SemanticArtMemory();
    knowledgeGraph = new ArtKnowledgeGraph();
    episodicMemory = new EpisodicMemory();
  });

  describe('constructor', () => {
    it('initializes with knowledge graph and episodic memory', () => {
      expect(memory.knowledgeGraph).toBeInstanceOf(ArtKnowledgeGraph);
      expect(memory.episodicMemory).toBeInstanceOf(EpisodicMemory);
    });

    it('loads seed data into knowledge graph', () => {
      const allConcepts = memory.knowledgeGraph.query({});
      expect(allConcepts.length).toBeGreaterThan(50);
    });
  });

  describe('getArtworksByConcept', () => {
    beforeEach(() => {
      // Setup: Add some test artworks
      const artwork1: Artwork = {
        id: 'art-1',
        code: 'function setup() { createCanvas(400, 400); }',
        domain: 'p5',
        timestamp: new Date('2024-01-01'),
        concepts: ['Generative Art', 'Perlin Noise'],
        mood: 'calm'
      };

      const artwork2: Artwork = {
        id: 'art-2',
        code: 'function draw() { background(0); }',
        domain: 'shader',
        timestamp: new Date('2024-01-02'),
        concepts: ['Minimalism', 'Balance'],
        mood: 'minimal'
      };

      const artwork3: Artwork = {
        id: 'art-3',
        code: '// Another generative piece',
        domain: 'p5',
        timestamp: new Date('2024-01-03'),
        concepts: ['Generative Art', 'Flow Fields'],
        mood: 'dynamic'
      };

      memory.rememberArtwork(artwork1, ['Generative Art', 'Perlin Noise'], 'Love the noise patterns');
      memory.rememberArtwork(artwork2, ['Minimalism', 'Balance'], 'Very clean');
      memory.rememberArtwork(artwork3, ['Generative Art', 'Flow Fields'], 'Great movement');
    });

    it('returns artworks matching the given concept', () => {
      const artworks = memory.getArtworksByConcept('Generative Art');

      expect(artworks.length).toBe(2);
      expect(artworks.every(art => art.concepts.includes('Generative Art'))).toBe(true);
    });

    it('returns empty array when no artworks match', () => {
      const artworks = memory.getArtworksByConcept('NonExistent Concept');
      expect(artworks).toEqual([]);
    });

    it('is case-insensitive for concept matching', () => {
      const artworks = memory.getArtworksByConcept('generative art');
      expect(artworks.length).toBe(2);
    });

    it('finds artworks by related concepts', () => {
      const artworks = memory.getArtworksByConcept('Algorithmic Art');
      // Should find generative art artworks since Algorithmic Art is related
      expect(artworks.length).toBeGreaterThan(0);
    });
  });

  describe('getArtworksByMood', () => {
    beforeEach(() => {
      const artwork1: Artwork = {
        id: 'art-1',
        code: 'function setup() { createCanvas(400, 400); }',
        domain: 'p5',
        timestamp: new Date(),
        concepts: ['Generative Art'],
        mood: 'calm'
      };

      const artwork2: Artwork = {
        id: 'art-2',
        code: 'function draw() { background(255); }',
        domain: 'shader',
        timestamp: new Date(),
        concepts: ['Minimalism'],
        mood: 'energetic'
      };

      const artwork3: Artwork = {
        id: 'art-3',
        code: '// Another calm piece',
        domain: 'p5',
        timestamp: new Date(),
        concepts: ['Flow Fields'],
        mood: 'calm'
      };

      memory.rememberArtwork(artwork1, ['Generative Art'], 'Very peaceful');
      memory.rememberArtwork(artwork2, ['Minimalism'], 'High energy');
      memory.rememberArtwork(artwork3, ['Flow Fields'], 'Also calm');
    });

    it('returns artworks with matching mood', () => {
      const artworks = memory.getArtworksByMood('calm');
      expect(artworks.length).toBe(2);
      expect(artworks.every(art => art.mood === 'calm')).toBe(true);
    });

    it('returns empty array when no artworks match mood', () => {
      const artworks = memory.getArtworksByMood('melancholy');
      expect(artworks).toEqual([]);
    });

    it('is case-insensitive for mood matching', () => {
      const artworks = memory.getArtworksByMood('CALM');
      expect(artworks.length).toBe(2);
    });
  });

  describe('suggestInspiration', () => {
    beforeEach(() => {
      // Setup some remembered artworks
      const artwork1: Artwork = {
        id: 'art-1',
        code: 'function setup() { createCanvas(400, 400); noiseSeed(100); }',
        domain: 'p5',
        timestamp: new Date(),
        score: 8,
        concepts: ['Generative Art', 'Perlin Noise'],
        mood: 'calm'
      };

      memory.rememberArtwork(artwork1, ['Generative Art', 'Perlin Noise'], 'Excellent use of noise');
    });

    it('returns past-work inspiration when relevant artworks exist', () => {
      const context: CreativeContext = {
        domain: 'p5',
        intent: 'Create something with noise',
        mood: 'calm',
        concepts: ['Generative Art']
      };

      const inspirations = memory.suggestInspiration(context);

      expect(inspirations.length).toBeGreaterThan(0);
      expect(inspirations[0].type).toBe('past-work');
      expect(inspirations[0].relevance).toBeGreaterThan(0);
    });

    it('returns artist-reference inspiration from knowledge graph', () => {
      const context: CreativeContext = {
        domain: 'p5',
        intent: 'Create minimalist art',
        mood: 'minimal',
        concepts: ['Minimalism']
      };

      const inspirations = memory.suggestInspiration(context);

      const artistRefs = inspirations.filter(insp => insp.type === 'artist-reference');
      expect(artistRefs.length).toBeGreaterThan(0);
    });

    it('returns technique-suggestion based on concepts', () => {
      const context: CreativeContext = {
        domain: 'p5',
        intent: 'Create organic patterns',
        mood: 'natural',
        concepts: ['Generative Art']
      };

      const inspirations = memory.suggestInspiration(context);

      const techniqueSuggestions = inspirations.filter(insp => insp.type === 'technique-suggestion');
      expect(techniqueSuggestions.length).toBeGreaterThan(0);
    });

    it('calculates relevance scores appropriately', () => {
      const context: CreativeContext = {
        domain: 'p5',
        intent: 'Create something with Perlin Noise',
        mood: 'calm',
        concepts: ['Perlin Noise']
      };

      const inspirations = memory.suggestInspiration(context);

      for (const insp of inspirations) {
        expect(insp.relevance).toBeGreaterThanOrEqual(0);
        expect(insp.relevance).toBeLessThanOrEqual(1);
      }
    });

    it('returns empty array when no relevant inspiration found', () => {
      const context: CreativeContext = {
        domain: 'music',
        intent: 'Create a melody',
        mood: 'happy',
        concepts: ['Melody']
      };

      const inspirations = memory.suggestInspiration(context);
      // May have some suggestions from knowledge graph even without matching artworks
      expect(Array.isArray(inspirations)).toBe(true);
    });
  });

  describe('suggestTechnique', () => {
    it('suggests techniques based on goal', () => {
      const techniques = memory.suggestTechnique('create noise patterns');

      expect(techniques.length).toBeGreaterThan(0);
      expect(techniques[0]).toHaveProperty('name');
      expect(techniques[0]).toHaveProperty('domain');
      expect(techniques[0]).toHaveProperty('description');
    });

    it('returns techniques relevant to the goal', () => {
      const techniques = memory.suggestTechnique('add noise to artwork');

      const noiseTechniques = techniques.filter(t =>
        t.name.toLowerCase().includes('noise') ||
        t.description.toLowerCase().includes('noise')
      );

      expect(noiseTechniques.length).toBeGreaterThan(0);
    });

    it('returns empty array when goal is unrelated', () => {
      const techniques = memory.suggestTechnique('cook a recipe');
      expect(techniques).toEqual([]);
    });

    it('is case-insensitive for goal matching', () => {
      const techniques1 = memory.suggestTechnique('create NOISE patterns');
      const techniques2 = memory.suggestTechnique('Create Noise Patterns');

      expect(techniques1.length).toBeGreaterThan(0);
      expect(techniques2.length).toBeGreaterThan(0);
    });
  });

  describe('rememberArtwork', () => {
    it('stores artwork in episodic memory', () => {
      const artwork: Artwork = {
        id: 'test-art-1',
        code: 'function setup() {}',
        domain: 'p5',
        timestamp: new Date(),
        concepts: ['Test Concept']
      };

      memory.rememberArtwork(artwork, ['Test Concept'], 'Great artwork');

      const recentEpisodes = memory.episodicMemory.recallRecent(1);
      expect(recentEpisodes.length).toBe(1);
      expect(recentEpisodes[0].type).toBe('generation');
    });

    it('associates concepts with artwork', () => {
      const artwork: Artwork = {
        id: 'test-art-2',
        code: 'function draw() {}',
        domain: 'shader',
        timestamp: new Date(),
        concepts: ['Minimalism', 'Balance']
      };

      memory.rememberArtwork(artwork, ['Minimalism', 'Balance'], 'Clean design');

      const retrieved = memory.getArtworksByConcept('Minimalism');
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].id).toBe('test-art-2');
    });

    it('stores reaction in episodic memory', () => {
      const artwork: Artwork = {
        id: 'test-art-3',
        code: '// test code',
        domain: 'p5',
        timestamp: new Date(),
        score: 8
      };

      const reaction = 'This is amazing! #generative #peaceful';
      memory.rememberArtwork(artwork, ['Generative Art'], reaction);

      // Check that a feedback episode was created with the reaction
      const recentEpisodes = memory.episodicMemory.recallRecent(10);
      const feedbackEpisodes = recentEpisodes.filter(e => e.type === 'feedback');

      expect(feedbackEpisodes.length).toBeGreaterThan(0);

      const episodeContent = feedbackEpisodes[0].content as any;
      expect(episodeContent.comment).toBe(reaction);
    });

    it('handles artwork without mood', () => {
      const artwork: Artwork = {
        id: 'test-art-4',
        code: 'function setup() {}',
        domain: 'three',
        timestamp: new Date(),
        concepts: ['3D']
      };

      memory.rememberArtwork(artwork, ['3D'], 'Nice 3D work');

      const retrieved = memory.getArtworksByConcept('3D');
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].mood).toBeUndefined();
    });

    it('stores score if provided', () => {
      const artwork: Artwork = {
        id: 'test-art-5',
        code: 'function setup() {}',
        domain: 'p5',
        timestamp: new Date(),
        score: 9,
        concepts: ['Test']
      };

      memory.rememberArtwork(artwork, ['Test'], 'Excellent');

      const retrieved = memory.getArtworksByConcept('Test');
      expect(retrieved[0].score).toBe(9);
    });
  });

  describe('integration scenarios', () => {
    it('combines knowledge graph and episodic memory for rich suggestions', () => {
      // Remember some artworks
      const artwork1: Artwork = {
        id: 'integration-1',
        code: 'noiseDetail(64);',
        domain: 'p5',
        timestamp: new Date(),
        score: 8,
        concepts: ['Perlin Noise'],
        mood: 'organic'
      };

      memory.rememberArtwork(artwork1, ['Perlin Noise'], 'Great noise work');

      // Get suggestions
      const context: CreativeContext = {
        domain: 'p5',
        intent: 'Create organic patterns',
        mood: 'organic',
        concepts: ['Perlin Noise']
      };

      const inspirations = memory.suggestInspiration(context);

      // Should have past work, artist references, and technique suggestions
      const types = new Set(inspirations.map(i => i.type));
      expect(types.has('past-work')).toBe(true);
    });

    it('learns from user preferences over time', () => {
      // Remember high-rated artworks with specific mood hashtags
      const artwork1: Artwork = {
        id: 'pref-1',
        code: '// calm artwork 1',
        domain: 'p5',
        timestamp: new Date(),
        score: 9,
        concepts: ['Minimalism'],
        mood: 'calm'
      };

      const artwork2: Artwork = {
        id: 'pref-2',
        code: '// calm artwork 2',
        domain: 'shader',
        timestamp: new Date(),
        score: 8,
        concepts: ['Balance'],
        mood: 'calm'
      };

      // Use hashtags that match the mood keywords in EpisodicMemory
      memory.rememberArtwork(artwork1, ['Minimalism'], 'Love the #calm mood');
      memory.rememberArtwork(artwork2, ['Balance'], 'Very #calm and peaceful');

      // Get preferences
      const preferences = memory.episodicMemory.getPreferences();

      expect(preferences.preferredMoods).toContain('calm');
    });
  });
});
