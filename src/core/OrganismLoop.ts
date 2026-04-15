/**
 * OrganismLoop - Organism mode for RalphLoop
 *
 * Runs generateMusicToVisual per iteration, saves organisms to gallery.
 * Uses context accumulation, compost seed injection, and quality evaluation.
 *
 * Extracted from RalphLoop.ts (lines 796-965).
 */

import { ContextAccumulation } from './ContextAccumulation.js';
import { Gallery } from '../gallery/Gallery.js';
import { generateMusicToVisual } from '../musicToVisual/generateMusicToVisual.js';
import { SeedBank } from '../compost/SeedBank.js';
import { mergeConfig as mergeCompostConfig } from '../compost/defaults.js';
import { eventBus, EventTypes } from './EventBus.js';
import type { LoopResult, NormalizedLoopOptions } from './LoopConfig.js';
import { formatSeedForPrompt } from './lir/LIRPromptFormatter.js';
import { Logger } from '../utils/Logger.js';
import { GalleryFSAdapter } from '../fs/adapters/GalleryFSAdapter.js';
import type { LiminalFS } from '../fs/LiminalFS.js';
import type { LiminalObjectRef } from '../fs/types.js';

/**
 * Run the Ralph-Wiggum Loop in organism mode.
 *
 * Uses generateMusicToVisual per iteration, saves organisms to gallery.
 */
export async function runOrganismMode(
  prompt: string,
  options: NormalizedLoopOptions,
  startTime: number,
  liminalFs?: LiminalFS,
  sessionId?: string,
): Promise<LoopResult> {
  const gallery = new Gallery(options.galleryDir);
  const adapter = liminalFs ? new GalleryFSAdapter(gallery, liminalFs) : undefined;
  let runArtifact: LiminalObjectRef | undefined;
  const runId = sessionId ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  eventBus.emit(EventTypes.PROCESS_START, 'RalphLoop', { process: 'ralph-loop', mode: 'organism' });

  let lastMusic = '';
  let lastVisual = '';
  let iteration = 0;
  let bestScore = 0;
  let iterationsSinceLastImprovement = 0;

  for (let i = 1; i <= options.maxIterations; i++) {
    if (options.signal?.aborted) {
      const result: LoopResult = {
        code: lastMusic + '\n' + lastVisual,
        iterations: iteration,
        completed: false,
        reason: 'aborted by user',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        finalScore: bestScore,
        project: options.project,
      };
      if (liminalFs) {
        try {
          liminalFs.recordRun({
            runId,
            prompt,
            project: options.project,
            status: 'suspended',
            artifacts: runArtifact ? [runArtifact] : [],
            metadata: { mode: 'organism', iterations: iteration, finalScore: bestScore, reason: 'aborted by user' },
          });
        } catch {
          // LiminalFS failure must not affect loop operation
        }
      }
      return result;
    }
    iteration = i;

    // Build context from previous iterations
    const history = ContextAccumulation.getHistory();
    let enhancedPrompt = prompt;
    if (history.length > 0) {
      const lastIter = history[history.length - 1];
      enhancedPrompt += `\n\nPrevious iteration produced code of length ${lastIter.code.length}. Score: ${lastIter.evaluation?.score?.toFixed(2) ?? 'N/A'}.`;
      if (lastIter.evaluation?.issues?.length > 0) {
        enhancedPrompt += ` Issues: ${lastIter.evaluation.issues.join(', ')}.`;
      }
    }

    // Inject a random compost seed for creative cross-pollination
    try {
      const compostConfig = mergeCompostConfig();
      const seedBank = new SeedBank(compostConfig);
      const seed = await seedBank.getRandomSeed();
      if (seed) {
        enhancedPrompt += '\n\nCreative seed from compost:\n' + formatSeedForPrompt(seed, 500);
      }
    } catch (err) {
      Logger.warn('OrganismLoop', 'Compost seed injection failed:', err);
    }

    const result = await generateMusicToVisual(enhancedPrompt, { traits: options.traits });
    lastMusic = result.musicCode;
    lastVisual = result.visualCode;

    // Heuristic quality evaluation for organism mode
    const qualityScore = assessOrganismQuality(result.musicCode, result.visualCode);

    // Context accumulation
    ContextAccumulation.save({
      iteration: i,
      prompt: enhancedPrompt,
      usedPrompt: enhancedPrompt,
      code: result.musicCode + '\n' + result.visualCode,
      evaluation: { score: qualityScore, issues: [] },
      timestamp: new Date().toISOString(),
      maxIterations: options.maxIterations,
    });

    // Stagnation detection
    if (qualityScore > bestScore) {
      bestScore = qualityScore;
      iterationsSinceLastImprovement = 0;
    } else {
      iterationsSinceLastImprovement++;
      if (
        options.stagnationThreshold != null &&
        options.stagnationThreshold > 0 &&
        iterationsSinceLastImprovement >= options.stagnationThreshold
      ) {
        break;
      }
    }

    if (options.project) {
      if (adapter) {
        try {
          runArtifact = await adapter.saveOrganism(options.project, i, result.musicCode, result.visualCode);
        } catch {
          // GalleryFSAdapter failure must not affect loop operation
        }
      } else {
        await gallery.saveOrganism(options.project, i, result.musicCode, result.visualCode);
      }
    }
    options.onProgress?.({
      iteration: i,
      score: qualityScore,
      promiseDetected: false,
      code: result.musicCode + '\n' + result.visualCode,
      timestamp: new Date().toISOString(),
    });
  }
  const duration = Date.now() - startTime;

  eventBus.emit(EventTypes.PROCESS_END, 'RalphLoop', { process: 'ralph-loop', success: true, durationMs: Date.now() - startTime, iterations: iteration });

  if (liminalFs) {
    try {
      liminalFs.recordRun({
        runId,
        prompt,
        project: options.project,
        status: 'completed',
        artifacts: runArtifact ? [runArtifact] : [],
        metadata: { mode: 'organism', iterations: iteration, finalScore: bestScore },
      });
    } catch {
      // LiminalFS failure must not affect loop operation
    }
  }

  return {
    code: lastMusic + '\n' + lastVisual,
    iterations: iteration,
    completed: true,
    reason: `max iterations reached (${options.maxIterations})`,
    timestamp: new Date().toISOString(),
    duration,
    finalScore: bestScore,
    project: options.project,
  };
}

