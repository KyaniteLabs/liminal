import type { SwarmConfig, SwarmMode, SwarmOutput, SwarmResult, RoundResult, SwarmPersona, Vote } from './types.js';
import type { ProjectDNA } from '../scavenger/types.js';
import type { MinedFragment } from './types.js';
import { DEFAULT_PERSONAS } from './personas.js';
import { DEFAULT_REFINEMENT_CONSTRAINTS } from './types.js';
import { ALL_EXPERTS, type ExpertDescription } from './ExpertPersonas.js';
import { VotingEngine } from './VotingEngine.js';
import { HeuristicScorer } from './HeuristicScorer.js';
import { MiningEngine } from './MiningEngine.js';
import { SERVICE_DEFAULTS } from '../constants.js';
import { TIMEOUT_DEFAULT_MS, TOKEN_LIMIT_LARGE, TRUNCATE_MEDIUM } from '../constants/limits.js';
import { SymbolicCreativeLanguage, type CreativeSymbol } from '../brain/SymbolicCreativeLanguage.js';
import { RoutineChannel, type ChannelConfig } from './RoutineChannel.js';
import { eventBus, EventTypes } from '../core/EventBus.js';
import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/Logger.js';

export interface SwarmOrchestratorOptions {
  callOllama?: (model: string, systemPrompt: string, userPrompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>;
  onProgress?: (data: { round: number; totalRounds: number; winnerId: string | null; converged: boolean }) => void;
  onFragmentsMined?: (fragments: MinedFragment[]) => void;
}

/**
 * Routing result for prompt-to-expert matching
 */
export interface RoutingResult {
  selectedExperts: ExpertDescription[];
  scores: Map<string, number>;
  reasoning: string;
}

/**
 * Swarm orchestrator — multi-model collaborative generation.
 *
 * Designed for Ollama's multi-model concurrent API (`/api/generate` format).
 * The default `callOllama` callback uses Ollama's native format. LM Studio can
 * be used via a custom callback that adapts the OpenAI-compatible format, but
 * multi-model diversity (different personas calling different models) requires
 * Ollama.
 * 
 * Features learned routing: prompts are matched to the most relevant 2-3 experts
 * based on keyword similarity rather than using all experts equally.
 */
export class SwarmOrchestrator {
  private config: SwarmConfig;
  private personas: SwarmPersona[];
  private callOllama: (model: string, systemPrompt: string, userPrompt: string, options?: { temperature?: number; num_predict?: number }) => Promise<string>;
  private dna: ProjectDNA | null = null;

  /** Emergent creative vocabulary — discovers technique patterns across rounds. */
  private readonly creativeLanguage = new SymbolicCreativeLanguage(100);

  /** Inter-agent communication channel using the Agora protocol. */
  private readonly routineChannel: RoutineChannel;

  /** Tracks which vocabulary entries appeared in winning outputs (for outcome recording). */
  private lastRoundSymbolIds: Map<string, string[]> = new Map();

  /**
   * Pre-load DNA for domain knowledge injection into swarm prompts.
   */
  setDNA(dna: ProjectDNA | null): void {
    this.dna = dna;
  }

