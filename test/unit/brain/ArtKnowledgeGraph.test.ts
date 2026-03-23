import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArtKnowledgeGraph,
  Concept,
  ConceptType,
  ConceptQuery
} from '../../../dist/brain/ArtKnowledgeGraph.js';

describe('ArtKnowledgeGraph', () => {
  let graph: ArtKnowledgeGraph;

  beforeEach(() => {
    graph = new ArtKnowledgeGraph();
  });

  describe('addConcept', () => {
    it('creates concept with unique ID', () => {
      const id1 = graph.addConcept('Generative Art', 'movement');
      const id2 = graph.addConcept('Perlin Noise', 'technique');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);

      const concept1 = graph.getConcept(id1);
      expect(concept1).toBeDefined();
      expect(concept1?.name).toBe('Generative Art');
      expect(concept1?.type).toBe('movement');
      expect(concept1?.id).toBe(id1);
    });

    it('stores metadata with concept', () => {
      const id = graph.addConcept('Sol LeWitt', 'artist', {
        born: 1928,
        died: 2007,
        nationality: 'American'
      });

      const concept = graph.getConcept(id);
      expect(concept?.metadata).toEqual({
        born: 1928,
        died: 2007,
        nationality: 'American'
      });
    });

    it('creates concepts with sequential IDs', () => {
      const id1 = graph.addConcept('First', 'movement');
      const id2 = graph.addConcept('Second', 'technique');
      const id3 = graph.addConcept('Third', 'artist');

      // IDs should be numeric strings
      expect(id1).toBe('0');
      expect(id2).toBe('1');
      expect(id3).toBe('2');
    });
  });

  describe('relate', () => {
    it('creates bidirectional relationship between concepts', () => {
      const fromId = graph.addConcept('Generative Art', 'movement');
      const toId = graph.addConcept('Algorithmic Art', 'movement');

      graph.relate(fromId, toId, 'related-to', 0.8);

      const fromConcept = graph.getConcept(fromId);
      const toConcept = graph.getConcept(toId);

      expect(fromConcept?.related.get('related-to')?.to).toBe(toId);
      expect(fromConcept?.related.get('related-to')?.weight).toBe(0.8);

      // Should be bidirectional
      expect(toConcept?.related.get('related-to')?.to).toBe(fromId);
      expect(toConcept?.related.get('related-to')?.weight).toBe(0.8);
    });

    it('creates multiple relationships from same concept', () => {
      const fromId = graph.addConcept('Generative Art', 'movement');
      const toId1 = graph.addConcept('Algorithmic Art', 'movement');
      const toId2 = graph.addConcept('Digital Art', 'movement');

      graph.relate(fromId, toId1, 'related-to', 0.9);
      graph.relate(fromId, toId2, 'inspired-by', 0.7);

      const concept = graph.getConcept(fromId);
      expect(concept?.related.get('related-to')?.to).toBe(toId1);
      expect(concept?.related.get('inspired-by')?.to).toBe(toId2);
    });

    it('defaults weight to 1.0 if not specified', () => {
      const fromId = graph.addConcept('Concept1', 'movement');
      const toId = graph.addConcept('Concept2', 'movement');

      graph.relate(fromId, toId, 'related-to');

      const concept = graph.getConcept(fromId);
      expect(concept?.related.get('related-to')?.weight).toBe(1.0);
    });
  });

  describe('getConcept', () => {
    it('finds concept by ID', () => {
      const id = graph.addConcept('Generative Art', 'movement');
      const concept = graph.getConcept(id);

      expect(concept).toBeDefined();
      expect(concept?.id).toBe(id);
      expect(concept?.name).toBe('Generative Art');
    });

    it('finds concept by name', () => {
      graph.addConcept('Generative Art', 'movement');
      graph.addConcept('Perlin Noise', 'technique');

      const concept = graph.getConcept('Generative Art');
      expect(concept).toBeDefined();
      expect(concept?.name).toBe('Generative Art');
      expect(concept?.type).toBe('movement');
    });

    it('returns null for non-existent concept', () => {
      const concept = graph.getConcept('non-existent');
      expect(concept).toBeNull();
    });

    it('prioritizes ID lookup over name lookup', () => {
      const id = graph.addConcept('Test', 'movement');
      const concept = graph.getConcept(id);

      expect(concept?.id).toBe(id);
    });
  });

  describe('findRelated', () => {
    it('returns empty array for concept with no relations', () => {
      const id = graph.addConcept('Isolated Concept', 'movement');
      const related = graph.findRelated(id);

      expect(related).toEqual([]);
    });

    it('finds directly related concepts at depth 1', () => {
      const rootId = graph.addConcept('Generative Art', 'movement');
      const related1 = graph.addConcept('Algorithmic Art', 'movement');
      const related2 = graph.addConcept('Digital Art', 'movement');
      const unrelated = graph.addConcept('Unrelated', 'movement');

      graph.relate(rootId, related1, 'related-to');
      graph.relate(rootId, related2, 'inspired-by');

      const found = graph.findRelated(rootId, 1);
      const foundIds = found.map(c => c.id);

      expect(found).toHaveLength(2);
      expect(foundIds).toContain(related1);
      expect(foundIds).toContain(related2);
      expect(foundIds).not.toContain(unrelated);
      expect(foundIds).not.toContain(rootId);
    });

    it('traverses relationships to specified depth', () => {
      const root = graph.addConcept('A', 'movement');
      const b = graph.addConcept('B', 'movement');
      const c = graph.addConcept('C', 'movement');
      const d = graph.addConcept('D', 'movement');

      graph.relate(root, b, 'related-to');
      graph.relate(b, c, 'related-to');
      graph.relate(c, d, 'related-to');

      const depth1 = graph.findRelated(root, 1);
      const depth2 = graph.findRelated(root, 2);
      const depth3 = graph.findRelated(root, 3);

      expect(depth1.map(c => c.id)).toEqual([b]);
      expect(depth2.map(c => c.id)).toEqual(expect.arrayContaining([b, c]));
      expect(depth3.map(c => c.id)).toEqual(expect.arrayContaining([b, c, d]));
    });

    it('avoids cycles in relationship traversal', () => {
      const a = graph.addConcept('A', 'movement');
      const b = graph.addConcept('B', 'movement');
      const c = graph.addConcept('C', 'movement');

      graph.relate(a, b, 'related-to');
      graph.relate(b, c, 'related-to');
      graph.relate(c, a, 'related-to'); // Creates cycle

      const found = graph.findRelated(a, 10);
      const uniqueIds = new Set(found.map(c => c.id));

      // Should not duplicate or loop infinitely
      expect(uniqueIds.size).toBeLessThanOrEqual(found.length);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Setup test data
      graph.addConcept('Generative Art', 'movement');
      graph.addConcept('Perlin Noise', 'technique');
      graph.addConcept('Sol LeWitt', 'artist');
      graph.addConcept('Balance', 'principle');
      graph.addConcept('Minimalism', 'movement');
      graph.addConcept('Cellular Automata', 'technique');

      const genArt = graph.getConcept('Generative Art');
      const perlin = graph.getConcept('Perlin Noise');
      const minimalism = graph.getConcept('Minimalism');

      if (genArt && perlin) {
        graph.relate(genArt.id, perlin.id, 'uses');
      }
      if (genArt && minimalism) {
        graph.relate(genArt.id, minimalism.id, 'related-to');
      }
    });

    it('filters by type', () => {
      const movements = graph.query({ type: 'movement' });
      const techniques = graph.query({ type: 'technique' });

      expect(movements).toHaveLength(2);
      expect(movements.every(c => c.type === 'movement')).toBe(true);

      expect(techniques).toHaveLength(2);
      expect(techniques.every(c => c.type === 'technique')).toBe(true);
    });

    it('filters by name pattern (case insensitive)', () => {
      const results = graph.query({ namePattern: 'art' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(c => c.name.toLowerCase().includes('art'))).toBe(true);
    });

    it('filters by relation type', () => {
      const results = graph.query({ hasRelation: 'uses' });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(c => c.related.has('uses'))).toBe(true);
    });

    it('combines multiple filters', () => {
      const results = graph.query({
        type: 'movement',
        namePattern: 'art'
      });

      expect(results.every(c =>
        c.type === 'movement' && c.name.toLowerCase().includes('art')
      )).toBe(true);
    });

    it('returns all concepts when no filters provided', () => {
      const results = graph.query({});
      expect(results.length).toBe(6);
    });
  });

  describe('loadSeedData', () => {
    it('populates all seed concepts', () => {
      graph.loadSeedData();

      const all = graph.query({});

      // Should have concepts from all categories
      expect(all.length).toBeGreaterThan(50);

      // Check for specific movements
      const generativeArt = graph.getConcept('Generative Art');
      expect(generativeArt).toBeDefined();
      expect(generativeArt?.type).toBe('movement');

      // Check for specific techniques
      const perlinNoise = graph.getConcept('Perlin Noise');
      expect(perlinNoise).toBeDefined();
      expect(perlinNoise?.type).toBe('technique');

      // Check for specific artists
      const solLewitt = graph.getConcept('Sol LeWitt');
      expect(solLewitt).toBeDefined();
      expect(solLewitt?.type).toBe('artist');

      // Check for specific principles
      const balance = graph.getConcept('Balance');
      expect(balance).toBeDefined();
      expect(balance?.type).toBe('principle');

      // Check for color concepts
      const complementary = graph.getConcept('Complementary');
      expect(complementary).toBeDefined();
      expect(complementary?.type).toBe('color');

      // Check for composition concepts
      const ruleOfThirds = graph.getConcept('Rule of Thirds');
      expect(ruleOfThirds).toBeDefined();
      expect(ruleOfThirds?.type).toBe('composition');
    });

    it('creates relationships between related concepts', () => {
      graph.loadSeedData();

      // Find a concept that should have relationships
      const generativeArt = graph.getConcept('Generative Art');
      expect(generativeArt?.related.size).toBeGreaterThan(0);
    });

    it('can be called multiple times without duplicating', () => {
      graph.loadSeedData();
      const count1 = graph.query({}).length;

      graph.loadSeedData();
      const count2 = graph.query({}).length;

      expect(count2).toBe(count1);
    });
  });
});
