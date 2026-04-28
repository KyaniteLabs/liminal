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
 * - HTMLValidator: src/core/validators/HTMLValidator.ts
 * - ASCIIValidator: src/core/validators/ASCIIValidator.ts
 */

import { P5Validator } from './validators/P5Validator.js';
import { GLSLValidator } from './validators/GLSLValidator.js';
import { ThreeValidator } from './validators/ThreeValidator.js';
import { StrudelValidator } from './validators/StrudelValidator.js';
import { HydraValidator } from './validators/HydraValidator.js';
import { ToneValidator } from './validators/ToneValidator.js';
import { RevideoValidator } from './validators/RevideoValidator.js';
import { HTMLValidator } from './validators/HTMLValidator.js';
import { ASCIIValidator } from './validators/ASCIIValidator.js';
import { HyperFramesValidator } from './validators/HyperFramesValidator.js';
import { validateSVG } from '../generators/svg/SVGValidator.js';
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
  'kinetic': 100,
  'music': 100,
  'unknown': 100,
};

// -----------------------------------------------------------------------------
// Domain detection
// -----------------------------------------------------------------------------
function detectDomain(code: string): Domain {
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

  // Check for HyperFrames (HTML+GSAP compositing)
  if (/data-composition-id/.test(code) && /gsap\.timeline|gsap\.to\(/.test(code)) return 'hyperframes';
  if (/window\.__timelines/.test(code) && /class="clip"/.test(code)) return 'hyperframes';

  // Check for Hydra
  if (/\b(osc|src|noise|shape|gradient|solid|voronoi)\s*\(/.test(code) && /\.out\(/.test(code) && !/\$:/.test(code)) {
    return 'hydra';
  }

  // Check for Strudel
  if (/\$:\s*s\(|\.stack\(|\.slow\(|\.fast\(/.test(code) && !/\bosc\(|\bsrc\(/.test(code)) {
    return 'strudel';
  }

  // Check for Tone.js
  if (/\bTone\./.test(code) || /from\s+['"]tone['"]/.test(code)) return 'tone';

  // Check for general music patterns
  if (/\$:\s*s\(/.test(code) || /\bosc\(|\bsrc\(|\brender\(/.test(code) || /strudel|hydra/i.test(code)) return 'music';

  // Check for Three.js
  if (/\bTHREE\.|import.*three|new\s+THREE\./.test(code)) return 'three';

  // Check for ASCII art after code/music domains. Multi-line Hydra/Strudel
  // chains are plain ASCII too, so ASCII must not preempt executable domains.
  if (ASCIIValidator.detectASCII(code)) return 'ascii';

  // Default to p5
  return 'p5';
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
    const cleaned = ASCIIValidator.detectASCII(decontaminated) && !REASONING_PATTERNS.some(pattern => pattern.test(firstContentLine))
      ? decontaminated.replace(/^\s*\n/, '').trimEnd()
      : stripReasoningText(decontaminated);
    if (!cleaned.trim()) {
      return { valid: false, cleanedCode: '', errors: ['Code is empty after stripping LLM reasoning text'] };
    }

    const detectedDomain = (domain as Domain) || detectDomain(cleaned);

    const allErrors = [
      ...validateStructure(cleaned, detectedDomain),
      ...validateSelfContained(cleaned, detectedDomain),
      ...validateSize(cleaned, detectedDomain),
    ];

    return { valid: allErrors.length === 0, cleanedCode: cleaned, errors: allErrors };
  }

  static detectDomain(code: string): string {
    return detectDomain(code);
  }

  static getMinSize(domain: Domain): number {
    return MIN_SIZE_REQUIREMENTS[domain] || MIN_SIZE_REQUIREMENTS['unknown'];
  }
}
