/**
 * Collaborative LLM client - Maximum quality through model teamwork
 *
 * Models work together iteratively:
 * 1. Both models generate initial versions
 * 2. Each model analyzes the other's work
 * 3. Each model refines based on feedback
 * 4. Iterate until convergence or max rounds
 * 5. Select best output via quality scoring
 *
 * This is "Mixture of Agents" style collaboration - leveraging each model's
 * strengths through structured interaction.
 */

import { DOMAIN_GUIDANCE } from '../prompts/collaboration.js';
import { quickScore } from './Scoring.js';

import type {
  CollaborativeConfig,
  CollaborativeResult,
  CollaborationRound,
  PhaseUpdate,
} from './types.js';
import { Domain } from '../types/domains.js';

/**
 * Client that makes Local and Cloud collaborate deeply
 *
 * Collaboration pattern:
 * 1. Both models generate independently
 * 2. Each analyzes the other's work (strengths, weaknesses, improvements)
 * 3. Each refines their own work based on the other's analysis
 * 4. Repeat for N rounds or until convergence
 * 5. Score all outputs and return the best
 */
export class CollaborativeClient {
  private config: Required<CollaborativeConfig>;

  constructor(config: CollaborativeConfig) {
    this.config = {
      cloudApiKey: config.cloudApiKey ?? '',
      cloudModel: config.cloudModel ?? 'MiniMax-M2.7',
      maxRounds: config.maxRounds ?? 3,
      convergenceThreshold: config.convergenceThreshold ?? 0.85,
      callLLM: config.callLLM,
    };
  }

  /**
   * Generate using deep collaboration
   *
   * @param prompt - User prompt
   * @param domain - Creative domain
   * @param systemPrompt - System prompt
   * @param progressCallback - Optional callback for progress updates
   * @returns Final output string
   */
  async generate(
    prompt: string,
    domain: Domain = Domain.EMPTY,
    systemPrompt: string = '',
    progressCallback?: (update: PhaseUpdate) => void
  ): Promise<string> {
    const result = await this.generateCollaborative(
      prompt,
      domain,
      systemPrompt,
      progressCallback
    );
    return result.finalOutput;
  }

