import type { SwarmConfig, SwarmMode, SwarmOutput, SwarmResult, RoundResult, SwarmPersona, Vote } from './types.js';
import type { ProjectDNA } from '../scavenger/types.js';
import type { MinedFragment } from './types.js';
import { DEFAULT_PERSONAS } from './personas.js';
import { DEFAULT_REFINEMENT_CONSTRAINTS } from './types.js';
import { VotingEngine } from './VotingEngine.js';
import { HeuristicScorer } from './HeuristicScorer.js';
import { MiningEngine } from './MiningEngine.js';
import { SERVICE_DEFAULTS } from '../constants.js';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export interface SwarmOrchestratorOptions {
  callOllama?: (model: string, prompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>;
  onProgress?: (data: { round: number; totalRounds: number; winnerId: string | null; converged: boolean }) => void;
  onFragmentsMined?: (fragments: MinedFragment[]) => void;
}

/**
 * Swarm orchestrator — multi-model collaborative generation.
 *
 * Designed for Ollama's multi-model concurrent API (`/api/generate` format).
 * The default `callOllama` callback uses Ollama's native format. LM Studio can
 * be used via a custom callback that adapts the OpenAI-compatible format, but
 * multi-model diversity (different personas calling different models) requires
 * Ollama.
 */
export class SwarmOrchestrator {
  private config: SwarmConfig;
  private personas: SwarmPersona[];
  private callOllama: (model: string, prompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>;
  private dna: ProjectDNA | null = null;

  /**
   * Pre-load DNA for domain knowledge injection into swarm prompts.
   */
  setDNA(dna: ProjectDNA | null): void {
    this.dna = dna;
  }

  constructor(config?: Partial<SwarmConfig>, options?: SwarmOrchestratorOptions) {
    this.config = {
      ollamaHost: config?.ollamaHost ?? SERVICE_DEFAULTS.OLLAMA_URL,
      ollamaTimeout: config?.ollamaTimeout ?? 60,
      maxRounds: config?.maxRounds ?? 10,
      convergenceThreshold: config?.convergenceThreshold ?? 3,
      musicalChairs: config?.musicalChairs ?? true,
      mode: config?.mode ?? 'hybrid' as SwarmMode,
      personas: config?.personas ?? DEFAULT_PERSONAS,
      refinementConstraints: config?.refinementConstraints ?? DEFAULT_REFINEMENT_CONSTRAINTS,
      streamDir: config?.streamDir ?? './stream',
    };
    this.personas = [...this.config.personas];

    // Default Ollama caller
    this.callOllama = options?.callOllama ?? this.defaultOllamaCaller.bind(this);

    // Set progress callback from options
    this._onProgress = options?.onProgress;
    this._onFragmentsMined = options?.onFragmentsMined;
  }

  private async defaultOllamaCaller(
    model: string,
    prompt: string,
    options?: { temperature?: number; num_predict?: number }
  ): Promise<string> {
    const url = `${this.config.ollamaHost}/api/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.num_predict ?? 100,
        },
      }),
      signal: AbortSignal.timeout(this.config.ollamaTimeout * 1000),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { response?: string };
    return data.response ?? '';
  }

  /**
   * Main entry point: run the full swarm evolution.
   */
  async run(prompt: string, mode?: SwarmMode): Promise<SwarmResult> {
    const startTime = Date.now();
    const effectiveMode = mode ?? this.config.mode;
    let currentSeed = prompt;
    const rounds: RoundResult[] = [];
    const prevWinnerOutputs: string[] = [];
    let consecutiveWins = 0;
    let lastWinner: string | null = null;
    let converged = false;
    let convergenceRound: number | null = null;

    // Musical chairs: randomize model-to-persona assignments
    if (this.config.musicalChairs) {
      this.shuffleMusicalChairs();
    }

    // Enrich seed with domain knowledge from DNA if available
    if (this.dna) {
      currentSeed = `${currentSeed}\n\n---\nDomain Knowledge:\n${this.dna.coreLogic}\n\nConstraints: ${this.dna.constraints.join('; ')}`;
    }

    for (let roundNum = 1; roundNum <= this.config.maxRounds; roundNum++) {
      // Pick a constraint for this round
      const constraint = this.config.refinementConstraints[
        (roundNum - 1) % this.config.refinementConstraints.length
      ];

      // Run round
      const isFinalRound = roundNum === this.config.maxRounds;
      const result = await this.runRound(currentSeed, roundNum, effectiveMode, constraint, isFinalRound, prevWinnerOutputs);
      rounds.push(result);

      // Track winner output for novelty scoring in future rounds
      if (result.winnerContent) {
        prevWinnerOutputs.push(result.winnerContent);
      }

      // Check convergence (competitive and hybrid modes only)
      if (effectiveMode === 'competitive' || effectiveMode === 'hybrid') {
        if (result.winnerId === lastWinner) {
          consecutiveWins++;
          if (consecutiveWins >= this.config.convergenceThreshold) {
            converged = true;
            convergenceRound = roundNum;
            break;
          }
        } else {
          consecutiveWins = 1;
          lastWinner = result.winnerId;
        }
      }

      // Select next seed
      currentSeed = this.selectNextSeed(result, effectiveMode, constraint);

      // Progress callback
      this.onProgress?.({
        round: roundNum,
        totalRounds: this.config.maxRounds,
        winnerId: result.winnerId,
        converged,
      });
    }

    // Collect all outputs
    const allOutputs: SwarmOutput[] = [];
    for (const round of rounds) {
      for (const output of round.outputs.values()) {
        allOutputs.push(output);
      }
    }

    const finalOutput = rounds.length > 0 ? rounds[rounds.length - 1].winnerContent : '';

    const result: SwarmResult = {
      rounds,
      converged,
      convergenceRound,
      finalOutput,
      totalDurationMs: Date.now() - startTime,
      mode: effectiveMode,
      allOutputs,
    };

    // Save session
    await this.saveSession(result);

    // Auto-mine fragments from the session
    const fragments = MiningEngine.mineResult(result);
    if (fragments.length > 0) {
      this._onFragmentsMined?.(fragments);
    }

    return result;
  }

  /**
   * Run a single round: generate from all personas, conduct voting.
   * Uses HeuristicScorer for non-final rounds, VotingEngine for final round only.
   */
  async runRound(
    seed: string,
    roundNum: number,
    mode: SwarmMode,
    constraint: string,
    isFinalRound: boolean,
    prevWinnerOutputs: string[]
  ): Promise<RoundResult> {
    const effectiveSeed = `${seed}\n\nConstraint: ${constraint}`;

    // Generate outputs
    let outputs: Map<string, SwarmOutput>;
    if (mode === 'ring') {
      outputs = await this.generateRing(effectiveSeed, roundNum);
    } else {
      // competitive, hybrid, mesh all use parallel generation
      outputs = await this.generateParallel(effectiveSeed, roundNum);
    }

    // Conduct voting: heuristic for early rounds, LLM for final round only
    let votingResult: { scores: Map<string, number>; winnerId: string; votes: Map<string, Vote> };

    if (isFinalRound) {
      votingResult = await VotingEngine.conductVoting(
        outputs,
        this.personas,
        roundNum,
        this.config,
        this.callOllama
      );
    } else {
      votingResult = HeuristicScorer.score(
        outputs,
        this.personas,
        constraint,
        prevWinnerOutputs
      );
    }

    const winnerOutput = outputs.get(votingResult.winnerId);

    return {
      roundNum,
      seed,
      outputs,
      votes: votingResult.votes,
      scores: votingResult.scores,
      winnerId: votingResult.winnerId,
      winnerContent: winnerOutput?.content ?? '',
      constraint,
    };
  }

  /**
   * Generate from all personas in parallel (competitive/hybrid/mesh).
   */
  private async generateParallel(seed: string, roundNum: number): Promise<Map<string, SwarmOutput>> {
    const outputs = new Map<string, SwarmOutput>();
    const promises = this.personas.map(async (persona) => {
      const startTime = Date.now();
      try {
        const fullPrompt = `${persona.systemPrompt}\n\nPrompt: ${seed}\n\n${persona.constraints.map(c => `Constraint: ${c}`).join('\n')}`;

        const content = await this.callOllama(persona.model, fullPrompt, {
          temperature: persona.temperature,
          num_predict: persona.maxTokens,
        });

        outputs.set(persona.id, {
          personaId: persona.id,
          personaName: persona.displayName,
          content: content.trim(),
          model: persona.model,
          tokensUsed: content.length, // Approximate
          latencyMs: Date.now() - startTime,
          roundNum,
        });
      } catch (error) {
        outputs.set(persona.id, {
          personaId: persona.id,
          personaName: persona.displayName,
          content: `[Generation error: ${error instanceof Error ? error.message : 'unknown'}]`,
          model: persona.model,
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          roundNum,
        });
      }
    });

    await Promise.all(promises);
    return outputs;
  }

  /**
   * Generate sequentially in a ring: each persona sees previous output.
   */
  private async generateRing(seed: string, roundNum: number): Promise<Map<string, SwarmOutput>> {
    const outputs = new Map<string, SwarmOutput>();
    let currentChain = seed;

    for (const persona of this.personas) {
      const startTime = Date.now();
      try {
        const chainContext = currentChain.length > 300 ? currentChain.slice(-300) : currentChain;
        const fullPrompt = `${persona.systemPrompt}\n\nContext from previous outputs:\n${chainContext}\n\n${persona.constraints.map(c => `Constraint: ${c}`).join('\n')}`;

        const content = await this.callOllama(persona.model, fullPrompt, {
          temperature: persona.temperature,
          num_predict: persona.maxTokens,
        });

        outputs.set(persona.id, {
          personaId: persona.id,
          personaName: persona.displayName,
          content: content.trim(),
          model: persona.model,
          tokensUsed: content.length,
          latencyMs: Date.now() - startTime,
          roundNum,
        });

        currentChain += `\n\n${persona.displayName}: ${content.trim()}`;
      } catch (error) {
        outputs.set(persona.id, {
          personaId: persona.id,
          personaName: persona.displayName,
          content: `[Generation error: ${error instanceof Error ? error.message : 'unknown'}]`,
          model: persona.model,
          tokensUsed: 0,
          latencyMs: Date.now() - startTime,
          roundNum,
        });
      }
    }

    return outputs;
  }

  /**
   * Select the next seed based on mode and round result.
   */
  private selectNextSeed(result: RoundResult, mode: SwarmMode, constraint: string): string {
    if (mode === 'competitive') {
      // Winner's output seeds next round
      return `Rewrite this: ${result.winnerContent}\n\nConstraint: ${constraint}`;
    }

    if (mode === 'hybrid') {
      // Top 2 scoring outputs combined
      const sortedScores = [...result.scores.entries()].sort((a, b) => b[1] - a[1]);
      const topOutputs = sortedScores.slice(0, 2).map(([personaId]) => result.outputs.get(personaId)?.content ?? '');
      const combined = topOutputs.join('\n\n---\n\n');
      return `Synthesize and evolve these ideas into one cohesive piece:\n\n${combined}\n\nConstraint: ${constraint}`;
    }

    if (mode === 'ring') {
      // Full chain becomes the seed
      const chainParts: string[] = [];
      for (const output of result.outputs.values()) {
        chainParts.push(`${output.personaName}: ${output.content}`);
      }
      return `Continue evolving this chain:\n\n${chainParts.join('\n\n')}\n\nConstraint: ${constraint}`;
    }

    // Mesh: hybrid-like but with all top fragments
    const sortedScores = [...result.scores.entries()].sort((a, b) => b[1] - a[1]);
    const topOutputs = sortedScores.slice(0, 3).map(([personaId]) => result.outputs.get(personaId)?.content ?? '');
    const combined = topOutputs.join('\n\n---\n\n');
    return `Weave these fragments into something new:\n\n${combined}\n\nConstraint: ${constraint}`;
  }

  /**
   * Musical chairs: randomly reassign models to personas.
   */
  private shuffleMusicalChairs(): void {
    const models = this.personas.map(p => p.model);
    // Fisher-Yates shuffle
    for (let i = models.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [models[i], models[j]] = [models[j], models[i]];
    }
    for (let i = 0; i < this.personas.length; i++) {
      this.personas[i] = { ...this.personas[i], model: models[i] };
    }
  }

  /**
   * Save session to stream directory.
   */
  private async saveSession(result: SwarmResult): Promise<void> {
    try {
      await fs.mkdir(this.config.streamDir, { recursive: true });

      const sessionId = new Date()
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 15);

      const sessionData = {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        total_rounds: result.rounds.length,
        final_output: result.finalOutput,
        converged: result.converged,
        mode: result.mode,
        total_duration_ms: result.totalDurationMs,
        rounds: result.rounds.map(round => ({
          round_num: round.roundNum,
          seed: round.seed,
          outputs: Object.fromEntries(
            [...round.outputs.entries()].map(([id, out]) => [id, {
              persona_id: out.personaId,
              persona_name: out.personaName,
              content: out.content,
              model: out.model,
              tokens_used: out.tokensUsed,
              latency_ms: out.latencyMs,
              round_num: out.roundNum,
            }])
          ),
          votes: Object.fromEntries(
            [...round.votes.entries()].map(([id, vote]) => [id, {
              voter_id: vote.voterId,
              first_choice: vote.firstChoice,
              second_choice: vote.secondChoice,
              reasoning: vote.reasoning,
            }])
          ),
          scores: Object.fromEntries(round.scores.entries()),
          winner_id: round.winnerId,
          winner_content: round.winnerContent,
          constraint: round.constraint,
        })),
      };

      const filePath = path.join(this.config.streamDir, `evolution_${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
    } catch (err) {
      // Session saving is best-effort
      Logger.warn('SwarmOrchestrator', `Failed to save swarm session: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Public getter for onProgress (set after construction)
  private _onProgress?: (data: { round: number; totalRounds: number; winnerId: string | null; converged: boolean }) => void;
  private _onFragmentsMined?: (fragments: MinedFragment[]) => void;

  get onProgress() { return this._onProgress; }
  set onProgress(fn: ((data: { round: number; totalRounds: number; winnerId: string | null; converged: boolean }) => void) | undefined) {
    this._onProgress = fn;
  }
}
