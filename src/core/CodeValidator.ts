/**
 * CodeValidator — structural validation gate for generated code.
 *
 * STRANGLER FIG PATTERN: Delegates to domain-specific validators:
 * - P5Validator: src/core/validators/P5Validator.ts
 * - GLSLValidator: src/core/validators/GLSLValidator.ts
 * - ThreeValidator: src/core/validators/ThreeValidator.ts
 * - StrudelValidator: src/core/validators/StrudelValidator.ts
 * - HydraValidator: src/core/validators/HydraValidator.ts
 * - ToneValidator: src/core/validators/ToneValidator.ts
 * - KineticValidator: src/core/validators/KineticValidator.ts
 * - HTMLValidator: src/core/validators/HTMLValidator.ts
 * - ASCIIValidator: src/core/validators/ASCIIValidator.ts
 */

import path from 'path';
import { P5Validator } from './validators/P5Validator.js';
import { GLSLValidator } from './validators/GLSLValidator.js';
import { ThreeValidator } from './validators/ThreeValidator.js';
import { StrudelValidator } from './validators/StrudelValidator.js';
import { HydraValidator } from './validators/HydraValidator.js';
import { ToneValidator } from './validators/ToneValidator.js';
import { RevideoValidator } from './validators/RevideoValidator.js';
import { KineticValidator } from './validators/KineticValidator.js';
import { HTMLValidator } from './validators/HTMLValidator.js';
import { ASCIIValidator } from './validators/ASCIIValidator.js';
import { HyperFramesValidator } from './validators/HyperFramesValidator.js';
import { TextGenValidator } from './validators/TextGenValidator.js';
import { validateSVG } from '../generators/svg/SVGValidator.js';
import { validateImportPath, ImportValidationError } from '../security/ImportValidator.js';
import {
  type ValidationResult,
  type Domain,
  stripContamination,
  stripReasoningText,
  isAlreadyWrapped,
  detectContamination,
  REASONING_PATTERNS,
} from './validators/types.js';

// -----------------------------------------------------------------------------
// Executable-JS security screen
//
// The HTMLValidator screens the 'html' domain for dangerous JS patterns, but
// p5/three/hydra/shader/tone/kinetic/strudel code also runs in a browser and
// was never screened. These domains share the same threat surface, so apply
// the same dangerous-pattern checks to every executable JS art domain.
// -----------------------------------------------------------------------------
const EXECUTABLE_JS_DOMAINS: ReadonlySet<Domain> = new Set<Domain>([
  'p5', 'three', 'hydra', 'tone', 'kinetic', 'strudel', 'shader', 'glsl',
]);

