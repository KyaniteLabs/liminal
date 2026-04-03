/**
 * Deep Collaboration - Maximum quality through specialized model teamwork
 *
 * Models take on specialized roles and collaborate through structured phases:
 *
 * PHASE 1: DIVERGENCE
 * - Creator (Local): Generate initial creative work
 * - Visionary (Cloud): Generate alternative ambitious vision
 *
 * PHASE 2: ANALYSIS (Both models analyze both outputs)
 * - Technical Critic: Analyze execution, correctness, technical quality
 * - Artistic Critic: Analyze creativity, aesthetics, emotional impact
 * - Domain Expert: Analyze domain-specific quality
 *
 * PHASE 3: SYNTHESIS
 * - Integrator (Cloud): Synthesize best elements from both versions
 * - Refiner (Local): Polish and perfect the synthesis
 *
 * PHASE 4: ITERATION
 * - Repeat analysis and refinement until convergence
 */

import { SERVICE_DEFAULTS } from '../constants.js';
import { PromptLibrary } from '../prompts/PromptLibrary.js';
import {
  DOMAIN_GUIDANCE,
  CREATOR_ROLE_PROMPT,
  VISIONARY_ROLE_PROMPT,
  TECHNICAL_CRITIC_ROLE_PROMPT,
  ARTISTIC_CRITIC_ROLE_PROMPT,
  DOMAIN_EXPERT_ROLE_PROMPT,
  INTEGRATOR_ROLE_PROMPT,
  REFINER_ROLE_PROMPT,
} from '../prompts/collaboration.js';
import { quickScore } from './Scoring.js';

import type {
  CollaborationRole,
  DeepCollaborationConfig,
  DeepCollaborationResult,
  PhaseResult,
  Analysis,
  PhaseUpdate,

} from './types.js';
import { Domain } from '../types/domains.js';

/**
 * Deep collaborative client with specialized roles and phases
 *
 * Orchestrates sophisticated collaboration process:
 * 1. Models generate from different perspectives
 * 2. Multiple specialized critics analyze from different angles
 * 3. Best elements are synthesized
 * 4. Process iterates with deeper analysis each round
 */
export class DeepCollaboration {
  private config: Required<DeepCollaborationConfig>;

  constructor(config: DeepCollaborationConfig) {
    this.config = {
      localBaseUrl: config.localBaseUrl ?? SERVICE_DEFAULTS.LOCAL_LLM_URL,
      localModel: config.localModel ?? 'qwen3.5:4b',
      cloudApiKey: config.cloudApiKey ?? '',
      cloudModel: config.cloudModel ?? 'MiniMax-M2.7',
      cloudBaseUrl: config.cloudBaseUrl ?? SERVICE_DEFAULTS.MINIMAX_URL,
      maxPhases: config.maxPhases ?? 4,
      criticsPerPhase: config.criticsPerPhase ?? 3,
      convergenceThreshold: config.convergenceThreshold ?? 0.90,
      callLLM: config.callLLM,
    };
  }

  /**
   * Generate using deep collaboration for maximum quality
   *
   * @param prompt - User prompt
   * @param domain - Creative domain
   * @param systemPrompt - System prompt
   * @param phaseCallback - Optional callback for progress updates
   * @returns Final output string
   */
  async generate(
    prompt: string,
    domain: Domain = Domain.EMPTY,
    systemPrompt: string = '',
    phaseCallback?: (update: PhaseUpdate) => void
  ): Promise<string> {
    const result = await this.generateDeepCollaboration(
      prompt,
      domain,
      systemPrompt,
      phaseCallback
    );
    return result.finalOutput;
  }

