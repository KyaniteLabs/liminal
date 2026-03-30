/**
 * ContextBuilder - Build context for injection into prompts
 *
 * This context changes each iteration, providing the "world that changes"
 * while the prompt stays the same.
 *
 * Extracted from RalphLoop.ts (buildContextForInjection).
 */

import { ContextAccumulation } from './ContextAccumulation.js';
import type { IterationContext } from './LoopConfig.js';

/**
 * Build context for injection into prompt
 */
export function buildContextForInjection(
  iteration: number,
  options: { seedCode?: string; seedTemplate?: string; maxContextLength?: number; lastKIterations?: number; visualMappingParams?: Record<string, any> },
  _prompt?: string,
  _loadedPrompt?: string
): string {
  let history = ContextAccumulation.getHistory();

  if (options.lastKIterations != null && options.lastKIterations > 0 && history.length > options.lastKIterations) {
    history = history.slice(-options.lastKIterations);
  }

  let base: string;
  if (history.length === 0) {
    base = `Iteration: ${iteration}\nNo previous context available.`;
  } else {
    const contextParts: string[] = [`Current iteration: ${iteration}`];
    contextParts.push(`\nPrevious iterations: ${history.length}`);

    const mostRecent = history[history.length - 1];
    contextParts.push(`\nLast iteration (${mostRecent.iteration}):`);
    contextParts.push(`- Quality score: ${mostRecent.evaluation.score.toFixed(2)}`);
    contextParts.push(`- Code length: ${mostRecent.code.length} characters`);

    if (mostRecent.evaluation.issues && mostRecent.evaluation.issues.length > 0) {
      contextParts.push(`- Issues to address: ${mostRecent.evaluation.issues.join(', ')}`);
    }

    const codeSnippet = mostRecent.code.substring(0, 500);
    if (codeSnippet.length > 0) {
      contextParts.push(`\nPrevious code (first 500 chars):\n${codeSnippet}`);
    }

    if (history.length > 1) {
      const scores = history.map((h: IterationContext) => h.evaluation.score);
      const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      const improving = scores[scores.length - 1] > scores[0];
      contextParts.push(`\nQuality trend:`);
      contextParts.push(`- Average score: ${avgScore.toFixed(2)}`);
      contextParts.push(`- Trend: ${improving ? 'Improving' : 'Declining'}`);
    }

    base = contextParts.join('\n');
  }

  let context = base;
  if (iteration === 1 && (options.seedCode != null || options.seedTemplate != null)) {
    const seed = options.seedCode ?? options.seedTemplate ?? '';
    context = 'Here is the seed/template; improve it toward the user\'s goal.\nSeed:\n' + seed + '\n\n' + context;
  }

  // Append audio-derived visual parameters if provided
  if (options.visualMappingParams) {
    const vp = options.visualMappingParams;
    context += '\n\nAudio-derived visual parameters:\n';
    if (vp.palette) {
      context += '  Palette: hues=' + JSON.stringify(vp.palette.hues) + ', saturations=' + JSON.stringify(vp.palette.saturations) + ', lightness=' + JSON.stringify(vp.palette.lightness) + '\n';
    }
    if (vp.motion) {
      context += '  Motion: speed=' + vp.motion.speed + ', turbulence=' + vp.motion.turbulence + ', rhythm=' + vp.motion.rhythm + '\n';
    }
    if (vp.form) {
      context += '  Form: complexity=' + vp.form.complexity + ', sharpness=' + vp.form.sharpness + ', scale=' + vp.form.scale + '\n';
    }
    if (vp.dynamics) {
      context += '  Dynamics: energy=' + vp.dynamics.energy + '\n';
    }
    if (vp.composition) {
      context += '  Composition: focalWeight=' + vp.composition.focalWeight + ', balance=' + vp.composition.balance + '\n';
    }
  }

  if (options.maxContextLength != null && options.maxContextLength > 0 && context.length > options.maxContextLength) {
    context = context.slice(-options.maxContextLength);
  }

  return context;
}
