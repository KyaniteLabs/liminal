import { ArtKnowledgeGraph, Concept } from './ArtKnowledgeGraph.js';
import { EpisodicMemory, GenerationSession } from './EpisodicMemory.js';

export type Domain = 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel';

export interface Artwork {
  id: string;
  code: string;
  domain: Domain;
  timestamp: Date;
  score?: number;
  concepts: string[];
  mood?: string;
}

export interface CreativeContext {
  domain: Domain;
  intent: string;
  mood: string;
  concepts: string[];
}

export interface Inspiration {
  type: 'past-work' | 'style-reference' | 'technique-suggestion';
  title: string;
  description: string;
  relevance: number;
}

export interface Technique {
  name: string;
  domain: Domain;
  description: string;
  keywords: string[];
}

/**
 * SemanticArtMemory combines the ArtKnowledgeGraph and EpisodicMemory
 * to provide intelligent retrieval and suggestion capabilities.
 *
 * It integrates:
 * - Knowledge graph: Concepts, relationships, techniques, artists
 * - Episodic memory: Past artworks, user reactions, preferences
 *
 * This enables semantic search, inspiration suggestions, and technique recommendations.
 */
export class SemanticArtMemory {
  knowledgeGraph: ArtKnowledgeGraph;
  episodicMemory: EpisodicMemory;
  private artworkCache: Map<string, Artwork>;

  constructor() {
    this.knowledgeGraph = new ArtKnowledgeGraph();
    this.episodicMemory = new EpisodicMemory();
    this.artworkCache = new Map();

    // Load seed data into knowledge graph
    this.knowledgeGraph.loadSeedData();
  }

  /**
   * Get artworks by concept, including related concepts
   */
  getArtworksByConcept(concept: string): Artwork[] {
    const matchingArtworks: Artwork[] = [];
    const conceptLower = concept.toLowerCase();

    // Find the concept in the knowledge graph
    const graphConcept = this.knowledgeGraph.getConcept(concept);

    // Get related concepts for expanded search
    const relatedConcepts = graphConcept
      ? this.knowledgeGraph.findRelated(graphConcept.id, 2)
      : [];

    // Collect all concept names to match (including related)
    const conceptNames = new Set<string>([conceptLower]);
    conceptNames.add(concept);
    if (graphConcept) {
      conceptNames.add(graphConcept.name.toLowerCase());
    }
    for (const related of relatedConcepts) {
      conceptNames.add(related.name.toLowerCase());
    }

    // Search through all cached artworks
    for (const artwork of this.artworkCache.values()) {
      for (const artworkConcept of artwork.concepts) {
        if (conceptNames.has(artworkConcept.toLowerCase())) {
          matchingArtworks.push(artwork);
          break;
        }
      }
    }

    return matchingArtworks;
  }

  /**
   * Get artworks by mood
   */
  getArtworksByMood(mood: string): Artwork[] {
    const moodLower = mood.toLowerCase();
    const matchingArtworks: Artwork[] = [];

    for (const artwork of this.artworkCache.values()) {
      if (artwork.mood && artwork.mood.toLowerCase() === moodLower) {
        matchingArtworks.push(artwork);
      }
    }

    return matchingArtworks;
  }

