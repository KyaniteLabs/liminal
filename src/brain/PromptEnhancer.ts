/**
 * PromptEnhancer - Adds artistic vocabulary and context to generation prompts
 *
 * Uses the comprehensive artistic knowledge base to enhance prompts with:
 * - Domain-specific techniques and terminology
 * - Relevant artistic movements and styles
 * - Design principles and composition concepts
 * - Color theory and visual elements
 * - Artist references and inspiration
 *
 * This makes Liminal a well-rounded artistic creative tool with rich context.
 */

import { SemanticArtMemory } from './SemanticArtMemory.js';
import type { Domain } from './SemanticArtMemory.js';
import { ArtKnowledgeGraph } from './ArtKnowledgeGraph.js';
import { CreativePreferenceExtractor } from './CreativePreferenceExtractor.js';

export interface EnhancementContext {
  domain: Domain;
  intent: string;
  mood?: string;
  techniques?: string[];
  constraints?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
}

export interface EnhancedPrompt {
  prompt: string;
  enhancements: string[];
  techniques: string[];
  principles: string[];
  artists: string[];
}

/**
 * Artistic vocabulary by domain for prompt enhancement
 */
const ARTISTIC_VOCABULARY = {
  p5: {
    elements: ['coordinate systems', 'shape primitives', 'color modes', 'animation', 'interaction'],
    principles: ['generative', 'algorithmic', 'procedural', 'emergent behavior', 'computational design'],
    modifiers: ['organic', 'geometric', 'fluid', 'dynamic', 'responsive', 'evolving'],
  },
  shader: {
    elements: ['raymarching', 'SDFs', 'noise functions', 'FBM', 'domain warping', 'color palettes'],
    principles: ['procedural generation', 'mathematical beauty', 'shader art', 'GLSL techniques'],
    modifiers: ['volumetric', 'iridescent', 'ethereal', 'hypnotic', 'fractal', 'recursive'],
  },
  three: {
    elements: ['scene graph', 'geometries', 'materials', 'lighting', 'cameras', 'post-processing'],
    principles: ['3D composition', 'spatial design', 'immersive experience', 'interactive 3D'],
    modifiers: ['architectural', 'sculptural', 'environmental', 'transformative', 'cinematic'],
  },
  strudel: {
    elements: ['pattern sequencing', 'temporal modulation', 'polyrhythms', 'microtiming', 'harmonic progression'],
    principles: ['algorithmic composition', 'live coding', 'generative music', 'pattern music'],
    modifiers: ['rhythmic', 'harmonic', 'textural', 'evolving', 'modular', 'stochastic'],
  },
  music: {
    elements: ['rhythm', 'melody', 'harmony', 'timbre', 'texture', 'dynamics'],
    principles: ['musical composition', 'counterpoint', 'orchestration', 'arrangement'],
    modifiers: ['rhythmic', 'melodic', 'harmonic', 'textural', 'dynamic', 'expressive'],
  },
  hydra: {
    elements: ['texture modulation', 'feedback loops', 'color manipulation', 'blending', 'audio reactivity'],
    principles: ['visual synthesis', 'live coding visuals', 'real-time video', 'glitch aesthetics'],
    modifiers: ['kaleidoscopic', 'psychedelic', 'glitchy', 'transformative', 'pulsing', 'reactive'],
  },
};

/**
 * Mood-to-artistic-element mappings for context enhancement
 */