  /**
   * Generate using full deep collaboration process
   *
   * Runs through multiple phases of specialized collaboration
   *
   * @param prompt - User prompt
   * @param domain - Creative domain
   * @param systemPrompt - System prompt
   * @param phaseCallback - Optional callback for progress updates
   * @returns DeepCollaborationResult with full phase history
   */
  async generateDeepCollaboration(
    prompt: string,
    domain: Domain = Domain.EMPTY,
    systemPrompt: string = '',
    phaseCallback?: (update: PhaseUpdate) => void
  ): Promise<DeepCollaborationResult> {
    const startTime = Date.now();
    const phases: PhaseResult[] = [];
    const qualityTrajectory: number[] = [];

    // === PHASE 1: DIVERGENCE ===
    if (phaseCallback) {
      phaseCallback({
        phaseName: 'Divergence',
        model: 'Both',
        action: 'Creator generating initial creative work...',
      });
    }

    const phase1 = await this.phaseDivergence(
      prompt,
      domain,
      systemPrompt
    );
    phases.push(phase1);

    let currentBest = phase1.synthesis?.content || phase1.outputs.creator || '';
    const quality1 = quickScore(currentBest, domain);
    qualityTrajectory.push(quality1);

    if (phaseCallback) {
      phaseCallback({
        phaseName: 'Divergence',
        model: 'Local',
        action: 'Creator: Initial creative work complete',
        output: phase1.outputs.creator?.slice(0, 100),
        quality: quality1,
      });
      phaseCallback({
        phaseName: 'Divergence',
        model: 'Cloud',
        action: 'Visionary: Alternative vision complete',
        output: phase1.outputs.visionary?.slice(0, 100),
      });
      phaseCallback({
        phaseName: 'Divergence',
        model: 'Cloud',
        action: 'Integrator: Synthesized best elements',
        output: currentBest.slice(0, 100),
        quality: quality1,
      });
    }

    // === PHASE 2-N: ITERATIVE REFINEMENT ===
    for (let phaseNum = 2; phaseNum <= this.config.maxPhases; phaseNum++) {
      // Check convergence
      if (qualityTrajectory[qualityTrajectory.length - 1] >= this.config.convergenceThreshold) {
        if (phaseCallback) {
          phaseCallback({
            phaseName: 'Iteration',
            model: 'Both',
            action: `✓ Converged at phase ${phaseNum - 1}! (quality: ${qualityTrajectory[qualityTrajectory.length - 1].toFixed(2)})`,
            quality: qualityTrajectory[qualityTrajectory.length - 1],
          });
        }
        break;
      }

      // Analysis phase
      if (phaseCallback) {
        phaseCallback({
          phaseName: 'Analysis',
          model: 'Both',
          action: `Phase ${phaseNum}: Critics analyzing from multiple perspectives...`,
        });
      }

      const analysisPhase = await this.phaseAnalysis(
        prompt,
        currentBest,
        domain,
        systemPrompt
      );
      phases.push(analysisPhase);

      if (phaseCallback) {
        phaseCallback({
          phaseName: 'Analysis',
          model: 'Cloud',
          action: `Technical Critic: Analysis complete`,
        });
        phaseCallback({
          phaseName: 'Analysis',
          model: 'Cloud',
          action: `Artistic Critic: Analysis complete`,
        });
        phaseCallback({
          phaseName: 'Analysis',
          model: 'Local',
          action: `Domain Expert: Analysis complete`,
        });
      }

      // Synthesis phase
      if (phaseCallback) {
        phaseCallback({
          phaseName: 'Synthesis',
          model: 'Both',
          action: `Phase ${phaseNum}: Integrating feedback and refining...`,
        });
      }

      const synthesisPhase = await this.phaseSynthesis(
        prompt,
        currentBest,
        analysisPhase.analyses || [],
        domain,
        systemPrompt
      );
      phases.push(synthesisPhase);

      // Update best
      if (synthesisPhase.synthesis) {
        currentBest = synthesisPhase.synthesis.content;
      }
      const newQuality = quickScore(currentBest, domain);
      qualityTrajectory.push(newQuality);

      if (phaseCallback) {
        phaseCallback({
          phaseName: 'Synthesis',
          model: 'Cloud',
          action: `Integrator: Synthesized critic feedback`,
        });
        phaseCallback({
          phaseName: 'Synthesis',
          model: 'Local',
          action: `Refiner: Applied final polish`,
          quality: newQuality,
        });
      }
    }

    const duration = (Date.now() - startTime) / 1000;

    // Final completion callback
    if (phaseCallback) {
      const converged = qualityTrajectory[qualityTrajectory.length - 1] >= this.config.convergenceThreshold;
      phaseCallback({
        phaseName: 'Complete',
        model: 'Both',
        action: `Deep collaboration complete! Phases: ${phases.length}, Converged: ${converged}`,
        quality: qualityTrajectory[qualityTrajectory.length - 1],
        duration,
      });
    }

    return {
      finalOutput: currentBest,
      phases,
      totalDurationSeconds: duration,
      qualityScore: qualityTrajectory[qualityTrajectory.length - 1],
      improvementTrajectory: qualityTrajectory,
      metadata: {
        converged: qualityTrajectory[qualityTrajectory.length - 1] >= this.config.convergenceThreshold,
        totalPhases: phases.length,
        improvement: qualityTrajectory.length > 1
          ? qualityTrajectory[qualityTrajectory.length - 1] - qualityTrajectory[0]
          : 0,
      },
    };
  }

