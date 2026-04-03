/**
 * Self-improvement callback API: request "improve me" for p5.js sketch code.
 * Uses existing pluggable LLM backend (ConfigLoader / getEffectiveConfig, LLMClient).
 * When LLM is unconfigured, returns a template fallback. No sandbox or safety limits (handled elsewhere).
 */

import { getEffectiveConfig } from '../config/ConfigLoader.js';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';

export interface RequestImprovementState {
  /** Optional project directory or path to config/liminal.json for project LLM config */
  projectConfigPath?: string;
  /** Optional pre-configured LLMClient instance for dependency injection */
  llm?: LLMClient;
}

/**
 * Request an improved version of the given p5.js sketch.
 * Uses the same LLM backend as the rest of the app (getEffectiveConfig + LLMClient).
 * When no LLM is configured, returns a valid p5.js template as fallback.
 *
 * @param currentCode - Current p5.js sketch code to improve
 * @param state - Optional state (e.g. projectConfigPath for project config)
 * @returns Promise resolving to { code: string; improved: boolean; error?: string }
 */
export async function requestImprovement(
  currentCode: string,
  state?: RequestImprovementState
): Promise<{ code: string; improved: boolean; error?: string }> {
  const projectPath = state?.projectConfigPath;

  let llm: LLMClient;
  if (state?.llm) {
    llm = state.llm;
  } else {
    const effectiveConfig = await getEffectiveConfig(undefined, projectPath);
    llm = new LLMClient({
      baseUrl: effectiveConfig.baseUrl,
      model: effectiveConfig.model,
      apiKey: effectiveConfig.apiKey,
      role: 'generator',
    });
  }

  if (!LLMClient.isConfigured()) {
    return { code: templateFallback(currentCode), improved: false, error: 'LLM not configured' };
  }

  try {
    const response = await llm.improveP5Sketch(currentCode || '');
    if (response.success && response.code?.trim()) {
      return { code: response.code.trim(), improved: true };
    }
    const fallback = templateFallback(currentCode);
    return { code: fallback, improved: false, error: response.error || 'LLM returned empty code' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    Logger.error('requestImprovement', `Failed: ${msg}`);
    return { code: templateFallback(currentCode), improved: false, error: msg };
  }
}

/**
 * When LLM is unconfigured or fails, return a minimal valid p5.js sketch (slight improvement over empty/basic code).
 */
function templateFallback(currentCode: string): string {
  const trimmed = (currentCode || '').trim();
  if (trimmed && /function\s+setup\s*\(/.test(trimmed) && /createCanvas\s*\(/.test(trimmed)) {
    // Already has setup and createCanvas; return a minimal "improved" version with a comment
    return trimmed.includes('draw()')
      ? trimmed
      : trimmed + '\n\nfunction draw() {\n  background(220);\n  ellipse(width/2, height/2, 50, 50);\n}';
  }
  return `function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(220);
  fill(100, 150, 200);
  ellipse(width / 2, height / 2, 100, 100);
}`;
}
