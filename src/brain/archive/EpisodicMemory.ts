import fs from 'fs/promises';

export interface Episode {
  id: string;
  timestamp: Date;
  type: 'conversation' | 'generation' | 'feedback';
  content: unknown;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationSession {
  id: string;
  prompt: string;
  code: string;
  domain: string;
  score?: number;
  timestamp: Date;
}

export interface UserPreferences {
  preferredMoods: string[];
  preferredTechniques: string[];
  preferredDomains: Map<string, number>; // domain -> average score
}

export class EpisodicMemory {
  private episodes: Episode[];
  private conversations: Map<string, Conversation>;
  private generations: Map<string, GenerationSession>;

  constructor() {
    this.episodes = [];
    this.conversations = new Map();
    this.generations = new Map();
  }

  /**
   * Record a conversation episode
   */
  recordConversation(conv: Conversation): void {
    this.conversations.set(conv.id, conv);

    const episode: Episode = {
      id: `episode-conv-${conv.id}`,
      timestamp: conv.updatedAt,
      type: 'conversation',
      content: conv
    };

    this.episodes.push(episode);
    this.sortEpisodes();
  }

  /**
   * Record a generation session episode
   */
  recordGeneration(session: GenerationSession): void {
    this.generations.set(session.id, session);

    const episode: Episode = {
      id: `episode-gen-${session.id}`,
      timestamp: session.timestamp,
      type: 'generation',
      content: session
    };

    this.episodes.push(episode);
    this.sortEpisodes();
  }

  /**
   * Record a feedback episode
   */
  recordFeedback(artworkId: string, rating: number, comment: string): void {
    const episode: Episode = {
      id: `episode-feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'feedback',
      content: {
        artworkId,
        rating,
        comment
      }
    };

    this.episodes.push(episode);
    this.sortEpisodes();
  }

  /**
   * Recall recent episodes
   */
  recallRecent(limit: number = 10): Episode[] {
    return this.episodes.slice(0, limit);
  }

  /**
   * Recall episodes by tag (searches for #tag in content)
   */
  recallByTag(tag: string): Episode[] {
    const tagPattern = new RegExp(`#${tag}`, 'i');

    return this.episodes.filter(episode => {
      const content = this.extractTextContent(episode.content);
      return tagPattern.test(content);
    });
  }

  /**
   * Recall episodes by mood (searches for #mood in content)
   */
  recallByMood(mood: string): Episode[] {
    const moodPattern = new RegExp(`#${mood}`, 'i');

    return this.episodes.filter(episode => {
      const content = this.extractTextContent(episode.content);
      return moodPattern.test(content);
    });
  }

  /**
   * Search episodes with similar content
   */
  searchSimilar(query: string): Episode[] {
    const lowerQuery = query.toLowerCase();

    return this.episodes.filter(episode => {
      const content = this.extractTextContent(episode.content).toLowerCase();
      return content.includes(lowerQuery);
    });
  }

  /**
   * Get aggregated user preferences from feedback and generations
   */
  getPreferences(): UserPreferences {
    const preferences: UserPreferences = {
      preferredMoods: [],
      preferredTechniques: [],
      preferredDomains: new Map()
    };

    // Extract preferences from feedback episodes
    const feedbackEpisodes = this.episodes.filter(e => e.type === 'feedback');

    for (const episode of feedbackEpisodes) {
      const feedback = episode.content as { artworkId: string; rating: number; comment: string };

      // Only consider high-rated feedback (7+)
      if (feedback.rating >= 7) {
        const hashtags = this.extractHashtags(feedback.comment);

        for (const tag of hashtags) {
          // Simple heuristic: mood-related tags
          const moodKeywords = ['mood', 'atmosphere', 'feeling', 'vibe', 'dreamy', 'surreal', 'melancholy', 'happy', 'calm', 'energetic'];
          if (moodKeywords.some(keyword => tag.toLowerCase().includes(keyword))) {
            if (!preferences.preferredMoods.includes(tag)) {
              preferences.preferredMoods.push(tag);
            }
          }

          // Technique-related tags
          const techniqueKeywords = ['technique', 'style', 'brushwork', 'watercolor', 'impasto', 'minimalist', 'abstract', 'geometric'];
          if (techniqueKeywords.some(keyword => tag.toLowerCase().includes(keyword))) {
            if (!preferences.preferredTechniques.includes(tag)) {
              preferences.preferredTechniques.push(tag);
            }
          }
        }
      }
    }

    // Aggregate domain scores from generations
    const domainScores = new Map<string, number[]>();

    for (const episode of this.episodes) {
      if (episode.type === 'generation') {
        const gen = episode.content as GenerationSession;

        if (gen.score !== undefined) {
          if (!domainScores.has(gen.domain)) {
            domainScores.set(gen.domain, []);
          }
          domainScores.get(gen.domain)!.push(gen.score);
        }
      }
    }

    // Calculate average scores per domain
    for (const [domain, scores] of domainScores.entries()) {
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      preferences.preferredDomains.set(domain, avgScore);
    }

    return preferences;
  }

  /**
   * Save episodes to file
   */
  async save(filePath: string): Promise<void> {
    const data = {
      episodes: this.episodes.map(episode => ({
        ...episode,
        timestamp: episode.timestamp.toISOString()
      })),
      conversations: Array.from(this.conversations.entries()).map(([id, conv]) => [
        id,
        {
          ...conv,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString()
        }
      ]),
      generations: Array.from(this.generations.entries()).map(([id, gen]) => [
        id,
        {
          ...gen,
          timestamp: gen.timestamp.toISOString()
        }
      ])
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Load episodes from file
   */
  async load(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Restore episodes
    this.episodes = (data.episodes as Array<Record<string, unknown>>).map((ep) => ({
      ...(ep as unknown as Episode),
      timestamp: new Date(ep.timestamp as string)
    }));

    // Restore conversations
    this.conversations = new Map(
      (data.conversations as Array<[string, Record<string, unknown>]>).map(([id, conv]) => [
        id,
        {
          ...(conv as unknown as Conversation),
          createdAt: new Date(conv.createdAt as string),
          updatedAt: new Date(conv.updatedAt as string)
        }
      ])
    );

    // Restore generations
    this.generations = new Map(
      (data.generations as Array<[string, Record<string, unknown>]>).map(([id, gen]) => [
        id,
        {
          ...(gen as unknown as GenerationSession),
          timestamp: new Date(gen.timestamp as string)
        }
      ])
    );

    this.sortEpisodes();
  }

  /**
   * Helper: Extract text content from episode for searching
   */
  private extractTextContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>;
      const texts: string[] = [];

      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          texts.push(value);
        } else if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string') {
              texts.push(item);
            } else if (typeof item === 'object' && item !== null) {
              texts.push(this.extractTextContent(item));
            }
          }
        }
      }

      return texts.join(' ');
    }

    return '';
  }

  /**
   * Helper: Extract hashtags from text
   */
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  /**
   * Helper: Sort episodes by timestamp (most recent first)
   */
  private sortEpisodes(): void {
    this.episodes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
