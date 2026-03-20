import type { MinedFragment, SwarmOutput, SwarmResult } from './types.js';

interface SessionData {
  session_id: string;
  rounds: Array<{
    round_num: number;
    winner_id?: string | null;
    winner_content?: string;
    outputs?: Record<string, {
      persona_id?: string;
      content?: string;
    }>;
    seed?: string;
  }>;
}

const PERSONA_BONUSES: Record<string, number> = {
  kai: 1,
  nova: 1,
  rex: 1,
  sam: 2,
  max: 1,
};

const SENSORY_WORDS = [
  'color', 'sound', 'light', 'shadow', 'scent', 'taste', 'touch',
  'warmth', 'cold', 'texture', 'shimmer', 'glow', 'echo', 'pulse',
];

const METAPHOR_WORDS = [
  'like', 'as if', 'became', 'was a', 'were', 'emerged', 'folded', 'echoed',
  'crystal', 'ocean', 'mirror', 'flame', 'stone', 'river', 'wind',
];

export class MiningEngine {
  /**
   * Mine a session for high-quality fragments.
   * Scoring: base 5 (winner) + persona bonus + mode bonus + sensory words + metaphor words + length bonus
   */
  static mineSession(
    sessionData: SessionData,
    threshold: number = 7,
    mode: string = 'hybrid'
  ): MinedFragment[] {
    const fragments: MinedFragment[] = [];

    for (const round of sessionData.rounds) {
      const winnerId = round.winner_id;
      const winnerContent = round.winner_content ?? '';

      if (!winnerContent.trim()) continue;

      // Base score: 5 for being winner
      let score = 5;

      // Persona bonus
      if (winnerId) {
        score += PERSONA_BONUSES[winnerId] ?? 0;
      }

      // Mode bonus
      if (mode === 'hybrid') {
        score += 1;
      }

      // Sensory words bonus (+1 each)
      const lowerContent = winnerContent.toLowerCase();
      for (const word of SENSORY_WORDS) {
        if (lowerContent.includes(word)) {
          score += 1;
        }
      }

      // Metaphor words bonus (+1 each)
      for (const word of METAPHOR_WORDS) {
        if (lowerContent.includes(word)) {
          score += 1;
        }
      }

      // Length bonus: 50-300 chars = +2 (emergence favors compression)
      if (winnerContent.length > 50 && winnerContent.length < 300) {
        score += 2;
      }

      if (score >= threshold) {
        const truncatedText = winnerContent.length > 500
          ? winnerContent.slice(0, 500) + '...'
          : winnerContent;

        fragments.push({
          id: `${sessionData.session_id}_r${round.round_num}`,
          text: truncatedText,
          source: sessionData.session_id,
          round: round.round_num,
          persona: winnerId ?? 'unknown',
          score,
          mode,
          tags: [winnerId ?? 'unknown', mode],
          sessionPrompt: round.seed ?? '',
          extractedAt: new Date().toISOString(),
        });
      }
    }

    return fragments;
  }

  /**
   * Mine a SwarmResult (in-memory) for fragments.
   */
  static mineResult(
    result: SwarmResult,
    threshold: number = 7
  ): MinedFragment[] {
    const sessionData: SessionData = {
      session_id: `swarm_${Date.now()}`,
      rounds: result.rounds.map(round => ({
        round_num: round.roundNum,
        winner_id: round.winnerId,
        winner_content: round.winnerContent,
        seed: round.seed,
      })),
    };

    return this.mineSession(sessionData, threshold, result.mode);
  }

  /**
   * Hybridize 2-3 fragments from different personas into a synthesis seed.
   */
  static hybridize(fragments: MinedFragment[]): string {
    if (fragments.length === 0) return '';
    if (fragments.length === 1) return fragments[0].text;

    // Filter to at most 3 fragments from different personas
    const seenPersonas = new Set<string>();
    const selected: MinedFragment[] = [];
    for (const frag of fragments) {
      if (!seenPersonas.has(frag.persona) && selected.length < 3) {
        seenPersonas.add(frag.persona);
        selected.push(frag);
      }
    }

    if (selected.length === 0) return fragments[0].text;

    const parts = selected.map(f => f.text);
    return `Synthesize and evolve these fragments into one cohesive piece:\n\n${parts.join('\n\n---\n\n')}`;
  }

  /**
   * Find interesting glitches/failed outputs from a round.
   * These are outputs that are unusual in interesting ways — not just errors.
   */
  static findGlitches(outputs: Map<string, SwarmOutput>): SwarmOutput[] {
    const glitches: SwarmOutput[] = [];

    for (const output of outputs.values()) {
      const content = output.content.toLowerCase();
      const reasons: string[] = [];

      // Safety triggers (model refused)
      if (content.includes('i cannot') || content.includes('i\'m sorry') || content.includes('i am not able')) {
        reasons.push('safety-trigger');
      }

      // Degenerate repetition
      const words = content.split(/\s+/);
      const wordFreq = new Map<string, number>();
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
      const maxFreq = Math.max(...wordFreq.values());
      if (maxFreq > words.length * 0.4 && words.length > 10) {
        reasons.push('degenerate-repetition');
      }

      // Interesting contradictions (contains both "is" and "is not" near each other)
      if (/is\s+not|isn't|cannot be/.test(content) && /is\s|becomes|will be/.test(content)) {
        reasons.push('contradiction');
      }

      // Very short output (possibly truncated or model struggling)
      if (content.length < 20 && content.length > 0) {
        reasons.push('truncated');
      }

      // Very long output (model went off the rails)
      if (content.length > 500) {
        reasons.push('overflow');
      }

      if (reasons.length > 0) {
        glitches.push({
          ...output,
          content: `[GLITCH: ${reasons.join(', ')}] ${output.content}`,
        });
      }
    }

    return glitches;
  }
}