// Always-dangerous in raw JS regardless of markup context.
const DANGEROUS_JS_PATTERNS: ReadonlyArray<{ pattern: RegExp; msg: string }> = [
  { pattern: /\beval\s*\(/i, msg: 'Dangerous eval() detected' },
  { pattern: /new\s+Function\s*\(/i, msg: 'Dangerous new Function() detected' },
  { pattern: /document\.write\s*\(/i, msg: 'document.write() is discouraged' },
];

// HTML-attribute injection sinks. Only meaningful when the artifact contains
// markup (HTML-wrapped); flagging ` one = 5` style raw-JS would be a false
// positive, so these only run against wrapped artifacts.
const DANGEROUS_MARKUP_PATTERNS: ReadonlyArray<{ pattern: RegExp; msg: string }> = [
  { pattern: /\son\w+\s*=\s*["']/i, msg: 'Event handler attributes (on*) are not allowed' },
  { pattern: /javascript:/i, msg: 'javascript: URLs are not allowed' },
];

// Node-only / non-browser module specifiers must never appear in browser art
// code. A generated sketch that imports these is either malicious or broken.
const FORBIDDEN_IMPORT_SPECIFIERS: ReadonlyArray<RegExp> = [
  /^node:/i,
  /^(?:fs|path|child_process|os|net|http|https|crypto|process|vm|module|worker_threads|cluster|dgram|tls|repl)$/i,
];

function validateJSSecurity(code: string, domain: Domain): string[] {
  if (!EXECUTABLE_JS_DOMAINS.has(domain)) return [];

  const errors: string[] = [];
  for (const { pattern, msg } of DANGEROUS_JS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push(`JS Security: ${msg}`);
    }
  }
  if (isAlreadyWrapped(code)) {
    for (const { pattern, msg } of DANGEROUS_MARKUP_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`JS Security: ${msg}`);
      }
    }
  }
  errors.push(...validateImportSources(code));
  return errors;
}

/**
 * Reject disallowed imports in generated art code. Wires the ImportValidator
 * (filesystem path-traversal control) into the live validation path: any
 * relative/local import specifier is resolved against a virtual artifact root
 * and rejected if it escapes that root (e.g. ../../../etc/passwd). Bare
 * node-builtin specifiers are rejected outright.
 */
function validateImportSources(code: string): string[] {
  const errors: string[] = [];
  // Match both `import ... from 'x'` and bare `import 'x'` / dynamic import('x').
  const specifierRe = /\bimport\s*(?:[^'";]*?\bfrom\s*)?\(?\s*['"]([^'"]+)['"]/g;
  const ARTIFACT_ROOT = '/__sinter_artifact_root__';
  let match: RegExpExecArray | null;
  while ((match = specifierRe.exec(code)) !== null) {
    const spec = match[1].trim();
    if (!spec) continue;

    if (FORBIDDEN_IMPORT_SPECIFIERS.some(p => p.test(spec))) {
      errors.push(`Import Security: disallowed module import "${spec}" - node/runtime modules are not available in browser art`);
      continue;
    }

    // Only local/relative/absolute filesystem-style specifiers are traversal
    // candidates. Bare package names and URLs (http(s)://, //cdn) are not.
    const isLocal = spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
    if (!isLocal || /^\/\//.test(spec) || /^[a-z]+:\/\//i.test(spec)) continue;

    try {
      validateImportPath(path.join(ARTIFACT_ROOT, spec), ARTIFACT_ROOT);
    } catch (error) {
      if (error instanceof ImportValidationError) {
        errors.push(`Import Security: import path "${spec}" escapes the artifact root`);
      } else {
        throw error;
      }
    }
  }
  return errors;
}

// -----------------------------------------------------------------------------
// Size validation
// -----------------------------------------------------------------------------
const MIN_SIZE_REQUIREMENTS: Record<Domain, number> = {
  'p5': P5Validator.getMinSize(),
  'shader': GLSLValidator.getMinSize(),
  'glsl': GLSLValidator.getMinSize(),
  'three': ThreeValidator.getMinSize(),
  'strudel': StrudelValidator.getMinSize(),
  'hydra': HydraValidator.getMinSize(),
  'tone': ToneValidator.getMinSize(),
  'svg': 40,
  'revideo': RevideoValidator.getMinSize(),
  'hyperframes': HyperFramesValidator.getMinSize(),
  'html': HTMLValidator.getMinSize(),
  'ascii': ASCIIValidator.getMinSize(),
  'kinetic': KineticValidator.getMinSize(),
  'music': 100,
  'textgen': TextGenValidator.getMinSize(),
  'unknown': 100,
};

// -----------------------------------------------------------------------------
// Domain detection
// -----------------------------------------------------------------------------
function detectDomain(code: string): Domain {
  if (/data-composition-id/i.test(code) && (/gsap\.(?:timeline|from|to)\s*\(/.test(code) || /window\.__timelines/.test(code))) return 'hyperframes';
  if (/window\.__timelines/.test(code) && /class\s*=\s*["'][^"']*\bclip\b[^"']*["']/i.test(code)) return 'hyperframes';

  if (isAlreadyWrapped(code)) {
    // Check for HTML-specific domains first
    const hasThreeImport = code.includes('import * as THREE') ||
                           code.includes('from "three"') ||
                           code.includes('from \'three\'') ||
                           /<script\s+type="importmap"[^>]*>[\s\S]*?"three"[\s\S]*?<\/script>/.test(code);
    if (hasThreeImport) return 'three';

    const hasToneImport = /from\s+['"]tone['"]/.test(code) || /\bTone\./.test(code);
    if (hasToneImport) return 'tone';

    const hasP5Import = /p5\.js|p5\.min\.js/.test(code);
    if (hasP5Import) return 'p5';

    const hasWebGL = /getContext\(['"]webgl/.test(code);
    if (hasWebGL) return 'shader';

    // Generic HTML
    return 'html';
  }

  // Check for HTML document
  if (/^<svg\b/i.test(code.trim())) return 'svg';

  // Check for HTML document
  const hasDoctype = code.trim().toUpperCase().startsWith('<!DOCTYPE');
  const hasHTMLTag = /<html[^>]*>/i.test(code);
  if (hasDoctype || hasHTMLTag) return 'html';

  // Check for GLSL
  const hasVoidMain = /void\s+main\s*\(/.test(code);
  const hasMainImage = /void\s+mainImage\s*\(/.test(code);
  const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
  const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
  const hasPrecision = /\bprecision\s+(?:lowp|mediump|highp)\s+float\s*;/.test(code);
  const hasShaderBuiltins = /\b(?:gl_FragCoord|iResolution|iTime|fragCoord|fragColor)\b/.test(code);
  const glslCount = [hasVoidMain, hasMainImage, hasFragColor, hasUniforms, hasPrecision, hasShaderBuiltins].filter(Boolean).length;
  if (glslCount >= 2 && !code.includes('function setup()') && !code.includes('function draw()')) return 'shader';

  // Check for Revideo
  if (/\bmakeScene|@revideo\/core/.test(code)) return 'revideo';

  // Check for Strudel before Hydra: Strudel audio chains can use .shape()/.out().
  if (
    /\bbpm\s*\(/.test(code) ||
    /\bsetcp[ms]\s*\(/.test(code) ||
    /\bs\s*\(\s*["']/.test(code) ||
    /\b(?:sound|note|n|seq|stack)\s*\(/.test(code) ||
    /\$:\s*s\(|\.stack\(|\.slow\(|\.fast\(/.test(code)
  ) {
    return 'strudel';
  }

  // Check for Hydra
  if (/\b(osc|src|noise|shape|gradient|solid|voronoi)\s*\(/.test(code) && /\.out\(/.test(code) && !/\$:/.test(code)) {
    return 'hydra';
  }

  // Check for Tone.js
  if (/\bTone\./.test(code) || /from\s+['"]tone['"]/.test(code)) return 'tone';

  // Check for Three.js before broad music fallback: Three render() is not audio.
  if (/\bTHREE\.|import.*three|new\s+THREE\./.test(code)) return 'three';

  // Check for general music patterns
  if (/\$:\s*s\(/.test(code) || /\bosc\(|\bsrc\(|\brender\(/.test(code) || /strudel|hydra/i.test(code)) return 'music';

  // Check for ASCII art after code/music domains. Multi-line Hydra/Strudel
  // chains are plain ASCII too, so ASCII must not preempt executable domains.
  if (ASCIIValidator.detectASCII(code)) return 'ascii';

  // Default to p5
  return 'p5';
}

function stripCommentsAndStringLiterals(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/(["'`])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g, ' ');
}

function validateNoGuaranteedRuntimeThrow(code: string, domain: Domain): string[] {
  if (domain === 'shader' || domain === 'glsl' || domain === 'svg' || domain === 'ascii') {
    return [];
  }

  const executableSurface = stripCommentsAndStringLiterals(code);
  if (/\bthrow\b/.test(executableSurface)) {
    return ['Generated code contains an explicit throw statement that would fail at runtime'];
  }

  return [];
}

// -----------------------------------------------------------------------------
// Domain-specific validation
// -----------------------------------------------------------------------------
function validateStructure(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  const trimmed = code.trim();

  if (!trimmed) {
    errors.push('Code is empty after stripping reasoning text');
    return errors;
  }

  errors.push(...detectContamination(trimmed));
  errors.push(...validateNoGuaranteedRuntimeThrow(trimmed, domain));
  errors.push(...validateJSSecurity(trimmed, domain));

  switch (domain) {
    case 'p5': {
      const result = P5Validator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'shader':
    case 'glsl': {
      if (!isAlreadyWrapped(trimmed)) {
        const result = GLSLValidator.validate(trimmed);
        errors.push(...result.errors);
      }
      break;
    }
    case 'three': {
      const result = ThreeValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'strudel': {
      const result = StrudelValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'hydra': {
      const result = HydraValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'tone': {
      const result = ToneValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'svg': {
      const result = validateSVG(trimmed);
      if (!result.valid && result.error) errors.push(result.error);
      break;
    }
    case 'revideo': {
      const result = RevideoValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'hyperframes': {
      const result = HyperFramesValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'kinetic': {
      const result = KineticValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'html': {
      const result = HTMLValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'ascii': {
      const result = ASCIIValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'music': {
      // Music domain is a fallback - check for strudel or hydra patterns
      const hasStrudel = /\$:\s*s\(/.test(trimmed);
      const hasHydra = /\bosc\(|\bsrc\(|\brender\(/.test(trimmed);
      if (!hasStrudel && !hasHydra) {
        errors.push('Music code must contain Strudel or Hydra patterns');
      }
      break;
    }
    case 'textgen': {
      const result = TextGenValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
  }

  return errors;
}

function validateSelfContained(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  if (!isAlreadyWrapped(code)) return errors;

  switch (domain) {
    case 'p5': {
      if (!/p5\.js|p5\.min\.js/.test(code)) errors.push('HTML-wrapped p5.js must include p5.js CDN');
      break;
    }
    case 'three': {
      errors.push(...ThreeValidator.validateHTMLWrapped(code));
      break;
    }
    case 'shader':
    case 'glsl': {
      errors.push(...GLSLValidator.validateHTMLWrapped(code));
      break;
    }
    case 'tone': {
      // Tone.js should have its CDN or import
      if (!/tone(?:\.min)?\.js|\/tone\/|from\s+['"]tone['"]/i.test(code)) {
        errors.push('HTML-wrapped Tone.js should include Tone.js CDN or module import');
      }
      errors.push(...HTMLValidator.validate(code).errors);
      break;
    }
    case 'revideo': {
      // Revideo is JSX source, not HTML-wrapped
      break;
    }
    case 'hyperframes': {
      // HyperFrames is standalone HTML+GSAP, self-contained by design
      break;
    }
    case 'html': {
      // HTML validation already checks structure
      break;
    }
  }
  return errors;
}

function validateSize(code: string, domain: Domain): string[] {
  const size = code.length;
  const minSize = MIN_SIZE_REQUIREMENTS[domain] || MIN_SIZE_REQUIREMENTS['unknown'];
  if (size < minSize) {
    return [`${domain} code is too small (${size}b) - minimum is ${minSize}b`];
  }
  return [];
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export class CodeValidator {
  static validate(code: string, domain?: string): ValidationResult {
    if (!code || typeof code !== 'string') {
      return { valid: false, cleanedCode: '', errors: ['No code provided'] };
    }

    const decontaminated = stripContamination(code);
    const firstContentLine = decontaminated.split('\n').find(line => line.trim().length > 0)?.trim() ?? '';
    const explicitDomain = domain as Domain | undefined;
    const preserveTextOutput = explicitDomain === 'textgen' ||
      (ASCIIValidator.detectASCII(decontaminated) && !REASONING_PATTERNS.some(pattern => pattern.test(firstContentLine)));
    let cleaned = preserveTextOutput
      ? decontaminated.replace(/^\s*\n/, '').trimEnd()
      : stripReasoningText(decontaminated);
    if (!cleaned.trim()) {
      // Safety net: the code-oriented stripper emptied the content. When a
      // generation's domain is misattributed (e.g. a concrete poem validated
      // under the RalphLoop 'p5' fallback), stripReasoningText treats the prose
      // as reasoning and nukes the whole legitimate output. Preserve the original
      // text ONLY when it does not look like reasoning — a real poem/text-art has
      // no reasoning markers, whereas "The user wants…"/"We need to…" does. This
      // rescues misjudged text output while still rejecting reasoning-only
      // responses (which then have no valid artifact). Uses the same
      // first-content-line heuristic as preserveTextOutput above.
      const preserved = decontaminated.replace(/^\s*\n/, '').trimEnd();
      const looksLikeReasoning = REASONING_PATTERNS.some(pattern => pattern.test(firstContentLine));
      if (!preserved.trim() || looksLikeReasoning) {
        return { valid: false, cleanedCode: '', errors: ['Code is empty after stripping LLM reasoning text'] };
      }
      cleaned = preserved;
    }

    const detectedDomain = explicitDomain || detectDomain(cleaned);

    // ASCII sanitation must live HERE, not only in ASCIIArtGenerator: RalphLoop's
    // LLM-revised candidates reach validation without passing the generator's
    // formatASCII (a sanitized first draft failed again within hours on a revised
    // candidate's U+25C9/U+25AE glyphs). Sanitized text flows out as cleanedCode.
    const finalCode = detectedDomain === 'ascii' ? ASCIIValidator.sanitize(cleaned) : cleaned;

    const allErrors = [
      ...validateStructure(finalCode, detectedDomain),
      ...validateSelfContained(finalCode, detectedDomain),
      ...validateSize(finalCode, detectedDomain),
    ];

    return { valid: allErrors.length === 0, cleanedCode: finalCode, errors: allErrors };
  }

  static detectDomain(code: string): string {
    return detectDomain(code);
  }

  static getMinSize(domain: Domain): number {
    return MIN_SIZE_REQUIREMENTS[domain] || MIN_SIZE_REQUIREMENTS['unknown'];
  }
}