  /**
   * Phase 1: Divergence - Generate from different perspectives
   */
  private async phaseDivergence(
    prompt: string,
    domain: Domain,
    systemPrompt: string
  ): Promise<PhaseResult> {
    const start = Date.now();

    // Creator (Local) - Practical, executable
    const creatorPrompt = CREATOR_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain);

    // Visionary (Cloud) - Ambitious, creative
    const visionaryPrompt = VISIONARY_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain);

    // Generate in parallel
    const [creatorOutput, visionaryOutput] = await Promise.all([
      this.config.callLLM(creatorPrompt, systemPrompt),
      this.config.callLLM(visionaryPrompt, systemPrompt),
    ]);

    // Initial synthesis using PromptLibrary template
    const { system: synthSystem, user: synthUser } = PromptLibrary.render('compost.synthesis', {
      creatorOutput,
      visionaryOutput,
      prompt,
    });

    const synthesisOutput = await this.config.callLLM(synthSystem + '\n\n' + synthUser, systemPrompt);

    return {
      phaseName: 'Divergence',
      outputs: {
        creator: creatorOutput,
        visionary: visionaryOutput,
      },
      synthesis: {
        content: synthesisOutput,
        sourceExplanation: 'Synthesis of Creator\'s technical approach with Visionary\'s creativity',
      },
      durationSeconds: (Date.now() - start) / 1000,
    };
  }

  /**
   * Analysis phase: Multiple critics from different perspectives
   */
  private async phaseAnalysis(
    prompt: string,
    currentOutput: string,
    domain: Domain,
    systemPrompt: string
  ): Promise<PhaseResult> {
    const start = Date.now();
    const analyses: Analysis[] = [];

    // Technical Critic
    const techPrompt = TECHNICAL_CRITIC_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain)
      .replace('${output}', currentOutput);

    const techResponse = await this.config.callLLM(techPrompt, systemPrompt);
    analyses.push({
      role: 'technical' as CollaborationRole,
      content: techResponse,
    });

    // Artistic Critic
    const artPrompt = ARTISTIC_CRITIC_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain)
      .replace('${output}', currentOutput);

    const artResponse = await this.config.callLLM(artPrompt, systemPrompt);
    analyses.push({
      role: 'artistic' as CollaborationRole,
      content: artResponse,
    });

    // Domain Expert
    const guidance = DOMAIN_GUIDANCE[domain] || 'Focus on overall quality and effectiveness.';
    const expertPrompt = DOMAIN_EXPERT_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace(/\${domain}/g, domain)
      .replace('${output}', currentOutput)
      .replace('${guidance}', guidance);

    const expertResponse = await this.config.callLLM(expertPrompt, systemPrompt);
    analyses.push({
      role: 'domain' as CollaborationRole,
      content: expertResponse,
    });

    return {
      phaseName: 'Analysis',
      outputs: {},
      analyses,
      durationSeconds: (Date.now() - start) / 1000,
    };
  }

  /**
   * Synthesis phase: Integrate feedback and create improved version
   */
  private async phaseSynthesis(
    prompt: string,
    currentOutput: string,
    analyses: Analysis[],
    domain: Domain,
    systemPrompt: string
  ): Promise<PhaseResult> {
    const start = Date.now();

    // Compile all feedback
    const allFeedback = analyses.map(analyst =>
      `=== ${analyst.role.toUpperCase()} ANALYSIS ===\n${analyst.content}`
    ).join('\n\n');

    // Integrator (Cloud) - Synthesize improvements
    const integratorPrompt = INTEGRATOR_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain)
      .replace('${currentOutput}', currentOutput)
      .replace('${feedback}', allFeedback);

    const integratedOutput = await this.config.callLLM(integratorPrompt, systemPrompt);

    // Refiner (Local) - Final polish
    const refinerPrompt = REFINER_ROLE_PROMPT
      .replace('${prompt}', prompt)
      .replace('${domain}', domain)
      .replace('${integratedOutput}', integratedOutput);

    const refinedOutput = await this.config.callLLM(refinerPrompt, systemPrompt);

    return {
      phaseName: 'Synthesis',
      outputs: { refined: refinedOutput },
      synthesis: {
        content: refinedOutput,
        sourceExplanation: 'Refined integration of all critic feedback',
        improvements: [`Addressed ${analyses.length} critic perspectives`],
      },
      durationSeconds: (Date.now() - start) / 1000,
    };
  }
}
