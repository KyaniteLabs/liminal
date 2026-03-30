/**
 * CodeValidator — structural validation gate for generated code.
 *
 * Prevents LLM reasoning text, broken code, or incomplete output from being
 * saved as "success". Runs three checks in order:
 *   1. Strip LLM reasoning / preamble text
 *   2. Structural validation per domain (p5, shader, three, remotion, music)
 *   3. Self-contained check for already-wrapped HTML
 */

export interface ValidationResult {
  valid: boolean;
  cleanedCode: string;
  errors: string[];
}

type Domain = 'p5' | 'shader' | 'three' | 'remotion' | 'music' | 'unknown';

// ---------------------------------------------------------------------------
// Reasoning-text patterns (lines to strip from LLM output)
// ---------------------------------------------------------------------------
const REASONING_PATTERNS: RegExp[] = [
  /^(The user wants?|I'll create|I need to|Based on|Let me|Here's a|Here is a|Key elements|Creating a|Generating a|I'm going to|I will|I've created|I have created)/i,
  /^As an AI/i,
  /^(Note:|Disclaimer:|Important:)/i,
  /^(Sure!?|Below is|This will|This creates?|This generates?)/i,
  /^(This code|The code|This sketch|This shader|This scene|This composition)/i,
  /^\d+\.\s+\S/i, // numbered list items: "1. Something"
  /^-\s+[A-Za-z]/, // bullet-point lines: "- Something"
  /^(\*\*|__).*?(\*\*|__)\s*[:-]/, // bold headings like "**Approach:**"
  /^#{1,3}\s/, // markdown headings
  /^I'll\s+(use|make|add|create|ensure|include|apply|build|implement|draw|generate)/i,
  /^I need to/i,
];