  /**
   * Generate with full collaborative process
   *
   * @param prompt - User prompt
   * @param domain - Creative domain
   * @param systemPrompt - System prompt
   * @param progressCallback - Optional callback for progress updates
   * @returns CollaborativeResult with full history
   */
  async generateCollaborative(
    prompt: string,
    domain: Domain = Domain.EMPTY,
    systemPrompt: string = '',
    progressCallback?: (update: PhaseUpdate) => void
  ): Promise<CollaborativeResult> {
    const startTime = Date.now();
    const rounds: CollaborationRound[] = [];
    const maxR = this.config.maxRounds;

    // Phase 1: Generation - both models work independently
    if (progressCallback) {
      progressCallback({
        phaseName: 'Generation',
        model: 'Both',
        action: 'Generating initial versions...',
      });
    }

    const [localOut, cloudOut] = await this.generateParallel(
      prompt,
      systemPrompt
    );

    // Report generation completion
    if (progressCallback) {
      const localQuality = quickScore(localOut, domain);
      const cloudQuality = quickScore(cloudOut, domain);

      progressCallback({
        phaseName: 'Generation',
        model: 'Local',
        action: 'Generated initial version',
        output: localOut.slice(0, 100),
        quality: localQuality,
      });

      progressCallback({
        phaseName: 'Generation',
        model: 'Cloud',
        action: 'Generated initial version',
        output: cloudOut.slice(0, 100),
        quality: cloudQuality,
      });
    }

    let currentLocal = localOut;
    let currentCloud = cloudOut;

    // Collaboration rounds
    for (let roundNum = 1; roundNum <= maxR; roundNum++) {
      const roundResult: CollaborationRound = {
        roundNum,
        localOutput: currentLocal,
        cloudOutput: currentCloud,
      };

      // Phase: Analysis
      if (progressCallback) {
        progressCallback({
          phaseName: 'Analysis',
          model: 'Both',
          action: `Round ${roundNum}: Analyzing outputs...`,
        });
      }

      // Each model analyzes the other's work
      const [localAnalysis, cloudAnalysis] = await this.analyzeParallel(
        prompt,
        currentLocal,
        currentCloud,
        domain,
        systemPrompt
      );
      roundResult.localAnalysisOfCloud = localAnalysis;
      roundResult.cloudAnalysisOfLocal = cloudAnalysis;

      if (progressCallback) {
        progressCallback({
          phaseName: 'Analysis',
          model: 'Local',
          action: `Analyzed Cloud's output (Round ${roundNum})`,
        });
        progressCallback({
          phaseName: 'Analysis',
          model: 'Cloud',
          action: `Analyzed Local's output (Round ${roundNum})`,
        });
      }

      // Phase: Refinement
      if (progressCallback) {
        progressCallback({
          phaseName: 'Refinement',
          model: 'Both',
          action: `Round ${roundNum}: Refining based on feedback...`,
        });
      }

      // Each model refines based on feedback
      const [localRefined, cloudRefined] = await this.refineParallel(
        prompt,
        currentLocal,
        currentCloud,
        localAnalysis,
        cloudAnalysis,
        systemPrompt
      );
      roundResult.localRefined = localRefined;
      roundResult.cloudRefined = cloudRefined;

      if (progressCallback) {
        const localRefinedQuality = quickScore(localRefined, domain);
        const cloudRefinedQuality = quickScore(cloudRefined, domain);

        progressCallback({
          phaseName: 'Refinement',
          model: 'Local',
          action: `Refined output (Round ${roundNum})`,
          quality: localRefinedQuality,
        });
        progressCallback({
          phaseName: 'Refinement',
          model: 'Cloud',
          action: `Refined output (Round ${roundNum})`,
          quality: cloudRefinedQuality,
        });
      }

      // Score all outputs from this round
      const outputs = [currentLocal, currentCloud, localRefined, cloudRefined];
      const scores = this.scoreOutputs(outputs, domain);
      roundResult.scores = scores;

      // Select best output
      const bestIdx = Object.entries(scores).reduce((a, b) =>
        scores[Number(a[0])] > scores[Number(b[0])] ? a : b
      );
      roundResult.bestOutput = outputs[Number(bestIdx[0])];

      // Check for convergence
      const bestScore = scores[Number(bestIdx[0])];
      if (bestScore >= this.config.convergenceThreshold) {
        rounds.push(roundResult);

        if (progressCallback) {
          progressCallback({
            phaseName: 'Selection',
            model: 'Both',
            action: `Converged! Best output selected (quality: ${bestScore.toFixed(2)})`,
            quality: bestScore,
          });
        }
        break;
      }

      // Update for next round
      currentLocal = localRefined;
      currentCloud = cloudRefined;
      rounds.push(roundResult);

      if (roundNum >= maxR) break;
    }

    // Select overall best from all rounds
    const allOutputs: Array<{ output: string; source: string; round: number }> = [];
    for (const r of rounds) {
      allOutputs.push(
        { output: r.localOutput, source: 'local', round: r.roundNum },
        { output: r.cloudOutput, source: 'cloud', round: r.roundNum },
        { output: r.localRefined || '', source: 'local_refined', round: r.roundNum },
        { output: r.cloudRefined || '', source: 'cloud_refined', round: r.roundNum }
      );
    }

    const bestFinal = allOutputs.reduce((best, current) => {
      const currentScore = quickScore(current.output, domain);
      const bestScore = quickScore(best.output, domain);
      return currentScore > bestScore ? current : best;
    });

    const duration = (Date.now() - startTime) / 1000;

    // Final selection callback
    if (progressCallback) {
      const finalQuality = quickScore(bestFinal.output, domain);
      progressCallback({
        phaseName: 'Selection',
        model: 'Both',
        action: `Selected best output from ${bestFinal.source} (round ${bestFinal.round})`,
        quality: finalQuality,
        duration,
      });
    }

    return {
      finalOutput: bestFinal.output,
      source: bestFinal.source as 'local' | 'cloud' | 'collaborative',
      rounds,
      totalDurationSeconds: duration,
      qualityScore: quickScore(bestFinal.output, domain),
      metadata: {
        bestRound: bestFinal.round,
        totalOutputsGenerated: allOutputs.length,
        converged: rounds.length < maxR,
      },
    };
  }