const MOOD_ENHANCEMENTS: Record<string, { principles: string[]; techniques: string[]; colors: string[] }> = {
  calm: {
    principles: ['Balance', 'Unity', 'Harmony', 'Negative Space'],
    techniques: ['Gradient', 'Slow Movement', 'Soft Edges', 'Ambient'],
    colors: ['Cool Colors', 'Analogous', 'Low Saturation', 'Soft Pastels'],
  },
  energetic: {
    principles: ['Contrast', 'Movement', 'Variety', 'Emphasis'],
    techniques: ['Fast Animation', 'Rhythm', 'Dynamic Changes', 'Bold Patterns'],
    colors: ['Warm Colors', 'Complementary', 'High Saturation', 'Vibrant'],
  },
  mysterious: {
    principles: ['Depth', 'Asymmetry', 'Figure-Ground', 'Subtle Gradation'],
    techniques: ['Layering', 'Fog', 'Partial Visibility', 'Ambiguity'],
    colors: ['Dark Values', 'Desaturated', 'Monochromatic', 'Subtle Hues'],
  },
  playful: {
    principles: ['Variety', 'Movement', 'Pattern', 'Rhythm'],
    techniques: ['Bright Colors', 'Bounce', 'Whimsical Shapes', 'Interactive'],
    colors: ['Warm Colors', 'Triadic', 'High Saturation', 'Playful Palettes'],
  },
  melancholic: {
    principles: ['Balance', 'Depth', 'Subtle Contrast', 'Restraint'],
    techniques: ['Slow Movement', 'Fading', 'Solitary Elements', 'Minimal'],
    colors: ['Cool Colors', 'Desaturated', 'Muted', 'Monochromatic Blue'],
  },
  abstract: {
    principles: ['Asymmetry', 'Variety', 'Negative Space', 'Non-representational'],
    techniques: ['Geometric Abstraction', 'Color Field', 'Gestural', 'Minimal'],
    colors: ['Bold Contrasts', 'Unexpected Palettes', 'Pure Color', 'Color Field'],
  },
};

/**
 * Technique suggestions by intent keywords
 */
const INTENT_TECHNIQUES: Record<string, string[]> = {
  flow: ['Flow Fields', 'Perlin Noise', 'Particle Systems', 'Fluid Simulation'],
  organic: ['Perlin Noise', 'FBM', 'Organic Shapes', 'Natural Forms', 'Biological Patterns'],
  geometric: ['Geometric Primitives', 'Symmetry', 'Tessellation', 'Grid Systems', 'Mathematical Patterns'],
  abstract: ['Abstract Composition', 'Color Field', 'Non-representational', 'Gesture', 'Process Art'],
  landscape: ['Terrain Generation', 'Sky Simulation', 'Natural Elements', 'Atmospheric Perspective'],
  portrait: ['Face Detection', 'Feature Extraction', 'Stylization', 'Character Design'],
  music: ['Audio Visualization', 'FFT Analysis', 'Rhythm Detection', 'Harmonic Analysis'],
  data: ['Data Visualization', 'Mapping', 'Information Design', 'Statistical Graphics'],
  interactive: ['Mouse Interaction', 'Keyboard Input', 'Gesture Recognition', 'User Response'],
  animation: ['Frame-by-frame', 'Tweening', 'Easing Functions', 'Keyframes', 'Physics Simulation'],
  procedural: ['Procedural Generation', 'Algorithmic Art', 'L-Systems', 'Cellular Automata', 'Fractals'],
  glitch: ['Glitch Effects', 'Distortion', 'Pixel Sorting', 'Data Corruption', 'Artifacting'],
  minimal: ['Minimalism', 'Negative Space', 'Reduction', 'Essential Elements', 'Clean Design'],
  complex: ['Complex Systems', 'Emergence', 'Cellular Automata', 'Agent-Based Modeling', 'Chaos Theory'],
};

/**
 * PromptEnhancer adds artistic vocabulary and context to generation prompts
 */
export class PromptEnhancer {
  private artMemory: SemanticArtMemory;
  private knowledgeGraph: ArtKnowledgeGraph;
  private preferenceExtractor: CreativePreferenceExtractor;

  constructor(artMemory?: SemanticArtMemory) {
    this.artMemory = artMemory || new SemanticArtMemory();
    this.knowledgeGraph = this.artMemory.knowledgeGraph;
    this.preferenceExtractor = new CreativePreferenceExtractor();
  }

