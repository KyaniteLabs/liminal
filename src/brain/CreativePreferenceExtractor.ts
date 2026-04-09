/**
 * CreativePreferenceExtractor - Extract creative preferences from prompts
 */

export interface Preference {
  category: 'style' | 'color' | 'mood' | 'technique' | 'domain';
  value: string;
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationResult {
  preferences: Preference[];
  profileCompleteness: number;
}

export interface DominantProfile {
  style?: string;
  color?: string;
  mood?: string;
  technique?: string;
}

export class CreativePreferenceExtractor {
  private preferences: Preference[] = [];

  private readonly styleKeywords = [
    'minimalist', 'abstract', 'geometric', 'organic', 'glitch', 'retro',
    'futuristic', 'grunge', 'elegant', 'chaotic', 'structured', 'fluid',
  ];

  private readonly colorKeywords = [
    'warm', 'cool', 'vibrant', 'muted', 'pastel', 'neon', 'dark', 'bright',
    'monochrome', 'colorful', 'red', 'blue', 'green', 'yellow', 'purple',
  ];

  private readonly moodKeywords = [
    'calm', 'energetic', 'melancholic', 'joyful', 'tense', 'relaxed',
    'aggressive', 'peaceful', 'mysterious', 'playful', 'serious', 'whimsical',
  ];

  extractFromPrompt(prompt: string): Preference[] {
    const lowerPrompt = prompt.toLowerCase();
    const extracted: Preference[] = [];

    // Extract style preferences
    for (const keyword of this.styleKeywords) {
      if (lowerPrompt.includes(keyword)) {
        extracted.push({
          category: 'style',
          value: keyword,
          confidence: 0.8,
        });
      }
    }

    // Extract color preferences
    for (const keyword of this.colorKeywords) {
      if (lowerPrompt.includes(keyword)) {
        extracted.push({
          category: 'color',
          value: keyword,
          confidence: 0.75,
        });
      }
    }

    // Extract mood preferences
    for (const keyword of this.moodKeywords) {
      if (lowerPrompt.includes(keyword)) {
        extracted.push({
          category: 'mood',
          value: keyword,
          confidence: 0.7,
        });
      }
    }

    this.preferences.push(...extracted);
    return extracted;
  }

  extractFromConversation(messages: ConversationMessage[]): ConversationResult {
    const allPrefs: Preference[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        const prefs = this.extractFromPrompt(message.content);
        allPrefs.push(...prefs);
      }
    }

    // Calculate profile completeness (0-1)
    const categories = new Set(allPrefs.map(p => p.category));
    const completeness = Math.min(1, categories.size / 3);

    return {
      preferences: allPrefs,
      profileCompleteness: completeness,
    };
  }

  getDominantProfile(): DominantProfile {
    const byCategory = new Map<string, Preference[]>();

    for (const pref of this.preferences) {
      const existing = byCategory.get(pref.category) || [];
      existing.push(pref);
      byCategory.set(pref.category, existing);
    }

    const profile: DominantProfile = {};

    for (const [category, prefs] of byCategory) {
      // Sort by confidence descending
      const sorted = prefs.sort((a, b) => b.confidence - a.confidence);
      if (sorted.length > 0) {
        profile[category as keyof DominantProfile] = sorted[0].value;
      }
    }

    return profile;
  }

  getPreferences(): Preference[] {
    return [...this.preferences].sort((a, b) => b.confidence - a.confidence);
  }
}