  /**
   * Generate from both models (parallel simulation)
   */
  private async generateParallel(
    prompt: string,
    systemPrompt: string
  ): Promise<[string, string]> {
    // For now, sequential - parallel would need actual LLM client instances
    const localOut = await this.config.callLLM(
      `Generate a creative response to: ${prompt}`,
      systemPrompt
    );
    const cloudOut = await this.config.callLLM(
      `Generate an alternative creative response to: ${prompt}`,
      systemPrompt
    );
    return [localOut, cloudOut];
  }

  /**
   * Each model analyzes the other's output
   */
  private async analyzeParallel(
    prompt: string,
    localOutput: string,
    cloudOutput: string,
    domain: Domain,
    systemPrompt: string
  ): Promise<[string, string]> {
    // Local analyzes Cloud's work
    const localAnalysisPrompt = this.buildAnalysisPrompt(
      prompt,
      cloudOutput,
      'another model',
      domain
    );

    // Cloud analyzes Local's work
    const cloudAnalysisPrompt = this.buildAnalysisPrompt(
      prompt,
      localOutput,
      'another model',
      domain
    );

    const [localAnalysis, cloudAnalysis] = await Promise.all([
      this.config.callLLM(localAnalysisPrompt, systemPrompt),
      this.config.callLLM(cloudAnalysisPrompt, systemPrompt),
    ]);

    return [localAnalysis, cloudAnalysis];
  }

  /**
   * Each model refines based on the other's analysis
   */
  private async refineParallel(
    prompt: string,
    localOutput: string,
    cloudOutput: string,
    localAnalysis: string,
    cloudAnalysis: string,
    systemPrompt: string
  ): Promise<[string, string]> {
    // Local refines based on Cloud's analysis
    const localRefinePrompt = this.buildRefinePrompt(
      prompt,
      localOutput,
      cloudAnalysis
    );

    // Cloud refines based on Local's analysis
    const cloudRefinePrompt = this.buildRefinePrompt(
      prompt,
      cloudOutput,
      localAnalysis
    );

    const [localRefined, cloudRefined] = await Promise.all([
      this.config.callLLM(localRefinePrompt, systemPrompt),
      this.config.callLLM(cloudRefinePrompt, systemPrompt),
    ]);

    return [localRefined, cloudRefined];
  }

  /**
   * Build prompt for analyzing another model's output
   */
  private buildAnalysisPrompt(
    originalPrompt: string,
    output: string,
    author: string,
    _domain: Domain
  ): string {
    return `Analyze this output from ${author} for the following request:

Request: ${originalPrompt}

Output:
${output}

${DOMAIN_GUIDANCE[_domain] || 'Analyze the quality and effectiveness of this output.'}

Provide:
1. Strengths (what works well)
2. Weaknesses (what could be improved)
3. Specific suggestions for refinement
4. Overall quality assessment (1-10)

Be specific, constructive, and detailed.`;
  }

  /**
   * Build prompt for refining based on feedback
   */
  private buildRefinePrompt(
    originalPrompt: string,
    currentOutput: string,
    feedback: string
  ): string {
    return `Refine your work based on this feedback.

Original request: ${originalPrompt}

Your current output:
${currentOutput}

Feedback for improvement:
${feedback}

Create an improved version that addresses this feedback while maintaining your strengths. Focus on the specific suggestions and make meaningful improvements.`;
  }

  /**
   * Score outputs using quality assessment
   */
  private scoreOutputs(
    outputs: string[],
    domain: Domain
  ): Record<number, number> {
    const scores: Record<number, number> = {};
    for (let i = 0; i < outputs.length; i++) {
      scores[i] = quickScore(outputs[i], domain);
    }
    return scores;
  }

  /**
   * Quick generation using only local model
   */
  async generateLocal(prompt: string, systemPrompt?: string): Promise<string> {
    return this.config.callLLM(prompt, systemPrompt);
  }

  /**
   * Quick generation using only cloud model
   */
  async generateCloud(prompt: string, systemPrompt?: string): Promise<string> {
    return this.config.callLLM(prompt, systemPrompt);
  }
}