  /**
   * Enhance a prompt with artistic context, techniques, and vocabulary
   */
  enhancePrompt(basePrompt: string, context: EnhancementContext): EnhancedPrompt {
    const enhancements: string[] = [];
    const techniques: string[] = [];
    const principles: string[] = [];
    const artists: string[] = [];

    // 1. Add domain-specific vocabulary
    const domainVocab = ARTISTIC_VOCABULARY[context.domain];
    if (domainVocab) {
      const relevantElements = this.selectRelevantElements(basePrompt, domainVocab.elements);
      if (relevantElements.length > 0) {
        enhancements.push(`Consider using: ${relevantElements.join(', ')}`);
      }

      const relevantPrinciples = this.selectRelevantElements(basePrompt, domainVocab.principles);
      if (relevantPrinciples.length > 0) {
        principles.push(...relevantPrinciples);
      }
    }

    // 2. Add mood-specific enhancements
    if (context.mood && MOOD_ENHANCEMENTS[context.mood]) {
      const moodEnhancement = MOOD_ENHANCEMENTS[context.mood];

      // Add principles for mood (directly from mood enhancements)
      for (const principle of moodEnhancement.principles) {
        if (!principles.includes(principle)) {
          principles.push(principle);
        }
      }

      // Add color theory for mood
      const colorConcepts = this.getConceptDetails(moodEnhancement.colors, 'color');
      if (colorConcepts.length > 0) {
        enhancements.push(`Color approach: ${colorConcepts.join(', ')}`);
      }

      // Add techniques for mood
      const moodTechniques = this.getConceptDetails(moodEnhancement.techniques, 'technique');
      techniques.push(...moodTechniques.filter(t => !techniques.includes(t)));
    }

    // 3. Add intent-based technique suggestions
    const intentLower = context.intent.toLowerCase();
    for (const [keyword, techs] of Object.entries(INTENT_TECHNIQUES)) {
      if (intentLower.includes(keyword)) {
        const relevantTechs = this.getDomainTechniques(techs, context.domain);
        techniques.push(...relevantTechs.filter(t => !techniques.includes(t)));
      }
    }

    // 4. Add artist references if relevant
    const relevantArtists = this.getRelevantArtists(context);
    if (relevantArtists.length > 0) {
      // Take top 2-3 most relevant artists
      const topArtists = relevantArtists.slice(0, 3);
      enhancements.push(`Artist reference: Consider approaches by ${topArtists.join(', ')}`);
    }

    // Update artists array for return
    artists.push(...relevantArtists);

    // 5. Add user preference context from CreativePreferenceExtractor
    const extractedPrefs = this.preferenceExtractor.extractFromPrompt(basePrompt);
    if (extractedPrefs.length > 0) {
      const prefSummary = extractedPrefs
        .slice(0, 5)
        .map(p => `${p.category}: ${p.value}`)
        .join(', ');
      enhancements.push(`User preferences detected: ${prefSummary}`);
    }

    // 6. Add design principles based on complexity
    if (context.complexity === 'simple') {
      principles.push('Simplicity', 'Clarity', 'Focus');
    } else if (context.complexity === 'complex') {
      principles.push('Depth', 'Layering', 'Complexity', 'Richness');
    }

    // 7. Build enhanced prompt
    let enhancedPrompt = basePrompt;

    if (enhancements.length > 0 || principles.length > 0 || techniques.length > 0) {
      enhancedPrompt += '\n\n---\nArtistic Context:\n';

      if (techniques.length > 0) {
        enhancedPrompt += `\nTechniques to consider: ${techniques.slice(0, 5).join(', ')}`;
      }

      if (principles.length > 0) {
        enhancedPrompt += `\nDesign principles: ${principles.slice(0, 10).join(', ')}`;
      }

      if (enhancements.length > 0) {
        enhancedPrompt += `\n\nNotes:\n${enhancements.map(e => `- ${e}`).join('\n')}`;
      }
    }

    return {
      prompt: enhancedPrompt,
      enhancements,
      techniques: Array.from(new Set(techniques)),
      principles: Array.from(new Set(principles)),
      artists,
    };
  }