  constructor(config?: Partial<SwarmConfig>, options?: SwarmOrchestratorOptions) {
    this.config = {
      ollamaHost: config?.ollamaHost ?? SERVICE_DEFAULTS.OLLAMA_URL,
      ollamaTimeout: config?.ollamaTimeout ?? (TIMEOUT_DEFAULT_MS / 1000),
      maxRounds: config?.maxRounds ?? 10,
      convergenceThreshold: config?.convergenceThreshold ?? 3,
      musicalChairs: config?.musicalChairs ?? false,
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

    // Initialize the Agora routine channel for inter-agent communication
    const channelConfig: ChannelConfig = { maxHistory: 20, compressThreshold: 3 };
    this.routineChannel = new RoutineChannel(channelConfig);
  }

  /**
   * Route a prompt to the most relevant experts based on keyword similarity.
   * Uses sparse routing: selects 2-3 most relevant experts, not all experts.
   * 
   * @param prompt The user prompt to route
   * @returns RoutingResult with selected experts and similarity scores
   */
  routePromptToExperts(prompt: string): RoutingResult {
    const promptLower = prompt.toLowerCase();
    const scores = new Map<string, number>();
    
    // Calculate keyword match score for each expert
    for (const expert of ALL_EXPERTS) {
      let score = 0;
      const matchedKeywords: string[] = [];
      
      for (const keyword of expert.keywords) {
        // Exact keyword match
        if (promptLower.includes(keyword.toLowerCase())) {
          score += 2;
          matchedKeywords.push(keyword);
        }
        // Partial match for compound keywords
        else if (keyword.includes(' ')) {
          const parts = keyword.split(' ');
          const partialMatches = parts.filter(part => 
            part.length > 3 && promptLower.includes(part.toLowerCase())
          ).length;
          if (partialMatches > 0) {
            score += partialMatches * 0.5;
            matchedKeywords.push(keyword);
          }
        }
      }
      
      // Bonus for description similarity (simple word overlap)
      const descWords = expert.description.toLowerCase().split(/\s+/);
      const promptWords = new Set(promptLower.split(/\s+/));
      for (const word of descWords) {
        if (word.length > 4 && promptWords.has(word)) {
          score += 0.5;
        }
      }
      
      scores.set(expert.id, score);
    }
    
    // Sort by score and select top 2-3 experts
    const sortedExperts = [...scores.entries()]
      .sort((a, b) => b[1] - a[1]);
    
    // Filter to those with positive scores
    const positiveScorers = sortedExperts.filter(([, score]) => score > 0);
    
    // Select experts: if no matches, fall back to top 2; otherwise select 2-3 based on scores
    let selectedIds: string[];
    if (positiveScorers.length === 0) {
      // No keyword matches - fall back to top 2 experts by score (all will have 0)
      selectedIds = sortedExperts.slice(0, 2).map(([id]) => id);
    } else {
      // Select 2-3 experts based on score distribution
      let selectedCount = 2;
      if (positiveScorers.length >= 3) {
        // If there's a significant drop-off after 2, use 2; otherwise use 3
        const scoreDiff = positiveScorers[1][1] - (positiveScorers[2]?.[1] ?? 0);
        if (scoreDiff < 2) {
          selectedCount = 3;
        }
      }
      selectedIds = positiveScorers.slice(0, selectedCount).map(([id]) => id);
    }
    
    const selectedExperts = ALL_EXPERTS.filter(e => selectedIds.includes(e.id));
    
    // Build reasoning string
    const reasoningParts: string[] = [];
    for (const expert of selectedExperts) {
      const score = scores.get(expert.id) ?? 0;
      const matches = expert.keywords.filter(kw => 
        promptLower.includes(kw.toLowerCase())
      ).slice(0, 3);
      reasoningParts.push(`${expert.name}: score=${score.toFixed(1)}, keywords=[${matches.join(', ')}]`);
    }
    
    return {
      selectedExperts,
      scores,
      reasoning: `Selected ${selectedExperts.length} experts: ${reasoningParts.join('; ')}`,
    };
  }

  /**
   * Get personas for a prompt using learned routing.
   * Replaces the default all-personas approach with sparse expert selection.
   * 
   * @param prompt The user prompt
   * @returns Array of relevant personas (2-3 instead of all 5)
   */
  getRoutedPersonas(prompt: string): SwarmPersona[] {
    const routing = this.routePromptToExperts(prompt);
    
    // Map expert descriptions to personas
    return routing.selectedExperts.map(expert => {
      // Check if we already have this expert in personas
      const existing = this.personas.find(p => p.id === expert.id);
      if (existing) {
        return existing;
      }
      
      // Create new persona from expert description
      return {
        id: expert.id,
        name: expert.name,
        displayName: expert.name,
        model: 'qwen2.5-coder:7b',
        // All experts use same temperature - differentiation from system prompts
        temperature: 0.7,
        maxTokens: TOKEN_LIMIT_LARGE,
        systemPrompt: expert.systemPrompt,
        voice: expert.description,
        thinkingStyle: `Creative approach: ${expert.description}`,
        votingBias: `Votes for outputs matching ${expert.name.toLowerCase()} aesthetic`,
        constraints: [
          `Emphasize ${expert.keywords[0]} aesthetics`,
          `Consider ${expert.keywords[1]} principles`,
        ],
        votingPower: 2,
      };
    });
  }

  /**
   * Multi-pass code extraction from Ollama responses.
   * Ollama returns verbose responses with markdown fences, explanations, and a "thinking" field.
   * This method extracts only the actual code, similar to LLMClient.parseChatCompletionResponse().
   */
  private extractCodeFromResponse(rawResponse: string): string {
    const content = rawResponse.trim();
    let cleanCode = '';

    // Pass 1: Try to extract code from markdown fences (javascript, js, or no language tag)
    const markdownCodeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (markdownCodeMatch) {
      cleanCode = markdownCodeMatch[1].trim();
    } else {
      // Pass 2: Look for code between any markdown fences
      const anyFenceMatch = content.match(/```\n?([\s\S]*?)```/);
      if (anyFenceMatch) {
        cleanCode = anyFenceMatch[1].trim();
      } else {
        // Pass 3: Find first actual code line by looking for code keywords
        const lines = content.split('\n');
        let codeStartIndex = -1;

        // Patterns that indicate actual code (not reasoning)
        const codePatterns = [
          /^(let|const|var|function|class|if|for|while|setup|draw|import|export|return)\b/,
          /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying)\b/,
          /^<!DOCTYPE html>/i,
          /^<html/i,
          /^<head/i,
          /^<body/i,
          /^<script/i,
        ];

        // Patterns that indicate reasoning/commentary to skip
        const skipPatterns = [
          /^(\/\/\s*)?(The user wants?|I need to|I'll create|I will create|Let me create|Based on|Here's a|This sketch|Creating a|Generating a|I'm going to|The previous|Looking at|To improve|For this|Key elements|I'll write)/i,
          /^[\d.\-\s]+/, // Numbered list items like "1. ", "2. ", "- ", etc.
          /^(Has|Uses|Responds|I'll|I'll create|Maybe|Let me|I should|The code|This will)/i, // Common reasoning phrases
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Check if this line matches code patterns
          const isCode = codePatterns.some(pattern => pattern.test(line));
          if (isCode) {
            codeStartIndex = i;
            break;
          }

          // Skip lines that match reasoning patterns
          const isSkip = skipPatterns.some(pattern => pattern.test(line));
          if (!isSkip) {
            // This might be code - include it
            codeStartIndex = i;
            break;
          }
        }

        if (codeStartIndex >= 0) {
          cleanCode = lines.slice(codeStartIndex).join('\n').trim();
        } else {
          // Fallback: use entire content
          cleanCode = content;
        }
      }
    }

    // Final cleanup: Remove any remaining leading non-code lines
    const finalLines = cleanCode.split('\n');
    let finalCodeStart = 0;
    const finalCodePatterns = [
      /^(let|const|var|function|class|if|for|while|setup|draw|import|export|return)\b/,
      /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying)\b/,
      /^<!DOCTYPE html>/i,
      /^<html/i,
      /^<head/i,
      /^<body/i,
      /^<script/i,
    ];

