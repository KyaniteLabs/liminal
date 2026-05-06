import type { SwarmPersona, SwarmOutput, SwarmConfig, Vote } from './types.js';
import { PromptLibrary } from '../prompts/index.js';

interface VotingResult {
  scores: Map<string, number>;
  winnerId: string;
  votes: Map<string, Vote>;
}

/**
 * Performance record for an expert in a specific domain
 */
export interface ExpertPerformance {
  expertId: string;
  domain: string;
  correctVotes: number;
  totalVotes: number;
  lastUpdated: Date;
}

/**
 * VotingEngine with learned calibration.
 * 
 * Tracks per-expert performance history and weights votes by historical accuracy.
 * Experts with better track records in specific domains have more voting power.
 */
export class VotingEngine {
  // Static storage for performance history (in-memory, per-process)
  private static performanceHistory: Map<string, ExpertPerformance> = new Map();
  
  // Default weight for experts with no history
  private static readonly DEFAULT_ACCURACY = 0.5;

  /**
   * Get the performance key for an expert-domain pair
   */
  private static getPerformanceKey(expertId: string, domain: string): string {
    return `${expertId}:${domain}`;
  }

  /**
   * Record a voting outcome for calibration.
   * Should be called after external validation determines the "correct" winner.
   * 
   * @param expertId The expert who cast the vote
   * @param domain The domain/topic of the prompt (e.g., 'geometric', 'organic')
   * @param votedFor The expert ID that was voted for
   * @param actualWinner The expert ID that actually won (ground truth)
   */
  static recordOutcome(
    expertId: string,
    domain: string,
    votedFor: string,
    actualWinner: string
  ): void {
    const key = this.getPerformanceKey(expertId, domain);
    const existing = this.performanceHistory.get(key);
    
    const isCorrect = votedFor === actualWinner;
    
    if (existing) {
      existing.correctVotes += isCorrect ? 1 : 0;
      existing.totalVotes += 1;
      existing.lastUpdated = new Date();
    } else {
      this.performanceHistory.set(key, {
        expertId,
        domain,
        correctVotes: isCorrect ? 1 : 0,
        totalVotes: 1,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Get the calibrated accuracy for an expert in a domain.
   * Uses Laplace smoothing to handle sparse data.
   * 
   * @param expertId The expert to check
   * @param domain The domain to check
   * @returns Accuracy score between 0 and 1
   */
  static getExpertAccuracy(expertId: string, domain: string): number {
    const key = this.getPerformanceKey(expertId, domain);
    const record = this.performanceHistory.get(key);
    
    if (!record || record.totalVotes === 0) {
      return this.DEFAULT_ACCURACY;
    }
    
    // Laplace smoothing: (correct + 1) / (total + 2)
    // This prevents 0% or 100% accuracy with few samples
    return (record.correctVotes + 1) / (record.totalVotes + 2);
  }

  /**
   * Get the calibrated voting weight for an expert.
   * Weight = basePower * (2 * accuracy) to range from 0 to 2x base power
   * 
   * @param expert The expert persona
   * @param domain The current domain
   * @returns Calibrated voting weight
   */
  static getCalibratedWeight(expert: SwarmPersona, domain: string): number {
    const accuracy = this.getExpertAccuracy(expert.id, domain);
    // Scale: 0.5 accuracy -> 1x weight, 1.0 accuracy -> 2x weight
    const calibrationFactor = 2 * accuracy;
    return expert.votingPower * calibrationFactor;
  }

  /**
   * Infer domain from prompt content using keyword matching.
   * Simple heuristic for domain detection.
   * 
   * @param prompt The prompt to analyze
   * @returns Detected domain string
   */
  static inferDomain(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    
    const domainKeywords: Record<string, string[]> = {
      geometric: ['geometric', 'grid', 'lines', 'shapes', 'circles', 'minimal', 'bauhaus'],
      organic: ['nature', 'organic', 'flowing', 'water', 'plants', 'leaves', 'fluid'],
      mathematical: ['fractal', 'math', 'recursive', 'fibonacci', 'spiral', 'mandala'],
      interactive: ['interactive', 'physics', 'gravity', 'collision', 'mouse', 'drag'],
      audio: ['audio', 'music', 'sound', 'frequency', 'beat', 'rhythm', 'synth'],
    };
    
    let bestDomain = 'general';
    let bestScore = 0;
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      const score = keywords.filter(kw => promptLower.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }
    
    return bestDomain;
  }

  /**
   * Get all performance records for debugging/analysis
   */
  static getAllPerformanceRecords(): ExpertPerformance[] {
    return Array.from(this.performanceHistory.values());
  }

  /**
   * Clear all performance history (for testing)
   */
  static clearPerformanceHistory(): void {
    this.performanceHistory.clear();
  }

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
   * Applies calibrated weights based on historical performance.
   * 
   * @param outputs The outputs to vote on
   * @param personas The voting personas (experts)
   * @param roundNum The current round number
   * @param _config Swarm configuration
   * @param callOllama Optional Ollama caller
   * @param prompt Optional prompt for domain inference (used for calibration)
   */
  static async conductVoting(
    outputs: Map<string, SwarmOutput>,
    personas: SwarmPersona[],
    _roundNum: number,
    _config: SwarmConfig,
    callOllama?: (model: string, systemPrompt: string, userPrompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>,
    prompt?: string
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
    
    // Infer domain for calibration
    const domain = prompt ? this.inferDomain(prompt) : 'general';

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
        // Build the voting prompt
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
              // All voters use same temperature - differentiation from system prompts
              temperature: 0.7,
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

    // Tally scores with calibrated weights
    const scores = new Map<string, number>();
    for (const persona of personas) {
      scores.set(persona.id, 0);
    }

    for (const [voterId, vote] of votes) {
      const voter = personas.find(p => p.id === voterId);
      if (!voter) continue;
      
      // Get calibrated weight based on historical performance
      const calibratedWeight = this.getCalibratedWeight(voter, domain);

      if (vote.firstChoice) {
        scores.set(vote.firstChoice, (scores.get(vote.firstChoice) ?? 0) + calibratedWeight * 2);
      }
      if (vote.secondChoice) {
        scores.set(vote.secondChoice, (scores.get(vote.secondChoice) ?? 0) + calibratedWeight * 1);
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

    if (maxScore <= 0) {
      // Local/lightweight models often return unparseable vote text. In that
      // case, preserve a viable generation instead of electing an error marker.
      const viableOutput = [...outputs.values()].find(output =>
        output.content.trim().length > 0 && !output.content.startsWith('[Generation error')
      );
      winnerId = viableOutput?.personaId ?? winnerId;
    }

    return { scores, winnerId, votes };
  }

  /**
   * Calibrate the voting engine based on a session result.
   * Should be called after a session completes and ground truth is known.
   * 
   * @param result The swarm result to learn from
   * @param groundTruthWinner The expert ID that was determined to be best (e.g., by human review)
   * @param prompt The original prompt for domain inference
   */
  static calibrateFromResult(
    result: { rounds: Array<{ votes: Map<string, Vote> }> },
    groundTruthWinner: string,
    prompt: string
  ): void {
    const domain = this.inferDomain(prompt);
    
    // Record outcomes from each round
    for (const round of result.rounds) {
      for (const [voterId, vote] of round.votes) {
        if (vote.firstChoice) {
          this.recordOutcome(voterId, domain, vote.firstChoice, groundTruthWinner);
        }
      }
    }
  }
}