// ---------------------------------------------------------------------------
// Domain detection
// ---------------------------------------------------------------------------
function detectDomain(code: string): Domain {
  if (isAlreadyWrapped(code)) {
    if (code.includes('import * as THREE') || code.includes('from "three"') || code.includes('from \'three\'')) return 'three';
    if (/getContext\(['"]webgl/.test(code)) return 'shader';
    return 'p5';
  }
  // Three.js
  const hasDoctype = code.trim().startsWith('<!DOCTYPE html>');
  const hasHTMLTag = /<html[^>]*>/i.test(code);
  const hasThreeImport = /import.*\bfrom\s+['"]three['"]/.test(code) || /<script\s+type="importmap">/.test(code);
  if (hasDoctype && hasHTMLTag && hasThreeImport) return 'three';

  // GLSL
  const hasVoidMain = /void\s+main\s*\(/.test(code);
  const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
  const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
  const glslCount = [hasVoidMain, hasFragColor, hasUniforms].filter(Boolean).length;
  if (glslCount >= 2 && !code.includes('function setup()') && !code.includes('function draw()')) return 'shader';

  // Remotion
  if (/useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(code)) return 'remotion';

  // Music (Strudel / Hydra)
  if (/\$:\s*s\(/.test(code) || /osc\(|src\(|render\(/.test(code) || /strudel|hydra/i.test(code)) return 'music';

  // Three.js (not HTML-wrapped, bare imports)
  if (/THREE\.|import.*three|new\s+THREE\./.test(code)) return 'three';

  // Default p5
  return 'p5';
}

function isAlreadyWrapped(code: string): boolean {
  const trimmed = code.trim();
  return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
}

// ---------------------------------------------------------------------------
// Code-start patterns (lines that indicate actual code begins)
// ---------------------------------------------------------------------------
const CODE_START_PATTERNS: RegExp[] = [
  /^(let|const|var|function|class|if|for|while|switch|try|return|import|export|async|await|throw|new)\b/,
  /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying|in\s+|out\s+)\b/,
  /^<!DOCTYPE\s/i,
  /^<html/i,
  /^<head/i,
  /^<body/i,
  /^<script/i,
  /^<style/i,
  /^<canvas/i,
  /^<div/i,
  /^\$/,
  /^\{/,
  /^\[/,
  /^\(/,
  /^['"`]/,  // string literals
  /^\/\//,   // single-line comments in code
  /^\/\*/,   // multi-line comments in code
];

// ---------------------------------------------------------------------------
// Check 1: Strip reasoning text
// ---------------------------------------------------------------------------
function stripReasoningText(code: string): string {
  const lines = code.split('\n');
  const kept: string[] = [];
  let insideFence = false;
  let foundCodeStart = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track markdown fences — keep everything inside code fences
    if (trimmed.startsWith('```')) {
      insideFence = !insideFence;
      continue; // don't include the fence markers themselves
    }
    if (insideFence) {
      kept.push(line);
      foundCodeStart = true;
      continue;
    }

    // Once we've found code start, keep everything
    if (foundCodeStart) {
      kept.push(line);
      continue;
    }

    // Skip empty lines before code
    if (!trimmed) continue;

    // Skip known reasoning patterns
    if (REASONING_PATTERNS.some(p => p.test(trimmed))) continue;

    // Skip bullet-point lines that describe features (not code)
    if (/^-\s+[A-Z]/.test(trimmed) && !/^-\s+(\d|--?)/.test(trimmed)) continue;

    // Check if this line looks like code
    if (CODE_START_PATTERNS.some(p => p.test(trimmed))) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }

    // If we haven't found code start yet and this line doesn't match
    // reasoning patterns, it might be code — keep it and mark as found
    // (e.g., assignment like `jellyfish = [];`)
    if (/^[\w$]+\s*[=([{:]/.test(trimmed)) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }

    // Skip anything else before code start (narrative text, descriptions)
    // BUT if the line has code-like features (semicolons, braces, parens), keep it
    if (/[;{}]/.test(trimmed) || /\w+\(.*\)/.test(trimmed)) {
      foundCodeStart = true;
      kept.push(line);
      continue;
    }
  }

  return kept.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Check 2: Structural validation per domain
// ---------------------------------------------------------------------------
function validateStructure(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  const trimmed = code.trim();

  if (!trimmed) {
    errors.push('Code is empty after stripping reasoning text');
    return errors;
  }

  switch (domain) {
    case 'p5': {
      // Raw p5.js must have setup/draw/createCanvas; wrapped HTML must include p5 CDN
      const hasSetup = /function\s+setup\s*\(/.test(trimmed);
      const hasDraw = /function\s+draw\s*\(/.test(trimmed);
      const hasCreateCanvas = /createCanvas\s*\(/.test(trimmed);
      if (!hasSetup && !hasDraw && !hasCreateCanvas) {
        errors.push('p5.js code must contain at least one of: function setup(), function draw(), or createCanvas()');
      }
      // Raw JS (not HTML) should not start with <!DOCTYPE
      if (!isAlreadyWrapped(trimmed) && trimmed.startsWith('<!DOCTYPE')) {
        errors.push('p5.js code looks like HTML but was detected as raw JS — unexpected');
      }
      break;
    }
    case 'shader': {
      const hasMain = /void\s+main\s*\(/.test(trimmed);
      const hasFrag = /gl_FragColor|fragColor/.test(trimmed);
      const hasGLPos = /gl_Position|gl_FragCoord/.test(trimmed);
      if (!hasMain && !hasFrag && !hasGLPos) {
        errors.push('GLSL shader must contain void main(), gl_FragColor/fragColor, or gl_Position/gl_FragCoord');
      }
      break;
    }
    case 'three': {
      const hasTHREE = /THREE\.|import.*from\s+['"]three['"]|from\s+['"]three['"]/.test(trimmed);
      if (!hasTHREE) {
        errors.push('Three.js code must reference THREE object or import from "three"');
      }
      break;
    }
    case 'remotion': {
      const hasRemotion = /useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(trimmed);
      if (!hasRemotion) {
        errors.push('Remotion code must use useCurrentFrame, AbsoluteFill, Composition, or import from "remotion"');
      }
      break;
    }
    case 'music': {
      const hasStrudel = /\$:\s*s\(/.test(trimmed);
      const hasHydra = /osc\(|src\(|render\(/.test(trimmed);
      if (!hasStrudel && !hasHydra) {
        errors.push('Music code must contain Strudel patterns ($: s(...)) or Hydra functions (osc(), src(), render())');
      }
      break;
    }
    case 'unknown':
      // Unknown domain — just check non-empty
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Check 3: Self-contained HTML check
// ---------------------------------------------------------------------------
function validateSelfContained(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  if (!isAlreadyWrapped(code)) return errors; // raw JS is fine — HTMLWrapper adds CDN

  switch (domain) {
    case 'p5': {
      if (!/p5\.js|p5\.min\.js/.test(code)) {
        errors.push('HTML-wrapped p5.js must include p5.js CDN');
      }
      break;
    }
    case 'three': {
      if (!/three\.js|three\.module\.js|from\s+['"]three['"]|importmap/.test(code)) {
        errors.push('HTML-wrapped Three.js must include Three.js CDN or importmap');
      }
      break;
    }
    case 'shader': {
      if (!/getContext\(['"]webgl/.test(code) && !/<canvas/.test(code)) {
        errors.push('HTML-wrapped GLSL must include <canvas> and webgl context');
      }
      break;
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export class CodeValidator {
  /**
   * Validate generated code in three passes:
   *   1. Strip LLM reasoning text
   *   2. Structural validation per domain
   *   3. Self-contained HTML check
   *
   * Returns { valid, cleanedCode, errors }.
   * If `valid` is false, `cleanedCode` may be empty or partial.
   */
  static validate(code: string, domain?: string): ValidationResult {
    if (!code || typeof code !== 'string') {
      return { valid: false, cleanedCode: '', errors: ['No code provided'] };
    }

    // Check 1: Strip reasoning text
    const cleaned = stripReasoningText(code);
    if (!cleaned.trim()) {
      return { valid: false, cleanedCode: '', errors: ['Code is empty after stripping LLM reasoning text'] };
    }

    // Detect domain if not provided
    const detectedDomain: Domain = (domain as Domain) || detectDomain(cleaned);

    // Check 2: Structural validation
    const structuralErrors = validateStructure(cleaned, detectedDomain);

    // Check 3: Self-contained check
    const selfContainedErrors = validateSelfContained(cleaned, detectedDomain);

    const allErrors = [...structuralErrors, ...selfContainedErrors];

    return {
      valid: allErrors.length === 0,
      cleanedCode: cleaned,
      errors: allErrors,
    };
  }

  /** Expose domain detection for tests / callers */
  static detectDomain(code: string): string {
    return detectDomain(code);
  }
}
