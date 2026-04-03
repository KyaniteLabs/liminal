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
 * 
 * Consolidated as part of Fix 8: Triple Redundancy - Now uses HarnessMemory.
 */

import { ArtKnowledgeGraph } from './ArtKnowledgeGraph.js';
// Note: CreativePreferenceExtractor not used in consolidated version
import { harnessMemory } from '../harness/HarnessMemory.js';

export type Domain = 'p5' | 'shader' | 'three' | 'music' | 'hydra' | 'strudel';

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
const ARTISTIC_VOCABULARY: Record<Domain, { elements: string[]; principles: string[]; modifiers: string[] }> = {
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
 * 
 * Consolidated: Now uses HarnessMemory instead of SemanticArtMemory.
 */
export class PromptEnhancer {
  private knowledgeGraph: ArtKnowledgeGraph;

  constructor() {
    this.knowledgeGraph = new ArtKnowledgeGraph();
    this.knowledgeGraph.loadSeedData();
  }

  /**
   * Enhance a prompt with artistic context, techniques, and vocabulary
   */
  enhancePrompt(basePrompt: string, context: EnhancementContext): EnhancedPrompt {
    const enhancements: string[] = [];
    const techniques: string[] = [];
    const principles: string[] = [];
    const artists: string[] = [];

    // Get vocabulary for the domain
    const vocab = ARTISTIC_VOCABULARY[context.domain];
    if (vocab) {
      // Add relevant elements
      const relevantElements = this.selectRelevantItems(vocab.elements, context.intent, 2);
      enhancements.push(...relevantElements.map(e => `${e} techniques`));

      // Add principles
      const relevantPrinciples = this.selectRelevantItems(vocab.principles, context.intent, 2);
      principles.push(...relevantPrinciples);

      // Add modifiers based on mood or complexity
      if (context.mood) {
        const moodMods = vocab.modifiers.filter(m => 
          this.isMoodRelated(m, context.mood!)
        );
        enhancements.push(...moodMods.slice(0, 2));
      }
    }

    // Add mood-specific enhancements
    if (context.mood && MOOD_ENHANCEMENTS[context.mood]) {
      const moodData = MOOD_ENHANCEMENTS[context.mood];
      principles.push(...moodData.principles.slice(0, 2));
      techniques.push(...moodData.techniques.slice(0, 2));
      enhancements.push(...moodData.colors.slice(0, 2));
    }

    // Add intent-based techniques
    for (const [keyword, techs] of Object.entries(INTENT_TECHNIQUES)) {
      if (context.intent.toLowerCase().includes(keyword)) {
        techniques.push(...techs.slice(0, 2));
      }
    }
    if (context.techniques) {
      techniques.push(...context.techniques);
    }

    // Get artist references from knowledge graph
    const relevantArtists = this.findRelevantArtists(context);
    artists.push(...relevantArtists.slice(0, 3));

    // Get recent inspiration from HarnessMemory
    const recentEpisodes = harnessMemory.getRecentEpisodes(5);
    if (recentEpisodes.length > 0) {
      const recentDomains = new Set(recentEpisodes.map(ep => ep.domain).filter(Boolean));
      if (recentDomains.has(context.domain)) {
        enhancements.push(`building on previous ${context.domain} work`);
      }
    }

    // Build the enhanced prompt
    const enhancementText = this.buildEnhancementText(enhancements, techniques, principles, artists);
    const enhancedPrompt = `${basePrompt}\n\n${enhancementText}`;

    return {
      prompt: enhancedPrompt,
      enhancements,
      techniques: [...new Set(techniques)],
      principles: [...new Set(principles)],
      artists: [...new Set(artists)],
    };
  }

  /**
   * Select items from a list that are relevant to the given intent
   */
  private selectRelevantItems(items: string[], intent: string, count: number): string[] {
    const intentWords = intent.toLowerCase().split(/\s+/);
    
    // Score each item by how many intent words it matches
    const scored = items.map(item => {
      const itemLower = item.toLowerCase();
      const score = intentWords.reduce((acc, word) => {
        return acc + (itemLower.includes(word) ? 1 : 0);
      }, 0);
      return { item, score };
    });

    // Sort by score and select top items
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.item);
  }

  /**
   * Check if a modifier is related to a mood
   */
  private isMoodRelated(modifier: string, mood: string): boolean {
    const moodMap: Record<string, string[]> = {
      calm: ['fluid', 'organic', 'soft'],
      energetic: ['dynamic', 'responsive', 'evolving'],
      mysterious: ['ethereal', 'hypnotic', 'transformative'],
      playful: ['dynamic', 'responsive', 'evolving'],
      melancholic: ['organic', 'fluid', 'ethereal'],
      abstract: ['geometric', 'fractal', 'recursive'],
    };

    const relatedModifiers = moodMap[mood] || [];
    return relatedModifiers.some(m => modifier.includes(m));
  }

  /**
   * Find relevant artists from the knowledge graph
   */
  private findRelevantArtists(context: EnhancementContext): string[] {
    const artists: string[] = [];
    
    // Query the knowledge graph for relevant concepts
    const concepts = this.knowledgeGraph.query({ type: 'movement' });
    
    for (const concept of concepts) {
      if (this.isRelevantToContext(concept.name, context)) {
        // Find related artists
        const related = this.knowledgeGraph.findRelated(concept.id, 2);
        for (const rel of related) {
          if (rel.type === 'artist') {
            artists.push(rel.name);
          }
        }
      }
    }

    return artists;
  }

  /**
   * Check if a concept is relevant to the context
   */
  private isRelevantToContext(conceptName: string, context: EnhancementContext): boolean {
    const contextText = `${context.intent} ${context.mood || ''} ${context.techniques?.join(' ') || ''}`.toLowerCase();
    return contextText.includes(conceptName.toLowerCase()) ||
           conceptName.toLowerCase().split(/\s+/).some(word => contextText.includes(word));
  }

  /**
   * Build the enhancement text to append to the prompt
   */
  private buildEnhancementText(
    enhancements: string[],
    techniques: string[],
    principles: string[],
    artists: string[]
  ): string {
    const parts: string[] = [];

    if (techniques.length > 0) {
      parts.push(`Techniques: ${techniques.slice(0, 4).join(', ')}.`);
    }

    if (principles.length > 0) {
      parts.push(`Design principles: ${principles.slice(0, 3).join(', ')}.`);
    }

    if (enhancements.length > 0) {
      parts.push(`Consider: ${enhancements.slice(0, 4).join(', ')}.`);
    }

    if (artists.length > 0) {
      parts.push(`Artistic references: ${artists.slice(0, 3).join(', ')}.`);
    }

    return parts.join(' ');
  }

  /**
   * Extract domain-specific suggestions based on recent memory
   */
  getDomainSuggestions(domain: Domain, limit: number = 3): string[] {
    const suggestions: string[] = [];
    
    // Get recent episodes for this domain from HarnessMemory
    const episodes = harnessMemory.getRecentEpisodes(20)
      .filter(ep => ep.domain === domain);
    
    if (episodes.length > 0) {
      // Extract common tags
      const tagCounts = new Map<string, number>();
      for (const ep of episodes) {
        for (const tag of ep.tags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      
      // Sort by frequency and return top suggestions
      const sorted = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
      
      suggestions.push(...sorted.map(([tag]) => tag));
    }

    // Add default suggestions from vocabulary if needed
    if (suggestions.length < limit) {
      const vocab = ARTISTIC_VOCABULARY[domain];
      if (vocab) {
        suggestions.push(...vocab.elements.slice(0, limit - suggestions.length));
      }
    }

    return suggestions;
  }
}
