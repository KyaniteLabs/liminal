/**
 * ArtKnowledgeGraph - Knowledge graph for artistic concepts, relationships, and domains
 *
 * Stores artistic concepts (techniques, movements, artists, principles, color, composition)
 * with their relationships. Used by SemanticArtMemory for intelligent artistic suggestions.
 *
 * Updated for Phase 4: Loads comprehensive artistic knowledge across all domains.
 */

import {
  getAllArtisticConcepts,
} from './comprehensive-artistic-knowledge.js';

export type ConceptType = 'movement' | 'technique' | 'artist' | 'principle' | 'color' | 'composition' | 'domain';

export interface Concept {
  id: string;
  name: string;
  type: ConceptType;
  domain?: 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel';
  description?: string;
  keywords?: string[];
  metadata?: Record<string, unknown>;
  related: Map<string, Relation[]>; // relation name -> array of relations
}

export interface Relation {
  to: string; // target concept id
  relation: string; // e.g., 'inspired-by', 'uses', 'related-to', 'opposite-of'
  weight?: number;
}

export interface ConceptQuery {
  type?: ConceptType;
  domain?: 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel';
  namePattern?: string;
  hasRelation?: string;
  keyword?: string;
}

export class ArtKnowledgeGraph {
  private concepts: Map<string, Concept>;
  private nextId: number;
  private nameToId: Map<string, string>; // Fast name lookup

  constructor() {
    this.concepts = new Map();
    this.nextId = 0;
    this.nameToId = new Map();
  }

  addConcept(
    name: string,
    type: ConceptType,
    metadata?: Record<string, unknown>
  ): string {
    const id = this.nextId.toString();
    this.nextId++;

    const concept: Concept = {
      id,
      name,
      type,
      metadata,
      related: new Map()
    };

    this.concepts.set(id, concept);
    this.nameToId.set(name.toLowerCase(), id);
    return id;
  }

  relate(fromId: string, toId: string, relation: string, weight: number = 1.0): void {
    const fromConcept = this.concepts.get(fromId);
    const toConcept = this.concepts.get(toId);

    if (!fromConcept || !toConcept) {
      return;
    }

    // Create bidirectional relationship (store as arrays)
    const fromRelation = { to: toId, relation, weight };
    const toRelation = { to: fromId, relation, weight };

    if (!fromConcept.related.has(relation)) {
      fromConcept.related.set(relation, []);
    }
    if (!toConcept.related.has(relation)) {
      toConcept.related.set(relation, []);
    }

    fromConcept.related.get(relation)!.push(fromRelation);
    toConcept.related.get(relation)!.push(toRelation);
  }

  getConcept(idOrName: string): Concept | null {
    // Try ID lookup first
    const byId = this.concepts.get(idOrName);
    if (byId) {
      return byId;
    }

    // Try name lookup (case-insensitive)
    const nameId = this.nameToId.get(idOrName.toLowerCase());
    if (nameId) {
      return this.concepts.get(nameId) || null;
    }

    return null;
  }

  findRelated(conceptId: string, depth: number = 1): Concept[] {
    const visited = new Set<string>();
    const result: Concept[] = [];

    const traverse = (currentId: string, currentDepth: number) => {
      if (visited.has(currentId)) {
        return;
      }

      visited.add(currentId);
      const concept = this.concepts.get(currentId);

      if (!concept || currentDepth >= depth) {
        return;
      }

      // Add all related concepts at this level (related is now Map<string, Relation[]>)
      for (const relations of concept.related.values()) {
        for (const relation of relations) {
          if (!visited.has(relation.to) && relation.to !== conceptId) {
            const relatedConcept = this.concepts.get(relation.to);
            if (relatedConcept && !result.includes(relatedConcept)) {
              result.push(relatedConcept);
              traverse(relation.to, currentDepth + 1);
            }
          }
        }
      }
    };

    traverse(conceptId, 0);
    return result;
  }

  query(filter: ConceptQuery): Concept[] {
    let results = Array.from(this.concepts.values());

    if (filter.type) {
      results = results.filter(c => c.type === filter.type);
    }

    if (filter.domain) {
      results = results.filter(c => c.domain === filter.domain || c.metadata?.domain === filter.domain);
    }

    if (filter.namePattern) {
      const pattern = filter.namePattern.toLowerCase();
      results = results.filter(c => c.name.toLowerCase().includes(pattern));
    }

    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      results = results.filter(c =>
        c.keywords?.some(k => k.toLowerCase().includes(keyword)) ||
        c.name.toLowerCase().includes(keyword) ||
        c.description?.toLowerCase().includes(keyword)
      );
    }

