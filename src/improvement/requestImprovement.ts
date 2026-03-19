/**
 * Self-improvement callback API: request "improve me" for p5.js sketch code.
 * Uses existing pluggable LLM backend (ConfigLoader / getEffectiveConfig, LLMClient).
 * When LLM is unconfigured, returns a template fallback. No sandbox or safety limits (handled elsewhere).
 */

import { getEffectiveConfig } from '../config/ConfigLoader.js';
import { LLMClient } from '../llm/LLMClient.js';

export interface RequestImprovementState {
  /** Optional project directory or path to config/atelier.json for project LLM config */
  projectConfigPath?: string;
}

/**
 * Request an improved version of the given p5.js sketch.
 * Uses the same LLM backend as the rest of the app (getEffectiveConfig + LLMClient).
 * When no LLM is configured, returns a valid p5.js template as fallback.
 *
 * @param currentCode - Current p5.js sketch code to improve
 * @param state - Optional state (e.g. projectConfigPath for project config)
 * @returns Promise resolving to { code: string } with the improved code
 */
export async function requestImprovement(
  currentCode: string,
  state?: RequestImprovementState
): Promise<{ code: string }> {
  const projectPath = state?.projectConfigPath;
  const effectiveConfig = await getEffectiveConfig(undefined, projectPath);

  const llm = new LLMClient({
    provider: effectiveConfig.provider,
    baseUrl: effectiveConfig.baseUrl,
    model: effectiveConfig.model,
    apiKey: effectiveConfig.apiKey,
  });

  if (!LLMClient.isConfigured()) {
    return { code: templateFallback(currentCode) };
  }

  try {
    const response = await llm.improveP5Sketch(currentCode || '');
    const code = response.success && response.code?.trim() ? response.code.trim() : templateFallback(currentCode);
    return { code };
  } catch {
    return { code: templateFallback(currentCode) };
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
