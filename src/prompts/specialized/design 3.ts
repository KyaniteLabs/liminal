/**
 * Design/Delivery specialized prompt with DFM-style validation constraints.
 *
 * Inspired by Print-OS's design prompt adapted to creative code generation.
 * Provides constraint-aware generation with CLARIFY and DELIVERY modes, runtime
 * safety enforcement, and accessibility compliance checks.
 *
 * @module prompts/specialized/design
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Constraints that govern the design output envelope.
 *
 * Every field has a sensible default so callers can pass a partial object
 * and still get a valid constraint set via {@link DEFAULT_DESIGN_CONSTRAINTS}.
 */
export interface DesignConstraints {
  /** Maximum canvas / viewport width in pixels. */
  maxWidth: number;
  /** Maximum canvas / viewport height in pixels. */
  maxHeight: number;
  /** Target frames-per-second the generated code must sustain. */
  targetFPS: number;
  /** Hard ceiling on simultaneous particles / mesh instances. */
  maxParticles: number;
  /** CSS color profile the output must target. */
  colorProfile: 'srgb' | 'display-p3';
  /** WCAG accessibility conformance level. */
  accessibilityLevel: 'AA' | 'AAA';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fallback constraint values used when the caller omits a field.
 */
export const DEFAULT_DESIGN_CONSTRAINTS: Readonly<DesignConstraints> = {
  maxWidth: 1920,
  maxHeight: 1080,
  targetFPS: 60,
  maxParticles: 5000,
  colorProfile: 'srgb',
  accessibilityLevel: 'AA',
};

/**
 * LLM sampling temperature for design generation.
 *
 * 0.4 balances deterministic constraint compliance with enough variation
 * for creative output.
 */
export const DESIGN_TEMPERATURE = 0.4 as const;

/**
 * System prompt for creative code generation with constraint validation.
 *
 * Supports two operating modes:
 * - **CLARIFY** — ask targeted clarifying questions when requirements are
 *   ambiguous rather than guessing.
 * - **DELIVERY** — produce final, tested, production-ready code that
 *   satisfies all declared constraints.
 *
 * Enforced runtime guarantees (no infinite loops, no memory leaks,
 * requestAnimationFrame cleanup, proper resize handlers) are baked into
 * the prompt instructions so the generated code ships clean.
 */
export const DESIGN_SYSTEM_PROMPT = `You are a senior creative technologist operating as a design-for-delivery agent.

Your job is to generate performant, valid creative code (p5.js, Three.js, GLSL,
Canvas 2D, or any creative-coding framework) that ships production-ready.

═══════════════════════════════════════════
OPERATING MODES
═══════════════════════════════════════════

CLARIFY MODE:
When requirements are ambiguous, under-specified, or contradictory, you MUST ask
clarifying questions instead of guessing. List every ambiguity as a numbered
question. Do NOT generate code in CLARIFY mode.

DELIVERY MODE:
Produce final, tested, production-ready code. Every constraint must be satisfied.
If a constraint cannot be met, explain why and propose an alternative BEFORE
generating code.

═══════════════════════════════════════════
HARD CONSTRAINT VALIDATION (DFM RULES)
═══════════════════════════════════════════

Canvas / Viewport:
- maxWidth and maxHeight are hard limits. Never exceed them.
- Always include a resize handler that clamps to these limits.

Performance:
- Sustain the declared targetFPS on mid-range hardware.
- Respect maxParticles — never allocate more simultaneous entities than allowed.
- Use object pools or recycling for particles. No unbounded arrays.

Color:
- Target the declared colorProfile (srgb or display-p3).
- Use the appropriate CSS color() function or canvas color space when display-p3 is required.
- Maintain WCAG contrast ratios for any text or UI elements per the declared accessibilityLevel.

═══════════════════════════════════════════
RUNTIME SAFETY RULES
═══════════════════════════════════════════

1. NO INFINITE LOOPS — every loop must have a bounded termination condition.
2. NO MEMORY LEAKS — remove event listeners, dispose GPU resources, null references.
3. requestAnimationFrame CLEANUP — always store the RAF handle and cancel it on
   teardown / component unmount. Provide a destroy() or cleanup function.
4. RESIZE HANDLERS — include window resize listeners that update canvas dimensions,
   camera aspect ratios, or viewport-dependent values. Debounce when appropriate.
5. ERROR BOUNDARIES — wrap risky operations (WebGL context loss, audio API failures)
   in try/catch with graceful degradation.

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

- Output ONLY raw code. No markdown fences, no code blocks, no explanations.
- No commentary before or after the code.
- The code must be self-contained and immediately runnable.
- If generating an HTML file, start directly with <!DOCTYPE html>.
- If generating a JS module, start with imports or variable declarations.` as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge a partial constraints object with the defaults, returning a full
 * {@link DesignConstraints} instance.
 *
 * @param partial - Fields the caller wants to override.
 * @returns A complete, frozen constraint set.
 */
export function resolveConstraints(
  partial?: Partial<DesignConstraints>,
): Readonly<DesignConstraints> {
  return Object.freeze({ ...DEFAULT_DESIGN_CONSTRAINTS, ...partial });
}

/**
 * Build a fully-formed user prompt for design generation.
 *
 * Combines the creative spec, domain hint, resolved constraints, and
 * operating mode into a single string ready for the LLM.
 *
 * @param spec       - Natural-language description of the desired output.
 * @param domain     - Creative-coding domain (e.g. "p5.js", "three.js", "glsl").
 * @param constraints - Optional partial constraints; merged with defaults.
 * @param mode       - Operating mode. Defaults to "delivery".
 * @returns The assembled user prompt string.
 */
export function buildDesignPrompt(
  spec: string,
  domain: string,
  constraints?: Partial<DesignConstraints>,
  mode?: 'clarify' | 'delivery',
): string {
  const resolved = resolveConstraints(constraints);
  const effectiveMode = mode ?? 'delivery';

  const constraintBlock = [
    `Domain: ${domain}`,
    `Mode: ${effectiveMode.toUpperCase()}`,
    '',
    'CONSTRAINTS:',
    `  maxCanvasWidth:  ${resolved.maxWidth}px`,
    `  maxCanvasHeight: ${resolved.maxHeight}px`,
    `  targetFPS:       ${resolved.targetFPS}`,
    `  maxParticles:    ${resolved.maxParticles}`,
    `  colorProfile:    ${resolved.colorProfile}`,
    `  accessibility:   WCAG ${resolved.accessibilityLevel}`,
  ].join('\n');

  if (effectiveMode === 'clarify') {
    return [
      constraintBlock,
      '',
      'SPEC:',
      spec,
      '',
      'INSTRUCTION:',
      'You are in CLARIFY mode. Do NOT generate code.',
      'Instead, list every ambiguity, missing detail, or contradictory requirement',
      'as numbered questions. Cover: canvas sizing, animation behavior, interaction',
      'model, color palette, performance budget, and accessibility targets.',
    ].join('\n');
  }

  return [
    constraintBlock,
    '',
    'SPEC:',
    spec,
    '',
    'INSTRUCTION:',
    'You are in DELIVERY mode. Generate complete, production-ready code that',
    'satisfies every constraint above. Include cleanup/teardown logic.',
    'Output raw code only — no markdown fences, no explanations.',
  ].join('\n');
}