  /**
   * Suggest inspiration based on creative context
   * Combines past works, artist references, and technique suggestions
   */
  suggestInspiration(context: CreativeContext): Inspiration[] {
    const inspirations: Inspiration[] = [];

    // 1. Past work suggestions from episodic memory
    const pastArtworks = this.getRelevantArtworks(context);
    for (const artwork of pastArtworks) {
      inspirations.push({
        type: 'past-work',
        title: `Previous ${artwork.domain} artwork`,
        description: `Artwork from ${artwork.timestamp.toLocaleDateString()} using ${artwork.concepts.join(', ')}`,
        relevance: this.calculateRelevance(artwork, context)
      });
    }

    // 2. Style references from knowledge graph
    const styleConcepts = this.knowledgeGraph.query({ type: 'movement' });
    for (const style of styleConcepts) {
      if (this.isStyleRelevant(style, context)) {
        inspirations.push({
          type: 'style-reference',
          title: style.name,
          description: style.description || `${style.type} artistic approach`,
          relevance: this.calculateStyleRelevance(style, context)
        });
      }
    }

    // 3. Technique suggestions from knowledge graph
    const techniqueConcepts = this.knowledgeGraph.query({ type: 'technique' });
    for (const technique of techniqueConcepts) {
      if (this.isTechniqueRelevant(technique, context)) {
        const relevance = this.calculateTechniqueRelevance(technique, context);
        inspirations.push({
          type: 'technique-suggestion',
          title: technique.name,
          description: technique.metadata?.description as string || `Technique for creating ${technique.name.toLowerCase()} effects`,
          relevance
        });
      }
    }

    // Sort by relevance and return top results
    return inspirations
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);
  }

  /**
   * Suggest techniques based on a goal
   */
  suggestTechnique(goal: string): Technique[] {
    const goalLower = goal.toLowerCase();
    const goalWords = goalLower.split(/\s+/).filter(w => w.length > 2);
    const techniques: Technique[] = [];

    // Get technique concepts from knowledge graph
    const techniqueConcepts = this.knowledgeGraph.query({ type: 'technique' });

    for (const concept of techniqueConcepts) {
      // Check if technique is relevant to goal
      const nameMatch = concept.name.toLowerCase().includes(goalLower) ||
                        goalLower.includes(concept.name.toLowerCase());

      const description = (concept.metadata?.description as string) || '';
      const descMatch = description.toLowerCase().includes(goalLower);

      // Check related concepts for relevance
      const related = this.knowledgeGraph.findRelated(concept.id, 1);
      const relatedMatch = related.some(r =>
        r.name.toLowerCase().includes(goalLower) ||
        goalWords.some(word => r.name.toLowerCase().includes(word))
      );

      // Also check if any goal word matches the technique name
      const wordMatch = goalWords.some(word =>
        concept.name.toLowerCase().includes(word) ||
        word.includes(concept.name.toLowerCase())
      );

      if (nameMatch || descMatch || relatedMatch || wordMatch) {
        // Determine domain for this technique
        const domain = this.inferDomainForTechnique(concept);

        techniques.push({
          name: concept.name,
          domain,
          description: description || `A technique for creating ${concept.name.toLowerCase()} effects`,
          keywords: [concept.name, ...related.map(r => r.name)]
        });
      }
    }

    return techniques;
  }

  /**
   * Remember an artwork with associated concepts and user reaction
   */
  rememberArtwork(
    artwork: Artwork,
    concepts: string[],
    reaction: string
  ): void {
    // Store in cache for quick lookup
    this.artworkCache.set(artwork.id, artwork);

    // Record as generation episode in episodic memory with reaction
    const session: GenerationSession = {
      id: artwork.id,
      prompt: reaction, // Use reaction as the prompt context
      code: artwork.code,
      domain: artwork.domain,
      score: artwork.score,
      timestamp: artwork.timestamp
    };

    this.episodicMemory.recordGeneration(session);

    // Record feedback episode if reaction is provided
    if (reaction && artwork.score !== undefined) {
      this.episodicMemory.recordFeedback(
        artwork.id,
        artwork.score,
        reaction
      );
    }

    // Ensure concepts exist in knowledge graph
    for (const concept of concepts) {
      const graphConcept = this.knowledgeGraph.getConcept(concept);
      if (!graphConcept) {
        // Add concept if it doesn't exist
        this.knowledgeGraph.addConcept(concept, 'technique');
      }
    }
  }

  /**
   * Get relevant artworks based on context
   */
  private getRelevantArtworks(context: CreativeContext): Artwork[] {
    const relevant: Artwork[] = [];

    for (const artwork of this.artworkCache.values()) {
      // Match by domain
      if (artwork.domain !== context.domain) {
        continue;
      }

      // Match by concepts
      const hasMatchingConcept = artwork.concepts.some(ac =>
        context.concepts.some(cc =>
          cc.toLowerCase() === ac.toLowerCase() ||
          ac.toLowerCase().includes(cc.toLowerCase())
        )
      );

      // Match by mood
      const moodMatches = !context.mood ||
        (artwork.mood && artwork.mood.toLowerCase() === context.mood.toLowerCase());

      if (hasMatchingConcept || moodMatches) {
        relevant.push(artwork);
      }
    }

    // Sort by score (highest first)
    return relevant.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Calculate relevance score for an artwork
   */
  private calculateRelevance(artwork: Artwork, context: CreativeContext): number {
    let relevance = 0;

    // Domain match
    if (artwork.domain === context.domain) {
      relevance += 0.3;
    }

    // Concept overlap
    const conceptOverlap = artwork.concepts.filter(ac =>
      context.concepts.some(cc =>
        cc.toLowerCase() === ac.toLowerCase() ||
        ac.toLowerCase().includes(cc.toLowerCase())
      )
    ).length;

    relevance += Math.min(conceptOverlap * 0.3, 0.6);

    // Mood match
    if (artwork.mood && artwork.mood.toLowerCase() === context.mood.toLowerCase()) {
      relevance += 0.2;
    }

    // Score bonus
    if (artwork.score && artwork.score >= 8) {
      relevance += 0.1;
    }

    return Math.min(relevance, 1);
  }

  /**
   * Check if style is relevant to context
   */
  private isStyleRelevant(style: Concept, context: CreativeContext): boolean {
    // For movement types (artistic styles), be very lenient - they provide general inspiration
    if (style.type === 'movement') {
      // Temporary: always return true for movement types until proper relationship loading is implemented
      return true;
    }

    // General logic for all types
    const styleText = [
      style.name,
      ...(style.keywords || []),
      style.description || ''
    ].join(' ').toLowerCase();

    const contextText = [
      ...context.concepts,
      context.intent,
      context.mood
    ].join(' ').toLowerCase();

    // Check for any word overlap (minimum 4 characters)
    const contextWords = contextText.split(/\s+/).filter(w => w.length >= 4);
    for (const word of contextWords) {
      if (styleText.includes(word)) {
        return true;
      }
    }

    // Check related concepts
    const related = this.knowledgeGraph.findRelated(style.id, 2);
    if (related.length > 0) {
      return related.some(r =>
        context.concepts.some(cc => r.name.toLowerCase().includes(cc.toLowerCase())) ||
        r.name.toLowerCase().includes(context.intent.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Calculate style relevance to context
   */
  private calculateStyleRelevance(style: Concept, context: CreativeContext): number {
    const related = this.knowledgeGraph.findRelated(style.id, 2);
    let relevance = 0.3; // Base relevance for being a style

    // Check for concept matches
    const conceptMatches = related.filter(r =>
      context.concepts.some(cc =>
        r.name.toLowerCase().includes(cc.toLowerCase())
      )
    ).length;

    relevance += Math.min(conceptMatches * 0.2, 0.4);

    // Check for intent matches
    const intentMatches = related.filter(r =>
      r.name.toLowerCase().includes(context.intent.toLowerCase()) ||
      context.intent.toLowerCase().includes(r.name.toLowerCase())
    ).length;

    relevance += Math.min(intentMatches * 0.15, 0.3);

    return Math.min(relevance, 1);
  }

  /**
   * Check if technique is relevant to context
   */
  private isTechniqueRelevant(technique: Concept, context: CreativeContext): boolean {
    const techniqueLower = technique.name.toLowerCase();
    const descriptionLower = (technique.description || '').toLowerCase();
    const keywords = (technique.keywords || []) as string[];
    const keywordsLower = keywords.map(k => k.toLowerCase());

    // Check if technique matches context concepts (name, description, or keywords)
    const matchesConcept = context.concepts.some(cc => {
      const ccLower = cc.toLowerCase();
      return techniqueLower.includes(ccLower) ||
             ccLower.includes(techniqueLower) ||
             descriptionLower.includes(ccLower) ||
             keywordsLower.some(k => k.includes(ccLower) || ccLower.includes(k));
    });

    // Check if technique matches intent (name, description, or keywords)
    const intentLower = context.intent.toLowerCase();
    const matchesIntent = techniqueLower.includes(intentLower) ||
                          intentLower.includes(techniqueLower) ||
                          descriptionLower.includes(intentLower) ||
                          keywordsLower.some(k => intentLower.includes(k) || k.includes(intentLower));

    // Check related concepts
    const related = this.knowledgeGraph.findRelated(technique.id, 1);
    const relatedMatches = related.some(r =>
      context.concepts.some(cc =>
        r.name.toLowerCase().includes(cc.toLowerCase())
      )
    );

    return matchesConcept || matchesIntent || relatedMatches;
  }

  /**
   * Calculate technique relevance to context
   */
  private calculateTechniqueRelevance(technique: Concept, context: CreativeContext): number {
    let relevance = 0.3; // Base relevance (increased from 0.2)

    const techniqueLower = technique.name.toLowerCase();
    const descriptionLower = (technique.description || '').toLowerCase();
    const keywords = (technique.keywords || []) as string[];
    const keywordsLower = keywords.map(k => k.toLowerCase());

    // Concept match bonus (including keywords and description)
    const conceptMatch = context.concepts.some(cc => {
      const ccLower = cc.toLowerCase();
      return techniqueLower.includes(ccLower) ||
             ccLower.includes(techniqueLower) ||
             descriptionLower.includes(ccLower) ||
             keywordsLower.some(k => k.includes(ccLower) || ccLower.includes(k));
    });
    if (conceptMatch) {
      relevance += 0.35;
    }

    // Intent match bonus (including keywords and description)
    const intentLower = context.intent.toLowerCase();
    const intentMatch = techniqueLower.includes(intentLower) ||
                        intentLower.includes(techniqueLower) ||
                        descriptionLower.includes(intentLower) ||
                        keywordsLower.some(k => intentLower.includes(k) || k.includes(intentLower));
    if (intentMatch) {
      relevance += 0.25;
    }

    // Related concepts bonus
    const related = this.knowledgeGraph.findRelated(technique.id, 1);
    const relatedMatch = related.some(r =>
      context.concepts.some(cc =>
        r.name.toLowerCase().includes(cc.toLowerCase())
      )
    );
    if (relatedMatch) {
      relevance += 0.1;
    }

    return Math.min(relevance, 1);
  }

  /**
   * Infer domain for a technique based on its properties and relationships
   */
  private inferDomainForTechnique(technique: Concept): Domain {
    const nameLower = technique.name.toLowerCase();
    const description = (technique.metadata?.description as string || '').toLowerCase();

    // Shader/GLSL techniques
    if (nameLower.includes('shader') || nameLower.includes('glsl') ||
        nameLower.includes('raymarching') || nameLower.includes('fragment') ||
        description.includes('shader') || description.includes('glsl')) {
      return 'shader';
    }

    // 3D techniques
    if (nameLower.includes('3d') || nameLower.includes('three') ||
        nameLower.includes('geometry') || nameLower.includes('mesh') ||
        description.includes('3d') || description.includes('three.js')) {
      return 'three';
    }

    // Music techniques
    if (nameLower.includes('music') || nameLower.includes('audio') ||
        nameLower.includes('sound') || nameLower.includes('melody') ||
        nameLower.includes('rhythm') || nameLower.includes('harmony') ||
        description.includes('music') || description.includes('audio')) {
      return 'music';
    }

    // Hydra techniques
    if (nameLower.includes('hydra') || nameLower.includes('video synth') ||
        description.includes('hydra')) {
      return 'hydra';
    }

    // Strudel techniques
    if (nameLower.includes('strudel') || nameLower.includes('pattern') ||
        description.includes('strudel')) {
      return 'strudel';
    }

    // Default to p5
    return 'p5';
  }
}