    if (filter.hasRelation) {
      results = results.filter(c => {
        for (const relations of c.related.values()) {
          for (const rel of relations) {
            if (rel.relation === filter.hasRelation) return true;
          }
        }
        return false;
      });
    }

    return results;
  }

  /**
   * Load comprehensive artistic knowledge from comprehensive-artistic-knowledge.ts
   * Creates rich relationships between techniques, artists, movements, and principles
   */
  loadSeedData(): void {
    // Prevent duplicate loading
    if (this.concepts.size > 0) {
      return;
    }

    // Load all artistic concepts
    const allConcepts = getAllArtisticConcepts();

    // Track IDs for relationship creation
    const techniqueIds: Record<string, string> = {};
    const artistIds: Record<string, string> = {};
    const movementIds: Record<string, string> = {};
    const principleIds: Record<string, string> = {};
    const colorIds: Record<string, string> = {};
    const compositionIds: Record<string, string> = {};

    // Add all concepts and track by type
    for (const conceptData of allConcepts) {
      const id = this.addConcept(
        conceptData.name,
        conceptData.type,
        {
          ...conceptData.metadata,
          description: conceptData.description,
          domain: conceptData.domain,
          keywords: conceptData.keywords,
        }
      );

      const concept = this.concepts.get(id);
      if (concept) {
        concept.domain = conceptData.domain;
        (concept as any).keywords = conceptData.keywords;
      }

      // Track by type for relationship creation
      switch (conceptData.type) {
        case 'technique':
          techniqueIds[conceptData.name] = id;
          break;
        case 'artist':
          artistIds[conceptData.name] = id;
          break;
        case 'movement':
          movementIds[conceptData.name] = id;
          break;
        case 'principle':
          principleIds[conceptData.name] = id;
          break;
        case 'color':
          colorIds[conceptData.name] = id;
          break;
        case 'composition':
          compositionIds[conceptData.name] = id;
          break;
      }
    }

    // Create rich relationships between concepts

    // 1. Movement -> Technique relationships (which movements use which techniques)
    const movementTechniqueMap: Record<string, string[]> = {
      'Generative Art': ['Perlin Noise', 'Flow Fields', 'Fractals', 'L-Systems', 'Cellular Automata', 'Recursion', 'Pattern Algebra'],
      'Algorithmic Art': ['L-Systems', 'Cellular Automata', 'Iterative Processes', 'Algorithmic Composition'],
      'Creative Coding': ['Coordinate Systems', 'Animation Basics', 'Interaction', 'Generative Art'],
      'Live Coding': ['Live Coding Patterns', 'Temporal Modulation', 'Real-time'],
      'Procedural Generation': ['Perlin Noise', 'Flow Fields', 'Texture Synthesis', 'Procedural'],
      'Op Art': ['Pattern', 'Contrast', 'Symmetry', 'Geometric'],
      'Minimalism': ['Negative Space', 'Symmetry', 'Balance', 'Monochrome'],
    };

    for (const [movement, techniques] of Object.entries(movementTechniqueMap)) {
      const movementId = movementIds[movement];
      if (movementId) {
        for (const technique of techniques) {
          const techId = techniqueIds[technique];
          if (techId) {
            this.relate(movementId, techId, 'uses');
          }
        }
      }
    }

    // 2. Artist -> Movement relationships
    const artistMovementMap: Record<string, string> = {
      'Casey Reas': 'Generative Art',
      'Ben Fry': 'Generative Art',
      'Daniel Shiffman': 'Creative Coding',
      'Vera Molnar': 'Generative Art',
      'Manfred Mohr': 'Algorithmic Art',
      'Sol LeWitt': 'Minimalism',
      'Inigo Quilez': 'Computational Art',
      'Ricardo Cabello': 'Creative Coding',
      'Timothy Heckmann': 'Live Coding',
      'Mikael Jazuli': 'Live Coding',
      'Refik Anadol': 'AI Art',
      'Tyler Hobbs': 'Generative Art',
      'Golan Levin': 'Interactive Art',
    };

    for (const [artist, movement] of Object.entries(artistMovementMap)) {
      const artistId = artistIds[artist];
      const movementId = movementIds[movement];
      if (artistId && movementId) {
        this.relate(artistId, movementId, 'associated-with');
      }
    }

    // 3. Artist -> Technique relationships
    const artistTechniqueMap: Record<string, string[]> = {
      'Inigo Quilez': ['Raymarching', 'SDFs', 'Shader Programming'],
      'Simon Green': ['Raymarching', 'Shader Programming', 'Procedural'],
      'Casey Reas': ['Recursion', 'Generative Art', 'Systems'],
      'Ben Fry': ['Data Visualization', 'Mapping', 'Generative Design'],
      'Daniel Shiffman': ['Particle Systems', 'Physics', 'Interaction', 'Animation'],
      'Vera Molnar': ['Algorithmic Art', 'Plotter Art', 'Generative'],
      'Manfred Mohr': ['Algorithmic Art', 'Plotter Art'],
      'Ricardo Cabello': ['WebGL', '3D Graphics', 'Scene Graph'],
      'Timothy Heckmann': ['Pattern Sequencing', 'Live Coding', 'Algorithmic Composition'],
      'Alex McLean': ['Pattern Sequencing', 'Live Coding', 'Algorithmic Composition'],
      'Mikael Jazuli': ['Feedback', 'Post-processing', 'Visual Synthesis'],
      'Ken Perlin': ['Perlin Noise', 'Flow Fields'],
    };

    for (const [artist, techniques] of Object.entries(artistTechniqueMap)) {
      const artistId = artistIds[artist];
      if (artistId) {
        for (const technique of techniques) {
          const techId = techniqueIds[technique];
          if (techId) {
            this.relate(artistId, techId, 'uses');
          }
        }
      }
    }

    // 4. Principle <-> Composition relationships
    const principleCompositionMap: Record<string, string> = {
      'Balance': 'Symmetry',
      'Contrast': 'Complementary',
      'Emphasis': 'Focal Point',
      'Movement': 'Leading Lines',
      'Rhythm': 'Pattern',
      'Unity': 'Harmony',
      'Variety': 'Asymmetry',
      'Negative Space': 'Minimalism',
      'Depth': 'Perspective',
      'Scale': 'Proportion',
    };

    for (const [principle, composition] of Object.entries(principleCompositionMap)) {
      const principleId = principleIds[principle];
      const compositionId = compositionIds[composition];
      if (principleId && compositionId) {
        this.relate(principleId, compositionId, 'uses');
      }
    }

    // 5. Color -> Principle relationships
    const colorPrincipleMap: Record<string, string> = {
      'Complementary': 'Contrast',
      'Analogous': 'Unity',
      'Warm Colors': 'Emphasis',
      'Cool Colors': 'Balance',
      'Saturation': 'Variety',
      'Value': 'Depth',
      'Gradient': 'Movement',
    };

    for (const [color, principle] of Object.entries(colorPrincipleMap)) {
      const colorId = colorIds[color];
      const principleId = principleIds[principle];
      if (colorId && principleId) {
        this.relate(colorId, principleId, 'creates');
      }
    }

    // 6. Domain-specific technique relationships
    // p5.js techniques
    const p5Related = [
      ['Coordinate Systems', 'Shape Primitives'],
      ['Animation Basics', 'Frame Rate'],
      ['Interaction', 'Events'],
      ['Image Processing', 'Pixel Manipulation'],
      ['WebGL', '3D Graphics'],
      ['Particle Systems', 'Physics'],
      ['Flow Fields', 'Perlin Noise'],
      ['Recursion', 'Fractals'],
      ['L-Systems', 'Recursion'],
      ['Cellular Automata', 'Grid Systems'],
    ];

    for (const [from, to] of p5Related) {
      const fromId = techniqueIds[from];
      const toId = techniqueIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'related-to');
      }
    }

    // Shader techniques
    const shaderRelated = [
      ['Raymarching', 'SDFs'],
      ['Noise Functions', 'FBM'],
      ['Domain Warping', 'Noise Functions'],
      ['Color Palettes', 'Color Theory'],
      ['Post-Processing', 'Bloom'],
      ['Normal Mapping', 'Lighting'],
      ['Shadow Mapping', 'Lighting'],
    ];

    for (const [from, to] of shaderRelated) {
      const fromId = techniqueIds[from];
      const toId = techniqueIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'uses');
      }
    }

    // Three.js techniques
    const threeRelated = [
      ['Scene Graph', 'Hierarchy'],
      ['Geometries', 'Materials'],
      ['Lighting', 'Shadows'],
      ['Cameras', 'Perspective'],
      ['Animation', 'Tweening'],
      ['InstancedMesh', 'Performance'],
      ['Post-Processing', 'Bloom'],
    ];

    for (const [from, to] of threeRelated) {
      const fromId = techniqueIds[from];
      const toId = techniqueIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'related-to');
      }
    }

    // Strudel techniques
    const strudelRelated = [
      ['Pattern Sequencing', 'Stack-based Composition'],
      ['Temporal Modulation', 'Live Coding'],
      ['Rhythm Patterns', 'Polyrhythms'],
      ['Melody Generation', 'Scale-based'],
      ['Harmonic Progression', 'Chords'],
      ['Timbre Design', 'Synthesis'],
      ['Spatial Audio', 'Reverb'],
      ['Probability and Chance', 'Generative'],
    ];

    for (const [from, to] of strudelRelated) {
      const fromId = techniqueIds[from];
      const toId = techniqueIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'uses');
      }
    }

    // Hydra techniques
    const hydraRelated = [
      ['Source Creation', 'Texture Modulation'],
      ['Color Manipulation', 'Colorama'],
      ['Blending and Composition', 'Layer'],
      ['Feedback', 'Recursion'],
      ['Audio Reactivity', 'FFT'],
      ['Glitch', 'Distortion'],
      ['Post-processing Chains', 'Effect'],
    ];

    for (const [from, to] of hydraRelated) {
      const fromId = techniqueIds[from];
      const toId = techniqueIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'uses');
      }
    }

    // 7. Opposite relationships
    const opposites = [
      ['Symmetry', 'Asymmetry'],
      ['Warm Colors', 'Cool Colors'],
      ['Balance', 'Imbalance'],
      ['Unity', 'Variety'],
      ['Order', 'Chaos'],
    ];

    for (const [from, to] of opposites) {
      // Check both color and composition/concept categories
      const fromId = colorIds[from] || compositionIds[from] || principleIds[from];
      const toId = colorIds[to] || compositionIds[to] || principleIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'opposite-of');
      }
    }

    // 8. Movement interrelationships
    const movementRelations = [
      ['Generative Art', 'Algorithmic Art'],
      ['Generative Art', 'Computational Art'],
      ['Generative Art', 'Digital Art'],
      ['Generative Art', 'AI Art'],
      ['Creative Coding', 'Live Coding'],
      ['Interactive Art', 'Installation Art'],
      ['Data Art', 'Generative Art'],
      ['Glitch Art', 'Digital Art'],
    ];

    for (const [from, to] of movementRelations) {
      const fromId = movementIds[from];
      const toId = movementIds[to];
      if (fromId && toId) {
        this.relate(fromId, toId, 'related-to');
      }
    }

    // 9. Influence relationships (artists influenced by other artists)
    const influences = [
      ['Casey Reas', 'Sol LeWitt'],
      ['Tyler Hobbs', 'Vera Molnar'],
      ['Daniel Shiffman', 'Casey Reas'],
    ];

    for (const [influenced, influencer] of influences) {
      const influencedId = artistIds[influenced];
      const influencerId = artistIds[influencer];
      if (influencedId && influencerId) {
        this.relate(influencedId, influencerId, 'inspired-by');
      }
    }

    // 10. Technique -> Principle relationships
    const techniquePrincipleMap: Record<string, string[]> = {
      'Pattern': ['Pattern', 'Rhythm', 'Unity'],
      'Flow Fields': ['Movement', 'Flow'],
      'Perlin Noise': ['Organic', 'Natural'],
      'Symmetry': ['Balance', 'Order'],
      'Asymmetry': ['Variety', 'Dynamic'],
      'Negative Space': ['Minimalism', 'Breathing'],
      'Contrast': ['Emphasis', 'Difference'],
    };

    for (const [technique, principles] of Object.entries(techniquePrincipleMap)) {
      const techId = techniqueIds[technique];
      if (techId) {
        for (const principle of principles) {
          const principleId = principleIds[principle] || compositionIds[principle] || movementIds[principle];
          if (principleId) {
            this.relate(techId, principleId, 'demonstrates');
          }
        }
      }
    }
  }

  /**
   * Get concepts by domain (p5, shader, three, strudel, hydra)
   */
  getByDomain(domain: 'p5' | 'shader' | 'three' | 'strudel' | 'hydra'): Concept[] {
    return this.query({ domain });
  }

  /**
   * Get all techniques (across all domains)
   */
  getTechniques(): Concept[] {
    return this.query({ type: 'technique' });
  }

  /**
   * Get all artists
   */
  getArtists(): Concept[] {
    return this.query({ type: 'artist' });
  }

  /**
   * Get all movements
   */
  getMovements(): Concept[] {
    return this.query({ type: 'movement' });
  }

  /**
   * Get all principles
   */
  getPrinciples(): Concept[] {
    return this.query({ type: 'principle' });
  }

  /**
   * Search by keyword in concept name, description, or keywords
   */
  searchByKeyword(keyword: string): Concept[] {
    return this.query({ keyword });
  }

  /**
   * Get statistics about the knowledge graph
   */
  getStats(): { total: number; byType: Record<string, number>; byDomain: Record<string, number> } {
    const byType: Record<string, number> = {};
    const byDomain: Record<string, number> = {};

    for (const concept of this.concepts.values()) {
      byType[concept.type] = (byType[concept.type] || 0) + 1;
      if (concept.domain) {
        byDomain[concept.domain] = (byDomain[concept.domain] || 0) + 1;
      }
    }

    return {
      total: this.concepts.size,
      byType,
      byDomain,
    };
  }
}
