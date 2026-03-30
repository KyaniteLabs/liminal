import type { SwarmPersona, SwarmOutput, SwarmConfig, Vote } from './types.js';
import { PromptLibrary } from '../prompts/index.js';

interface VotingResult {
  scores: Map<string, number>;
  winnerId: string;
  votes: Map<string, Vote>;
}

export class VotingEngine {
  /**
   * Parse vote text to extract first choice, second choice, and reasoning.
   * Looks for patterns like "1st: A", "first choice: B", "2nd: C", etc.
   * Falls back to finding any letter A-G in the text.
   */
  static parseVote(
    voteText: string,
    candidateMap: Map<string, string>,
    maxLetter: string = 'G'
  ): { first: string | null; second: string | null; reasoning: string } {
    const regex = `[A-${maxLetter}]`;

    // Try structured patterns first
    const firstMatch = voteText.match(new RegExp(`1st(?:\\s*choice)?[:\\s]+(${regex})`, 'i'));
    const secondMatch = voteText.match(new RegExp(`2nd(?:\\s*choice)?[:\\s]+(${regex})`, 'i'));

    let first = firstMatch ? candidateMap.get(firstMatch[1].toUpperCase()) ?? null : null;
    const second = secondMatch ? candidateMap.get(secondMatch[1].toUpperCase()) ?? null : null;

    // Fallback: find any letter in text
    if (!first) {
      for (let i = 65; i <= maxLetter.charCodeAt(0); i++) {
        const letter = String.fromCharCode(i);
        if (voteText.toUpperCase().includes(letter)) {
          first = candidateMap.get(letter) ?? null;
          break;
        }
      }
    }

    // Extract reasoning (last non-empty line)
    const lines = voteText.trim().split('\n').filter(l => l.trim().length > 0);
    const reasoning = lines.length > 0 ? lines[lines.length - 1].trim() : 'No reasoning provided';

    return { first, second, reasoning };
  }

  /**
   * Conduct voting: ask each persona to vote on the outputs.
   * Uses Ollama API to get each persona's vote.
   */
  static async conductVoting(
    outputs: Map<string, SwarmOutput>,
    personas: SwarmPersona[],
    _roundNum: number,
    _config: SwarmConfig,
    callOllama?: (model: string, systemPrompt: string, userPrompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>
  ): Promise<VotingResult> {
    // Build candidate map (A, B, C...)
    const candidateMap = new Map<string, string>();
    const candidatesText: string[] = [];
    let idx = 0;

    for (const [personaId, output] of outputs) {
      const letter = String.fromCharCode(65 + idx);
      candidateMap.set(letter, personaId);
      candidatesText.push(`Piece ${letter} (${personaId}): ${output.content}`);
      idx++;
    }

    const candidatesStr = candidatesText.join('\n\n');
    const votes = new Map<string, Vote>();

    // If no Ollama caller provided, return placeholder (for testing)
    if (!callOllama) {
      // Fallback: first output wins with equal votes
      const firstPersonaId = outputs.keys().next().value ?? '';
      for (const voter of personas) {
        votes.set(voter.id, {
          voterId: voter.id,
          firstChoice: firstPersonaId,
          secondChoice: '',
          reasoning: 'Fallback vote (no Ollama connection)',
        });
      }
      const scores = new Map<string, number>();
      scores.set(firstPersonaId, personas.reduce((sum, p) => sum + p.votingPower * 2, 0));
      return { scores, winnerId: firstPersonaId, votes };
    }

    // Ask each persona to vote (in parallel)
    const results = await Promise.all(
      personas.filter(v => outputs.has(v.id)).map(async voter => {
        // Build the voting prompt (same as before)
        const rendered = PromptLibrary.render('swarm.voting', {
          displayName: voter.displayName,
          voice: voter.voice,
          votingBias: voter.votingBias,
          candidates: candidatesStr,
        });

        try {
          const voteText = await callOllama(
            voter.model,
            rendered.system,
            rendered.user,
            {
              temperature: voter.temperature,
              num_predict: voter.maxTokens,
            }
          );

          const parsed = this.parseVote(voteText, candidateMap);

          return [voter.id, {
            voterId: voter.id,
            firstChoice: parsed.first ?? '',
            secondChoice: parsed.second ?? '',
            reasoning: parsed.reasoning,
          }] as const;
        } catch (error) {
          return [voter.id, {
            voterId: voter.id,
            firstChoice: '',
            secondChoice: '',
            reasoning: `Voting error: ${error instanceof Error ? error.message : 'unknown'}`,
          }] as const;
        }
      })
    );

    for (const [id, vote] of results) {
      votes.set(id, vote);
    }

    // Tally scores: first choice = votingPower * 2, second choice = votingPower * 1
    const scores = new Map<string, number>();
    for (const persona of personas) {
      scores.set(persona.id, 0);
    }

    for (const [voterId, vote] of votes) {
      const power = personas.find(p => p.id === voterId)?.votingPower ?? 1;

      if (vote.firstChoice) {
        scores.set(vote.firstChoice, (scores.get(vote.firstChoice) ?? 0) + power * 2);
      }
      if (vote.secondChoice) {
        scores.set(vote.secondChoice, (scores.get(vote.secondChoice) ?? 0) + power * 1);
      }
    }

    // Find winner
    let winnerId = '';
    let maxScore = -1;
    for (const [personaId, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        winnerId = personaId;
      }
    }

    return { scores, winnerId, votes };
  }
}