    for (let i = 0; i < Math.min(20, finalLines.length); i++) {
      const line = finalLines[i].trim();
      if (finalCodePatterns.some(pattern => pattern.test(line))) {
        finalCodeStart = i;
        break;
      }
    }
    const finalCode = finalCodeStart > 0
      ? finalLines.slice(finalCodeStart).join('\n')
      : cleanCode;

    return finalCode;
  }

  private async defaultOllamaCaller(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; num_predict?: number }
  ): Promise<string> {
    const url = `${this.config.ollamaHost}/api/chat`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
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

    const data = await response.json() as { message?: { content?: string } };
    const rawResponse = data.message?.content ?? '';

    // Chat API returns cleaner output, but still extract code if present
    return this.extractCodeFromResponse(rawResponse);
  }

  /**
   * Main entry point: run the full swarm evolution.
   * Uses learned routing to select relevant experts for the prompt.
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

    // Route prompt to relevant experts, or use configured personas directly
    const routedPersonas = this.config.skipRouting
      ? this.personas
      : this.getRoutedPersonas(prompt);
    if (!this.config.skipRouting) {
      const routing = this.routePromptToExperts(prompt);
      Logger.info('SwarmOrchestrator', `Routing: ${routing.reasoning}`);
    }
    Logger.info('SwarmOrchestrator', `Using ${routedPersonas.length} personas for generation`);

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

      // Inject vocabulary from previous rounds into the seed (P0.1)
      const vocabularyHint = this.buildVocabularyHint(roundNum);
      const enrichedSeed = vocabularyHint
        ? `${currentSeed}\n\nDiscovered techniques: ${vocabularyHint}`
        : currentSeed;

      // Run round with routed personas
      const isFinalRound = roundNum === this.config.maxRounds;
      const result = await this.runRound(
        enrichedSeed,
        roundNum,
        effectiveMode,
        constraint,
        isFinalRound,
        prevWinnerOutputs,
        routedPersonas
      );
      rounds.push(result);

      // ── Agora routine channel: inter-agent messaging ──
      if (result.winnerId && result.winnerContent) {
        const allExpertIds = [...result.outputs.keys()];
        const nonWinnerIds = allExpertIds.filter(id => id !== result.winnerId);

        // Winner broadcasts proposal to all other experts
        this.routineChannel.broadcast(
          result.winnerId,
          'propose',
          result.winnerContent,
          roundNum,
          nonWinnerIds,
        );

        // Each non-winner sends refine feedback directly to the winner
        for (const expertId of nonWinnerIds) {
          const expertOutput = result.outputs.get(expertId);
          if (expertOutput && expertOutput.content && !expertOutput.content.startsWith('[Generation error')) {
            this.routineChannel.directMessage(
              expertId,
              result.winnerId,
              'refine',
              expertOutput.content,
              roundNum,
            );
          }
        }
      }

      // Discover vocabulary from all outputs this round (P0.1)
      this.discoverRoundVocabulary(result);

      // Record outcome: boost vocabulary entries that appeared in the winner (P0.1)
      const winnerSymbolIds = this.lastRoundSymbolIds.get(result.winnerId ?? '') ?? [];
      if (winnerSymbolIds.length > 0) {
        this.creativeLanguage.recordOutcome(winnerSymbolIds, 0.8);
      }

      // Prune vocabulary if it exceeds bounds
      this.creativeLanguage.pruneVocabulary();

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
          }
        } else {
          consecutiveWins = 1;
          lastWinner = result.winnerId;
        }
      }

      // Emit swarm round event with full round data (P0.2)
      eventBus.emit(EventTypes.SWARM_ROUND, 'SwarmOrchestrator', {
        round: roundNum,
        totalRounds: this.config.maxRounds,
        outputs: Object.fromEntries(result.outputs),
        votes: Object.fromEntries(result.votes),
        winner: result.winnerId,
        converged,
        vocabularySize: this.creativeLanguage.getQualityReport().totalSymbols,
        timestamp: Date.now(),
      } as unknown as Record<string, unknown>);

      // Break after emitting the convergence round event
      if (converged) {
        // Broadcast consensus from winner via Agora routine channel
        if (result.winnerId && result.winnerContent) {
          const allExpertIds = [...result.outputs.keys()];
          const nonWinnerIds = allExpertIds.filter(id => id !== result.winnerId);
          this.routineChannel.broadcast(
            result.winnerId,
            'merge',
            result.winnerContent,
            roundNum,
            nonWinnerIds,
          );
        }
        break;
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
   * Run a single round: generate from selected personas, conduct voting.
   * Uses HeuristicScorer for non-final rounds, VotingEngine for final round only.
   */
  async runRound(
    seed: string,
    roundNum: number,
    mode: SwarmMode,
    constraint: string,
    isFinalRound: boolean,
    prevWinnerOutputs: string[],
    personas?: SwarmPersona[]
  ): Promise<RoundResult> {
    const effectiveSeed = `${seed}\n\nConstraint: ${constraint}`;
    
    // Use provided personas (routed) or fall back to all personas
    const activePersonas = personas ?? this.personas;

    // Generate outputs
    let outputs: Map<string, SwarmOutput>;
    if (mode === 'ring') {
      outputs = await this.generateRing(effectiveSeed, roundNum, activePersonas);
    } else {
      // competitive, hybrid, mesh all use parallel generation
      outputs = await this.generateParallel(effectiveSeed, roundNum, activePersonas);
    }

    // Conduct voting: heuristic for early rounds, LLM for final round only
    let votingResult: { scores: Map<string, number>; winnerId: string; votes: Map<string, Vote> };

    if (isFinalRound) {
      votingResult = await VotingEngine.conductVoting(
        outputs,
        activePersonas,
        roundNum,
        this.config,
        this.callOllama
      );
    } else {
      votingResult = HeuristicScorer.score(
        outputs,
        activePersonas,
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
   * Generate from selected personas in parallel (competitive/hybrid/mesh).
   */
  private async generateParallel(
    seed: string, 
    roundNum: number,
    personas: SwarmPersona[]
  ): Promise<Map<string, SwarmOutput>> {
    const outputs = new Map<string, SwarmOutput>();
    const promises = personas.map(async (persona) => {
      const startTime = Date.now();
      try {
        const userPrompt = `Prompt: ${seed}\n\n${persona.constraints.map(c => `Constraint: ${c}`).join('\n')}`;

        const content = await this.callOllama(
          persona.model,
          persona.systemPrompt,
          userPrompt,
          {
            // All personas use same temperature - differentiation from system prompts
            temperature: 0.7,
            num_predict: persona.maxTokens,
          }
        );

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
  private async generateRing(
    seed: string, 
    roundNum: number,
    personas: SwarmPersona[]
  ): Promise<Map<string, SwarmOutput>> {
    const outputs = new Map<string, SwarmOutput>();
    let currentChain = seed;

    for (const persona of personas) {
      const startTime = Date.now();
      try {
        const chainContext = currentChain.length > TRUNCATE_MEDIUM ? currentChain.slice(-TRUNCATE_MEDIUM) : currentChain;
        const userPrompt = `Context from previous outputs:\n${chainContext}\n\n${persona.constraints.map(c => `Constraint: ${c}`).join('\n')}`;

        const content = await this.callOllama(
          persona.model,
          persona.systemPrompt,
          userPrompt,
          {
            // All personas use same temperature - differentiation from system prompts
            temperature: 0.7,
            num_predict: persona.maxTokens,
          }
        );

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

  // ── P0.1: Vocabulary discovery and injection ──

  /**
   * Build a vocabulary hint string from discovered techniques to inject into next round's seed.
   * Only includes entries with positive effectiveness to avoid injecting noise.
   */
  private buildVocabularyHint(roundNum: number): string {
    if (roundNum <= 1) return ''; // No vocabulary before first round

    const vocab = this.creativeLanguage.getVocabulary();
    const effective = vocab.filter(s => s.effectiveness > 0.3);

    if (effective.length === 0) return '';

    // Format top entries as a compact hint (max 5 to avoid context bloat)
    const topEntries = effective.slice(0, 5);
    return topEntries
      .map(s => `${s.name}(${s.effectiveness.toFixed(2)})`)
      .join(', ');
  }

  /**
   * Discover vocabulary from all outputs in a round.
   * Tracks which symbols were discovered per persona for later outcome recording.
   */
  private discoverRoundVocabulary(result: RoundResult): void {
    this.lastRoundSymbolIds.clear();

    for (const [personaId, output] of result.outputs.entries()) {
      const content = output.content;
      if (!content || content.startsWith('[Generation error')) continue;

      const discovered = this.creativeLanguage.discoverSymbols(content, 'visual');
      const symbolIds = discovered.map(s => s.id);

      if (symbolIds.length > 0) {
        this.lastRoundSymbolIds.set(personaId, symbolIds);
      }
    }

    const report = this.creativeLanguage.getQualityReport();
    Logger.info('SwarmOrchestrator', `Vocabulary: ${report.totalSymbols} symbols, avg effectiveness=${report.avgEffectiveness.toFixed(2)}`);
  }

  /**
   * Get the current vocabulary state (for external consumers like protocol analytics).
   */
  getVocabulary(): CreativeSymbol[] {
    return this.creativeLanguage.getVocabulary();
  }

  /**
   * Get the vocabulary quality report.
   */
  getVocabularyReport() {
    return this.creativeLanguage.getQualityReport();
  }

  // ── Agora routine channel access ──

  /**
   * Get the routine channel for external consumption (protocol analytics, etc.).
   */
  getRoutineChannel(): RoutineChannel {
    return this.routineChannel;
  }

  /**
   * Get a compressed summary of a specific round's Agora exchange.
   * Returns undefined if the round has fewer messages than the compress threshold.
   */
  getRoundCompressedSummary(round: number) {
    return this.routineChannel.getCompressedExchange(round);
  }
}
