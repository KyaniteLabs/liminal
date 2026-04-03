/**
 * Archived Memory Systems - Compatibility shims
 *
 * EpisodicMemory and SemanticArtMemory have been archived as part of
 * Fix 8: Consolidate Triple Redundancy. Use HarnessMemory instead.
 *
 * These shims redirect to HarnessMemory for backward compatibility
 * during the migration period.
 */

import { harnessMemory, MemoryEpisode } from '../harness/HarnessMemory.js';

const EPISODIC_DEPRECATION = `
[DEPRECATED] EpisodicMemory has been archived as part of Fix 8: Consolidate Triple Redundancy.

Use HarnessMemory instead (available from './harness/index.js'):

  import { harnessMemory } from './harness/index.js';
  
  // Record an episode
  harnessMemory.recordEpisode({
    type: 'conversation',
    prompt: 'User input',
    code: 'Generated code',
  });
  
  // Get recent episodes
  const episodes = harnessMemory.getRecentEpisodes(10);

For more details, see: docs/CONSOLIDATION.md
`;

const SEMANTIC_DEPRECATION = `
[DEPRECATED] SemanticArtMemory has been archived as part of Fix 8: Consolidate Triple Redundancy.

Use HarnessMemory instead (available from './harness/index.js'):

  import { harnessMemory } from './harness/index.js';
  
  // Episodes are stored with domain and tags for semantic retrieval
  harnessMemory.recordEpisode({
    type: 'generation',
    domain: 'p5',
    prompt: 'Creative prompt',
    code: 'Generated code',
    tags: ['particle', 'noise'],
  });
  
  // Get episodes by domain
  const episodes = harnessMemory.getEpisodesByDomain('p5');

For more details, see: docs/CONSOLIDATION.md
`;

/**
 * @deprecated Use HarnessMemory from './harness/index.js' instead.
 * This class provides a compatibility shim that redirects to harnessMemory.
 */
export class EpisodicMemory {
  constructor() {
    console.warn(EPISODIC_DEPRECATION);
  }

  recordConversation(conv: { id: string; messages: unknown[]; updatedAt: Date }): void {
    harnessMemory.recordEpisode({
      type: 'conversation',
      prompt: `Conversation ${conv.id}`,
      tags: ['conversation', conv.id],
    });
  }

  recordGeneration(session: { id: string; prompt: string; code: string; domain: string; score?: number }): void {
    harnessMemory.recordEpisode({
      type: 'generation',
      prompt: session.prompt,
      code: session.code,
      domain: session.domain,
      score: session.score,
      tags: ['generation', session.domain],
    });
  }

  recordFeedback(artworkId: string, rating: number, comment: string): void {
    harnessMemory.recordEpisode({
      type: 'feedback',
      prompt: comment,
      score: rating,
      tags: ['feedback', artworkId],
    });
  }

  recallRecent(limit: number = 10): MemoryEpisode[] {
    return harnessMemory.getRecentEpisodes(limit);
  }

  recallByTag(tag: string): MemoryEpisode[] {
    return harnessMemory.getRecentEpisodes(100).filter(ep => 
      ep.tags?.includes(tag)
    );
  }

  recallByMood(mood: string): MemoryEpisode[] {
    return harnessMemory.getRecentEpisodes(100).filter(ep => 
      ep.tags?.includes(mood)
    );
  }

  searchSimilar(query: string): MemoryEpisode[] {
    return harnessMemory.getRecentEpisodes(100).filter(ep => 
      ep.prompt?.toLowerCase().includes(query.toLowerCase()) ||
      ep.code?.toLowerCase().includes(query.toLowerCase())
    );
  }

  getPreferences(): { preferredMoods: string[]; preferredTechniques: string[]; preferredDomains: Map<string, number> } {
    const episodes = harnessMemory.getRecentEpisodes(100);
    const moods = new Set<string>();
    const techniques = new Set<string>();
    const domainScores = new Map<string, number[]>();

    for (const ep of episodes) {
      if (ep.tags) {
        for (const tag of ep.tags) {
          if (['dreamy', 'surreal', 'melancholy', 'happy', 'calm', 'energetic'].includes(tag)) {
            moods.add(tag);
          }
          if (['minimalist', 'abstract', 'geometric'].includes(tag)) {
            techniques.add(tag);
          }
        }
      }
      if (ep.domain && ep.score !== undefined) {
        if (!domainScores.has(ep.domain)) {
          domainScores.set(ep.domain, []);
        }
        domainScores.get(ep.domain)!.push(ep.score);
      }
    }

    const preferredDomains = new Map<string, number>();
    for (const [domain, scores] of domainScores.entries()) {
      preferredDomains.set(domain, scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    return {
      preferredMoods: Array.from(moods),
      preferredTechniques: Array.from(techniques),
      preferredDomains,
    };
  }

  async save(_filePath: string): Promise<void> {
    // HarnessMemory auto-saves, no-op for compatibility
    return Promise.resolve();
  }

  async load(_filePath: string): Promise<void> {
    // HarnessMemory auto-loads, no-op for compatibility
    return Promise.resolve();
  }
}

/**
 * @deprecated Use HarnessMemory from './harness/index.js' instead.
 * This class provides a compatibility shim that redirects to harnessMemory.
 */
export class SemanticArtMemory {
  private episodicMemory: EpisodicMemory;

  constructor() {
    console.warn(SEMANTIC_DEPRECATION);
    this.episodicMemory = new EpisodicMemory();
  }

  getArtworksByConcept(concept: string): unknown[] {
    return this.episodicMemory.recallByTag(concept).map(ep => ({
      id: ep.id,
      code: ep.code,
      domain: ep.domain,
      concepts: ep.tags,
      timestamp: new Date(ep.timestamp),
    }));
  }

  getArtworksByMood(mood: string): unknown[] {
    return this.episodicMemory.recallByMood(mood).map(ep => ({
      id: ep.id,
      code: ep.code,
      domain: ep.domain,
      mood,
      timestamp: new Date(ep.timestamp),
    }));
  }

  suggestInspiration(_context: { domain: string; intent: string; mood: string; concepts: string[] }): unknown[] {
    // Return recent episodes as inspiration
    return harnessMemory.getRecentEpisodes(10).map(ep => ({
      type: 'past-work',
      title: `Previous ${ep.domain || 'artwork'}`,
      description: ep.prompt || 'No description',
      relevance: 0.5,
    }));
  }

  suggestTechnique(goal: string): unknown[] {
    return [{
      name: goal,
      domain: 'p5',
      description: `Technique for ${goal}`,
      keywords: [goal],
    }];
  }

  rememberArtwork(artwork: { id: string; code: string; domain: string; score?: number }, concepts: string[], reaction: string): void {
    harnessMemory.recordEpisode({
      type: 'generation',
      prompt: reaction,
      code: artwork.code,
      domain: artwork.domain,
      score: artwork.score,
      tags: concepts,
    });
  }
}

// Re-export for compatibility
export { MemoryEpisode as Episode };