/**
 * Assess organism quality using syntax-aware heuristics.
 * Evaluates Strudel (music) and Hydra (visual) code patterns.
 */
function assessOrganismQuality(musicCode: string, visualCode: string): number {
  let score = 0;

  // Strudel syntax patterns (valid music code signals)
  const strudelPatterns = [
    /\$\d/,           // mini notation $0, $1
    /s\d/,            // stack references s0, s1
    /~/,              // repeat
    /:seq\(/,         // sequence
    /:percol\(/,      // percolate
    /:chord\(/,       // chord
    /\.\w+\s*\(.*\)/, // method calls (generic pattern matching)
    /"/,              // string literals
    /'/,              // string literals
  ];

  // Hydra syntax patterns (valid visual code signals)
  const hydraPatterns = [
    /osc\(/,          // oscillator
    /shape\(/,        // shape
    /src\(/,          // source
    /solid\(/,        // solid
    /color\(/,        // color
    /rotate\(/,       // rotate
    /scale\(/,        // scale
    /blend\(/,        // blend
    /modulate\(/,     // modulate
    /pixelate\(/,     // pixelate
  ];

  // Check Strudel patterns in music code
  let musicSyntaxScore = 0;
  for (const pattern of strudelPatterns) {
    if (pattern.test(musicCode)) musicSyntaxScore++;
  }
  score += Math.min(0.4, (musicSyntaxScore / strudelPatterns.length) * 0.4);

  // Check Hydra patterns in visual code
  let visualSyntaxScore = 0;
  for (const pattern of hydraPatterns) {
    if (pattern.test(visualCode)) visualSyntaxScore++;
  }
  score += Math.min(0.3, (visualSyntaxScore / hydraPatterns.length) * 0.3);

  // Complexity: non-trivial content length (not just whitespace/comments)
  const strippedMusic = musicCode.replace(/\/\/.*$/gm, '').trim();
  const strippedVisual = visualCode.replace(/\/\/.*$/gm, '').trim();
  const contentLength = strippedMusic.length + strippedVisual.length;
  score += Math.min(0.3, contentLength / 400 * 0.3);

  return Math.max(0, Math.min(1, score));
}
