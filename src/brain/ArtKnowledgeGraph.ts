export type ConceptType = 'movement' | 'technique' | 'artist' | 'principle' | 'color' | 'composition';

export interface Concept {
  id: string;
  name: string;
  type: ConceptType;
  description?: string;
  metadata?: Record<string, unknown>;
  related: Map<string, Relation>; // relation name -> target concept id
}

export interface Relation {
  to: string; // target concept id
  relation: string; // e.g., 'inspired-by', 'uses', 'related-to', 'opposite-of'
  weight?: number;
}

export interface ConceptQuery {
  type?: ConceptType;
  namePattern?: string;
  hasRelation?: string;
}

export class ArtKnowledgeGraph {
  private concepts: Map<string, Concept>;
  private nextId: number;

  constructor() {
    this.concepts = new Map();
    this.nextId = 0;
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
    return id;
  }

  relate(fromId: string, toId: string, relation: string, weight: number = 1.0): void {
    const fromConcept = this.concepts.get(fromId);
    const toConcept = this.concepts.get(toId);

    if (!fromConcept || !toConcept) {
      return;
    }

    // Create bidirectional relationship
    fromConcept.related.set(relation, { to: toId, relation, weight });
    toConcept.related.set(relation, { to: fromId, relation, weight });
  }

  getConcept(idOrName: string): Concept | null {
    // Try ID lookup first
    const byId = this.concepts.get(idOrName);
    if (byId) {
      return byId;
    }

    // Try name lookup
    for (const concept of this.concepts.values()) {
      if (concept.name === idOrName) {
        return concept;
      }
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

      // Add all related concepts at this level
      for (const relation of concept.related.values()) {
        if (!visited.has(relation.to) && relation.to !== conceptId) {
          const relatedConcept = this.concepts.get(relation.to);
          if (relatedConcept) {
            result.push(relatedConcept);
            traverse(relation.to, currentDepth + 1);
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

    if (filter.namePattern) {
      const pattern = filter.namePattern.toLowerCase();
      results = results.filter(c => c.name.toLowerCase().includes(pattern));
    }

    if (filter.hasRelation) {
      results = results.filter(c => c.related.has(filter.hasRelation!));
    }

    return results;
  }

  loadSeedData(): void {
    // Prevent duplicate loading
    if (this.concepts.size > 0) {
      return;
    }

    // Art Movements
    const MOVEMENTS = [
      "Generative Art", "Algorithmic Art", "Computational Art",
      "Op Art", "Kinetic Art", "Minimalism", "Abstract Expressionism",
      "Digital Art", "Glitch Art", "Data Art", "AI Art"
    ];

    // Techniques
    const TECHNIQUES = [
      "Cellular Automata", "L-Systems", "Fractals", "Perlin Noise",
      "Flow Fields", "Particle Systems", "Boids", "Reaction-Diffusion",
      "Raymarching", "Recursion", "Shader Programming"
    ];

    // Artists
    const ARTISTS = [
      "Sol LeWitt", "Vera Molnar", "Harold Cohen", "Manfred Mohr",
      "Casey Reas", "Ben Fry", "Golan Levin", "Zach Lieberman",
      "Tyler Hobbs", "Anna Ridler", "Sofia Crespo", "Ken Perlin"
    ];

    // Design Principles
    const PRINCIPLES = [
      "Balance", "Contrast", "Emphasis", "Movement", "Pattern",
      "Rhythm", "Unity", "Variety", "Negative Space", "Hierarchy"
    ];

    // Color Theory
    const COLOR_CONCEPTS = [
      "Complementary", "Analogous", "Triadic", "Warm Colors",
      "Cool Colors", "Color Harmony", "Saturation", "Value", "Hue"
    ];

    // Composition
    const COMPOSITION = [
      "Rule of Thirds", "Golden Ratio", "Symmetry", "Asymmetry",
      "Leading Lines", "Framing", "Perspective", "Depth", "Scale"
    ];

    // Add all concepts
    const movementIds: Record<string, string> = {};
    for (const movement of MOVEMENTS) {
      movementIds[movement] = this.addConcept(movement, 'movement');
    }

    const techniqueIds: Record<string, string> = {};
    for (const technique of TECHNIQUES) {
      techniqueIds[technique] = this.addConcept(technique, 'technique');
    }

    const artistIds: Record<string, string> = {};
    for (const artist of ARTISTS) {
      artistIds[artist] = this.addConcept(artist, 'artist');
    }

    const principleIds: Record<string, string> = {};
    for (const principle of PRINCIPLES) {
      principleIds[principle] = this.addConcept(principle, 'principle');
    }

    const colorIds: Record<string, string> = {};
    for (const color of COLOR_CONCEPTS) {
      colorIds[color] = this.addConcept(color, 'color');
    }

    const compositionIds: Record<string, string> = {};
    for (const comp of COMPOSITION) {
      compositionIds[comp] = this.addConcept(comp, 'composition');
    }

    // Create some key relationships
    // Generative Art uses various techniques
    this.relate(movementIds['Generative Art'], techniqueIds['Cellular Automata'], 'uses');
    this.relate(movementIds['Generative Art'], techniqueIds['L-Systems'], 'uses');
    this.relate(movementIds['Generative Art'], techniqueIds['Perlin Noise'], 'uses');
    this.relate(movementIds['Generative Art'], techniqueIds['Fractals'], 'uses');

    // Related movements
    this.relate(movementIds['Generative Art'], movementIds['Algorithmic Art'], 'related-to');
    this.relate(movementIds['Generative Art'], movementIds['Computational Art'], 'related-to');
    this.relate(movementIds['Generative Art'], movementIds['Digital Art'], 'related-to');
    this.relate(movementIds['Generative Art'], movementIds['AI Art'], 'related-to');

    // Minimalism relationships
    this.relate(movementIds['Minimalism'], principleIds['Balance'], 'uses');
    this.relate(movementIds['Minimalism'], principleIds['Negative Space'], 'uses');
    this.relate(movementIds['Minimalism'], principleIds['Variety'], 'opposite-of');

    // Artists and their techniques
    this.relate(artistIds['Sol LeWitt'], movementIds['Minimalism'], 'associated-with');
    this.relate(artistIds['Sol LeWitt'], principleIds['Variety'], 'used');

    this.relate(artistIds['Vera Molnar'], movementIds['Generative Art'], 'pioneer-of');
    this.relate(artistIds['Vera Molnar'], techniqueIds['Algorithmic Art'], 'used');

    this.relate(artistIds['Casey Reas'], techniqueIds['Recursion'], 'uses');
    this.relate(artistIds['Casey Reas'], artistIds['Sol LeWitt'], 'influenced-by');

    this.relate(artistIds['Ken Perlin'], techniqueIds['Perlin Noise'], 'invented');

    // Technique relationships
    this.relate(techniqueIds['Perlin Noise'], techniqueIds['Flow Fields'], 'used-in');
    this.relate(techniqueIds['Particle Systems'], techniqueIds['Boids'], 'related-to');
    this.relate(techniqueIds['Fractals'], techniqueIds['L-Systems'], 'related-to');
    this.relate(techniqueIds['Shader Programming'], techniqueIds['Raymarching'], 'used-in');

    // Color theory relationships
    this.relate(colorIds['Complementary'], colorIds['Color Harmony'], 'type-of');
    this.relate(colorIds['Analogous'], colorIds['Color Harmony'], 'type-of');
    this.relate(colorIds['Triadic'], colorIds['Color Harmony'], 'type-of');
    this.relate(colorIds['Warm Colors'], colorIds['Cool Colors'], 'opposite-of');

    // Composition relationships
    this.relate(compositionIds['Golden Ratio'], compositionIds['Rule of Thirds'], 'related-to');
    this.relate(compositionIds['Symmetry'], compositionIds['Asymmetry'], 'opposite-of');
    this.relate(compositionIds['Perspective'], compositionIds['Depth'], 'creates');

    // Principles and techniques
    this.relate(principleIds['Movement'], compositionIds['Leading Lines'], 'uses');
    this.relate(principleIds['Contrast'], colorIds['Value'], 'uses');
    this.relate(principleIds['Pattern'], techniqueIds['Fractals'], 'uses');
    this.relate(principleIds['Unity'], principleIds['Balance'], 'related-to');
  }
}