  /**
   * Get domain-specific techniques (filtering for the target domain)
   */
  private getDomainTechniques(techniqueNames: string[], domain: Domain): string[] {
    const domainTechniques = this.knowledgeGraph.query({ type: 'technique', domain });
    const domainTechNames = new Set(domainTechniques.map(t => t.name));

    // Return techniques that match the domain or are domain-agnostic
    return techniqueNames.filter(t =>
      domainTechNames.has(t) || !this.isDomainSpecific(t)
    );
  }

  /**
   * Check if a technique is domain-specific
   */
  private isDomainSpecific(technique: string): boolean {
    const domainSpecific = [
      'raymarching', 'shader', 'glsl', 'webgl', 'vertex', 'fragment',
      'pattern', 'sequencing', 'temporal', 'polyrhythms',
      'texture', 'feedback', 'blend', 'layer',
    ];
    const lower = technique.toLowerCase();
    return domainSpecific.some(d => lower.includes(d));
  }

  /**
   * Select relevant elements from a list based on prompt content
   */
  private selectRelevantElements(prompt: string, elements: string[]): string[] {
    const promptLower = prompt.toLowerCase();
    return elements.filter(e => {
      // Include if not already mentioned in prompt
      return !promptLower.includes(e.toLowerCase());
    });
  }

  /**
   * Get concept details from knowledge graph
   */
  private getConceptDetails(names: string[], _type: string): string[] {
    const details: string[] = [];

    for (const name of names) {
      const concept = this.knowledgeGraph.getConcept(name);
      if (concept && concept.description) {
        details.push(name);
      }
    }

    return details;
  }

  /**
   * Get relevant artists based on context
   */
  private getRelevantArtists(context: EnhancementContext): string[] {
    // Get artists associated with the domain
    const artists = this.knowledgeGraph.query({ type: 'artist' });

    // Score artists by relevance
    const scored = artists.map(artist => {
      let score = 0;

      // Check domain association
      if ((artist as any).domain === context.domain) {
        score += 0.5;
      }

      // Check related concepts for domain match
      const related = this.knowledgeGraph.findRelated(artist.id, 2);
      const domainRelated = related.filter(r => (r as any).domain === context.domain);
      score += domainRelated.length * 0.1;

      // Check for mood alignment in related concepts
      if (context.mood) {
        const moodRelated = related.filter(r =>
          r.description?.toLowerCase().includes(context.mood!.toLowerCase())
        );
        score += moodRelated.length * 0.15;
      }

      // Check for intent alignment
      const intentLower = context.intent.toLowerCase();
      const intentRelated = related.filter(r =>
        r.name.toLowerCase().includes(intentLower) ||
        r.description?.toLowerCase().includes(intentLower)
      );
      score += intentRelated.length * 0.1;

      return { artist, score };
    });

    // Return top artists by relevance
    return scored
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.artist.name);
  }

  /**
   * Get artistic vocabulary for a domain
   */
  getVocabularyForDomain(domain: Domain): { elements: string[]; principles: string[]; modifiers: string[] } {
    return ARTISTIC_VOCABULARY[domain] || {
      elements: [],
      principles: [],
      modifiers: [],
    };
  }

  /**
   * Get mood enhancements
   */
  getMoodEnhancements(mood: string): { principles: string[]; techniques: string[]; colors: string[] } | null {
    return MOOD_ENHANCEMENTS[mood] || null;
  }

  /**
   * Get technique suggestions for an intent
   */
  getTechniquesForIntent(intent: string): string[] {
    const intentLower = intent.toLowerCase();
    const techniques: string[] = [];

    for (const [keyword, techs] of Object.entries(INTENT_TECHNIQUES)) {
      if (intentLower.includes(keyword)) {
        techniques.push(...techs);
      }
    }

    return Array.from(new Set(techniques));
  }
}
