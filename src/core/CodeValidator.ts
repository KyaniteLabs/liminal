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
 * - RemotionValidator: src/core/validators/RemotionValidator.ts
 * - HTMLValidator: src/core/validators/HTMLValidator.ts
 * - ASCIIValidator: src/core/validators/ASCIIValidator.ts
 */

import { P5Validator } from './validators/P5Validator.js';
import { GLSLValidator } from './validators/GLSLValidator.js';
import { ThreeValidator } from './validators/ThreeValidator.js';
import { StrudelValidator } from './validators/StrudelValidator.js';
import { HydraValidator } from './validators/HydraValidator.js';
import { ToneValidator } from './validators/ToneValidator.js';
import { RemotionValidator } from './validators/RemotionValidator.js';
import { RevideoValidator } from './validators/RevideoValidator.js';
import { HTMLValidator } from './validators/HTMLValidator.js';
import { ASCIIValidator } from './validators/ASCIIValidator.js';
import {
  type ValidationResult,
  type Domain,
  stripContamination,
  stripReasoningText,
  isAlreadyWrapped,
  detectContamination,
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
  'remotion': RemotionValidator.getMinSize(),
  'revideo': RevideoValidator.getMinSize(),
  'html': HTMLValidator.getMinSize(),
  'ascii': ASCIIValidator.getMinSize(),
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

    const hasRemotion = /from\s+['"]remotion['"]/.test(code) || /useCurrentFrame|AbsoluteFill/.test(code);
    if (hasRemotion) return 'remotion';

    const hasP5Import = /p5\.js|p5\.min\.js/.test(code);
    if (hasP5Import) return 'p5';

    const hasWebGL = /getContext\(['"]webgl/.test(code);
    if (hasWebGL) return 'shader';

    // Generic HTML
    return 'html';
  }

  // Check for HTML document
  const hasDoctype = code.trim().toUpperCase().startsWith('<!DOCTYPE');
  const hasHTMLTag = /<html[^>]*>/i.test(code);
  if (hasDoctype || hasHTMLTag) return 'html';

  // Check for ASCII art
  if (ASCIIValidator.detectASCII(code)) return 'ascii';

  // Check for GLSL
  const hasVoidMain = /void\s+main\s*\(/.test(code);
  const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
  const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
  const glslCount = [hasVoidMain, hasFragColor, hasUniforms].filter(Boolean).length;
  if (glslCount >= 2 && !code.includes('function setup()') && !code.includes('function draw()')) return 'shader';

  // Check for Revideo (before Remotion)
  if (/\bmakeScene|@revideo\/core/.test(code)) return 'revideo';

  // Check for Remotion
  if (/useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(code)) return 'remotion';

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
      const result = GLSLValidator.validate(trimmed);
      errors.push(...result.errors);
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
    case 'remotion': {
      const result = RemotionValidator.validate(trimmed);
      errors.push(...result.errors);
      break;
    }
    case 'revideo': {
      const result = RevideoValidator.validate(trimmed);
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
      if (!/tone\.js|from\s+['"]tone['"]/.test(code)) {
        errors.push('HTML-wrapped Tone.js should include Tone.js CDN or module import');
      }
      break;
    }
    case 'revideo': {
      // Revideo is JSX source, not HTML-wrapped
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

    const cleaned = stripReasoningText(stripContamination(code));
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
