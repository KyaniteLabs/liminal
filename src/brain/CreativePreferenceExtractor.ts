export type PreferenceCategory = 'style' | 'color' | 'mood' | 'domain' | 'effect';

export interface CreativePreference {
  category: PreferenceCategory;
  value: string;
  confidence: number;
  evidence: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
}

export interface ConversationPreferenceResult {
  preferences: CreativePreference[];
  profileCompleteness: number;
}

export interface DominantCreativeProfile {
  style?: string;
  color?: string;
  mood?: string;
  domain?: string;
  effect?: string;
}

const LEXICON: Record<PreferenceCategory, readonly string[]> = {
  style: ['minimalist', 'geometric', 'abstract', 'glitch', 'cinematic', 'playful'],
  color: ['warm', 'cool', 'dark', 'bright', 'monochrome', 'vibrant'],
  mood: ['calm', 'energetic', 'dreamy', 'chaotic', 'moody'],
  domain: ['p5', 'shader', 'glsl', 'three', 'hydra', 'strudel', 'ascii'],
  effect: ['particles', 'noise', 'flow', 'mirror', 'kaleidoscope'],
};

export class CreativePreferenceExtractor {
  private readonly preferences: CreativePreference[] = [];

  extractFromPrompt(prompt: string): CreativePreference[] {
    const found = inferPreferences(prompt);
    this.merge(found);
    return found;
  }

  extractFromConversation(messages: ConversationMessage[]): ConversationPreferenceResult {
    const userText = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');
    const preferences = this.extractFromPrompt(userText);
    const representedCategories = new Set(this.preferences.map((preference) => preference.category));
    return {
      preferences,
      profileCompleteness: representedCategories.size / Object.keys(LEXICON).length,
    };
  }

  getPreferences(): CreativePreference[] {
    return [...this.preferences].sort((a, b) => b.confidence - a.confidence);
  }

  getDominantProfile(): DominantCreativeProfile {
    const profile: DominantCreativeProfile = {};
    for (const preference of this.getPreferences()) {
      if (profile[preference.category] === undefined) {
        profile[preference.category] = preference.value;
      }
    }
    return profile;
  }

  private merge(next: CreativePreference[]): void {
    for (const preference of next) {
      const existing = this.preferences.find(
        (candidate) => candidate.category === preference.category && candidate.value === preference.value,
      );
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence + preference.confidence * 0.25);
        existing.evidence = preference.evidence;
      } else {
        this.preferences.push({ ...preference });
      }
    }
  }
}

function inferPreferences(text: string): CreativePreference[] {
  const lower = text.toLowerCase();
  const preferences: CreativePreference[] = [];
  for (const [category, terms] of Object.entries(LEXICON) as Array<[PreferenceCategory, readonly string[]]>) {
    for (const term of terms) {
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`).test(lower)) {
        preferences.push({
          category,
          value: term,
          confidence: confidenceFor(category, term),
          evidence: term,
        });
      }
    }
  }
  return preferences.sort((a, b) => b.confidence - a.confidence);
}

function confidenceFor(category: PreferenceCategory, term: string): number {
  const directDomain = category === 'domain' && ['p5', 'glsl', 'three', 'hydra', 'strudel', 'ascii'].includes(term);
  return directDomain ? 0.95 : 0.75;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
