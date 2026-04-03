/**
 * CodeValidator — structural validation gate for generated code.
 *
 * STRANGLER FIG PATTERN: Delegates to domain-specific validators:
 * - P5Validator: src/core/validators/P5Validator.ts
 * - GLSLValidator: src/core/validators/GLSLValidator.ts
 * - ThreeValidator: src/core/validators/ThreeValidator.ts
 */

import { P5Validator } from './validators/P5Validator.js';
import { GLSLValidator } from './validators/GLSLValidator.js';
import { ThreeValidator } from './validators/ThreeValidator.js';
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
  'remotion': 500,
  'music': 100,
  'hydra': 150,
  'strudel': 100,
  'unknown': 100,
};

// -----------------------------------------------------------------------------
// Domain detection
// -----------------------------------------------------------------------------
function detectDomain(code: string): Domain {
  if (isAlreadyWrapped(code)) {
    if (code.includes('import * as THREE') ||
        code.includes('from "three"') ||
        code.includes('from \'three\'') ||
        /<script\s+type="importmap"[^>]*>[\s\S]*?"three"[\s\S]*?<\/script>/.test(code)) {
      return 'three';
    }
    if (/getContext\(['"]webgl/.test(code)) return 'shader';
    return 'p5';
  }

  const hasDoctype = code.trim().startsWith('<!DOCTYPE html>');
  const hasHTMLTag = /<html[^>]*>/i.test(code);
  const hasThreeImport = /import.*\bfrom\s+['"]three['"]/.test(code) || /<script\s+type="importmap">/.test(code);
  if (hasDoctype && hasHTMLTag && hasThreeImport) return 'three';

  const hasVoidMain = /void\s+main\s*\(/.test(code);
  const hasFragColor = /gl_FragColor|out\s+vec4\s+fragColor/.test(code);
  const hasUniforms = /uniform\s+(vec2|vec3|vec4|float|int|mat)/.test(code);
  const glslCount = [hasVoidMain, hasFragColor, hasUniforms].filter(Boolean).length;
  if (glslCount >= 2 && !code.includes('function setup()') && !code.includes('function draw()')) return 'shader';

  if (/useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(code)) return 'remotion';

  if (/osc\(|src\(|noise\(|shape\(|gradient\(|solid\(/.test(code) && /\.out\(/.test(code) && !/\$:/.test(code)) {
    return 'hydra';
  }

  if (/\$:\s*s\(|\.stack\(|\.slow\(|\.fast\(/.test(code) && !/osc\(|src\(/.test(code)) {
    return 'strudel';
  }

  if (/\$:\s*s\(/.test(code) || /osc\(|src\(|render\(/.test(code) || /strudel|hydra/i.test(code)) return 'music';
  if (/THREE\.|import.*three|new\s+THREE\./.test(code)) return 'three';

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
    case 'hydra': {
      if (!/\.out\(/.test(trimmed)) errors.push('Hydra code MUST end with .out() to render');
      if (/\.sin\(|\.cos\(/.test(trimmed)) errors.push('Hydra code contains invalid method: .sin( or .cos(');
      if (!/osc\(|src\(|noise\(|shape\(|gradient\(|solid\(/.test(trimmed)) {
        errors.push('Hydra code should use a source function');
      }
      break;
    }
    case 'strudel': {
      if (!/\$:\s*s\(|\.stack\(|sound\(|note\(|\bs\(["']/.test(trimmed)) {
        errors.push('Strudel code should contain pattern functions');
      }
      if (/[\u4e00-\u9fff]/.test(trimmed)) errors.push('Strudel code contains non-ASCII characters');
      break;
    }
    case 'remotion': {
      if (!/useCurrentFrame|AbsoluteFill|<Composition|from\s+['"]remotion['"]/.test(trimmed)) {
        errors.push('Remotion code must use Remotion components');
      }
      break;
    }
    case 'music': {
      const hasStrudel = /\$:\s*s\(/.test(trimmed);
      const hasHydra = /osc\(|src\(|render\(/.test(trimmed);
      if (!hasStrudel && !hasHydra) errors.push('Music code must contain Strudel or Hydra patterns');
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
// Tone.js validation
// -----------------------------------------------------------------------------
const VALID_TONE_CLASSES = new Set([
  'Transport', 'Destination', 'Master', 'Listener', 'Context',
  'Oscillator', 'PulseOscillator', 'PWMOscillator', 'FatOscillator',
  'AMSynth', 'FMSynth', 'MonoSynth', 'PolySynth', 'Synth', 'MembraneSynth',
  'MetalSynth', 'NoiseSynth', 'DuoSynth', 'PluckSynth', 'GrainSynth',
  'Reverb', 'Delay', 'FeedbackDelay', 'PingPongDelay',
  'Distortion', 'Chorus', 'Phaser', 'Tremolo', 'Vibrato',
  'Filter', 'EQ3', 'Compressor', 'Limiter', 'Gate',
  'AutoFilter', 'AutoPanner', 'AutoWah', 'BitCrusher', 'Chebyshev',
  'Convolver', 'JCReverb', 'StereoWidener', 'PitchShift', 'FrequencyShifter',
  'Envelope', 'LFO', 'AmplitudeEnvelope', 'FrequencyEnvelope', 'ScaledEnvelope',
  'Meter', 'FFT', 'Waveform', 'DCMeter', 'LevelMeter',
  'Gain', 'Signal', 'Multiply', 'Add', 'Subtract', 'Abs', 'Negate', 'Pow',
  'Loop', 'Part', 'Pattern', 'Sequence', 'Event', 'Draw',
  'PanVol', 'Panner', 'Panner3D', 'Merge', 'Split', 'Mono', 'Solo',
  'ToneAudioBuffer', 'ToneAudioBuffers', 'Time', 'Frequency'
]);

export function validateToneJS(code: string): string[] {
  const errors: string[] = [];

  for (const match of code.matchAll(/new\s+Tone\.(\w+)/g)) {
    if (!VALID_TONE_CLASSES.has(match[1])) {
      errors.push(`Tone.js: Invalid class 'Tone.${match[1]}'`);
    }
  }

  const hallucinations = [
    { pattern: /Tone\.Reverberator/, msg: 'Tone.Reverb' },
    { pattern: /Tone\.DrivingPattern/, msg: 'Tone.Pattern or Tone.Loop' },
    { pattern: /Tone\.ReverbNode/, msg: 'Tone.Reverb' },
  ];

  for (const { pattern, msg } of hallucinations) {
    if (pattern.test(code)) errors.push(`Tone.js: Invalid API - did you mean '${msg}'?`);
  }

  return errors;
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
      ...((detectedDomain === 'music' || detectedDomain === 'unknown') && /Tone\./.test(cleaned)
        ? validateToneJS(cleaned)
        : [])
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
