/**
 * CodeValidator — structural validation gate for generated code.
 *
 * Prevents LLM reasoning text, broken code, or incomplete output from being
 * saved as "success". Runs three checks in order:
 *   1. Strip LLM reasoning / preamble text
 *   2. Structural validation per domain (p5, shader, three, remotion, music)
 *   3. Self-contained check for already-wrapped HTML
 *   4. SIZE VALIDATION - reject outputs that are too small (likely failed generation)
 *   5. DOMAIN-SPECIFIC VALIDATION - catch common LLM errors per domain
 */

export interface ValidationResult {
  valid: boolean;
  cleanedCode: string;
  errors: string[];
}

type Domain = 'p5' | 'shader' | 'glsl' | 'three' | 'remotion' | 'music' | 'hydra' | 'strudel' | 'unknown';

// -----------------------------------------------------------------------------
// Size validation - from AUDIT: Qwen35 produced 66b and 74b "successes" that failed
// -----------------------------------------------------------------------------
const MIN_SIZE_REQUIREMENTS: Record<Domain, number> = {
  'p5': 500,        // p5 needs setup, draw, and some logic
  'shader': 800,    // GLSL needs uniforms, main(), and shader logic
  'glsl': 800,      // GLSL alias
  'three': 800,     // Three.js needs scene setup, objects, animation
  'remotion': 500,  // Remotion component needs imports and JSX
  'music': 100,     // Music code can be compact
  'hydra': 150,     // Hydra chains need multiple method calls
  'strudel': 100,   // Strudel patterns can be compact
  'unknown': 100,
};

// -----------------------------------------------------------------------------
// Reasoning-text patterns (lines to strip from LLM output)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// LLM contamination patterns (tags that wrap reasoning and must be stripped)
// Found in audit: Strudel and Hydra files contained <think>...</think> tags
// from models like Qwen/DeepSeek that output reasoning content
// -----------------------------------------------------------------------------
const CONTAMINATION_PATTERNS: RegExp[] = [
  /<think>[\s\S]*?<\/think>/gi,  // <think>...</think> tags with content
  /<thinking>[\s\S]*?<\/thinking>/gi,  // <thinking>...</thinking> variant
];

// -----------------------------------------------------------------------------
// Domain detection
// -----------------------------------------------------------------------------
function detectDomain(code: string): Domain {
  if (isAlreadyWrapped(code)) {
    // Three.js: check for ES module imports or importmap containing three
    if (code.includes('import * as THREE') || 
        code.includes('from "three"') || 
        code.includes('from \'three\'') ||
        /<script\s+type="importmap"[^>]*>[\s\S]*?"three"[\s\S]*?<\/script>/.test(code)) {
      return 'three';
    }
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

  // Hydra specific
  if (/osc\(|src\(|noise\(|shape\(|gradient\(|solid\(/.test(code) && /\.out\(/.test(code) && !/\$:/.test(code)) {
    return 'hydra';
  }
  
  // Strudel specific
  if (/\$:\s*s\(|\.stack\(|\.slow\(|\.fast\(/.test(code) && !/osc\(|src\(/.test(code)) {
    return 'strudel';
  }

  // Music (general - Strudel / Hydra)
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

// -----------------------------------------------------------------------------
// Code-start patterns (lines that indicate actual code begins)
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Pre-check: Strip LLM contamination tags (<think>, <thinking>)
// These tags wrap model reasoning and must be removed entirely
// -----------------------------------------------------------------------------
function stripContamination(code: string): string {
  let cleaned = code;
  for (const pattern of CONTAMINATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

// -----------------------------------------------------------------------------
// Check 1: Strip reasoning text
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Check 1.5: Detect contamination (warn if found)
// -----------------------------------------------------------------------------
function detectContamination(code: string): string[] {
  const errors: string[] = [];
  // Check for unclosed or partial contamination tags
  if (/<think>/i.test(code) || /<thinking>/i.test(code)) {
    errors.push('LLM contamination detected: <think> or <thinking> tags found in output');
  }
  return errors;
}

// -----------------------------------------------------------------------------
// Check 2: Structural validation per domain
// -----------------------------------------------------------------------------
function validateStructure(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  const trimmed = code.trim();

  if (!trimmed) {
    errors.push('Code is empty after stripping reasoning text');
    return errors;
  }

  // Detect any remaining contamination
  errors.push(...detectContamination(trimmed));

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
    case 'hydra': {
      // Check for valid Hydra patterns
      const hasOut = /\.out\(/.test(trimmed);
      if (!hasOut) {
        errors.push('Hydra code MUST end with .out() to render');
      }
      
      // Check for common invalid methods (from AUDIT findings)
      // These are literal method names/patterns that don't exist in Hydra
      const invalidMethodPatterns = [
        { pattern: /\.sin\(/, name: '.sin(' },   // Should be Math.sin or within osc()
        { pattern: /\.cos\(/, name: '.cos(' },   // Should be Math.cos or within osc()
        { pattern: /colorShift/, name: 'colorShift' },
        { pattern: /feedback/, name: 'feedback' },
      ];
      for (const { pattern, name } of invalidMethodPatterns) {
        if (pattern.test(trimmed)) {
          errors.push(`Hydra code contains invalid method: ${name} — check API documentation`);
        }
      }
      
      // Check for valid source functions
      const hasSource = /osc\(|src\(|noise\(|shape\(|gradient\(|solid\(/.test(trimmed);
      if (!hasSource) {
        errors.push('Hydra code should use a source function: osc(), src(), noise(), shape(), gradient(), or solid()');
      }
      break;
    }
    case 'strudel': {
      // Check for valid Strudel patterns - be more permissive
      // Accept: $: s(), .stack(), sound(), note(), plain s(), etc.
      const hasPattern = /\$:\s*s\(/.test(trimmed) || 
                         /\.stack\(/.test(trimmed) ||
                         /sound\(/.test(trimmed) ||
                         /note\(/.test(trimmed) ||
                         /\bs\(["']/.test(trimmed);  // s("bd") pattern
      if (!hasPattern) {
        errors.push('Strudel code should contain pattern functions: s(), sound(), note(), or .stack()');
      }
      // Check for non-ASCII characters
      if (/[\u4e00-\u9fff]/.test(trimmed)) {
        errors.push('Strudel code contains non-ASCII characters (likely LLM contamination)');
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
      
      // Strudel-specific validations (from audit: found Chinese characters in output)
      if (hasStrudel) {
        // Check for non-ASCII characters that might be LLM artifacts
        if (/[\u4e00-\u9fff]/.test(trimmed)) {
          errors.push('Strudel code contains non-ASCII characters (likely LLM contamination)');
        }
        // Check for valid Strudel pattern syntax
        const strudelPatternCount = (trimmed.match(/\$:\s*s\(/g) || []).length;
        if (strudelPatternCount === 0 && !trimmed.includes('.stack(')) {
          errors.push('Strudel code should use $: pattern syntax or .stack() for layering');
        }
      }
      
      // Hydra-specific validations (from audit: found duplicate .out() calls)
      if (hasHydra) {
        const outCount = (trimmed.match(/\.out\(/g) || []).length;
        // Hydra chains should end with .out() - multiple outs can be valid for multi-buffer
        // but we should at least have some outputs
        if (outCount === 0) {
          errors.push('Hydra code should end with .out() to render to an output buffer');
        }
        // Check for render() call which is needed for multi-buffer setups
        if (outCount > 1 && !trimmed.includes('render(')) {
          errors.push('Hydra code with multiple outputs should call render() to composite');
        }
      }
      break;
    }
    case 'unknown':
      // Unknown domain — just check non-empty
      break;
  }

  return errors;
}

// -----------------------------------------------------------------------------
// Check 3: Self-contained HTML check
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Check 4: Size validation - from AUDIT findings
// Reject outputs that are too small (likely failed generations)
// -----------------------------------------------------------------------------
function validateSize(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  const size = code.length;
  const minSize = MIN_SIZE_REQUIREMENTS[domain] || MIN_SIZE_REQUIREMENTS['unknown'];
  
  if (size < minSize) {
    errors.push(`${domain} code is too small (${size}b) - minimum is ${minSize}b. This likely indicates a failed generation.`);
  }
  
  return errors;
}

// -----------------------------------------------------------------------------
// Check 5: Domain-specific quality checks
// -----------------------------------------------------------------------------
function validateQuality(code: string, domain: Domain): string[] {
  const errors: string[] = [];
  
  switch (domain) {
    case 'glsl':
    case 'shader': {
      // Check for complexity - simple gradients are not enough
      const hasNoise = /noise|hash|fbm|snoise|voronoi/.test(code);
      const hasAnimation = /u_time|time/.test(code);
      const hasMultipleColors = /vec3\([^)]+,[^)]+,[^)]+\)/.test(code);
      
      if (!hasNoise && !hasMultipleColors) {
        errors.push('GLSL shader should use noise functions or multiple colors for complexity');
      }
      if (!hasAnimation) {
        errors.push('GLSL shader should animate using u_time');
      }
      
      // GLSL Semantic Validation
      errors.push(...validateGLSLSemantics(code));
      break;
    }
    case 'three': {
      // Check for ES module issues (from AUDIT: CDNs use global, code uses imports)
      const usesImportMap = /<script\s+type="importmap">/.test(code);
      const usesGlobalTHREE = /new\s+THREE\./.test(code) && !/import.*three/.test(code);
      
      if (usesImportMap && usesGlobalTHREE) {
        errors.push('Three.js code mixing importmap with global THREE - use one style consistently');
      }
      break;
    }
  }
  
  return errors;
}

// -----------------------------------------------------------------------------
// Check 5.5: GLSL Semantic Validation (catches undefined functions, invalid operators)
// -----------------------------------------------------------------------------
function validateGLSLSemantics(code: string): string[] {
  const errors: string[] = [];
  const trimmed = code.trim();
  
  // Extract all function definitions
  const functionDefs = new Set<string>();
  const funcDefMatches = trimmed.matchAll(/(?:float|vec2|vec3|vec4|int|void)\s+(\w+)\s*\(/g);
  for (const match of funcDefMatches) {
    functionDefs.add(match[1]);
  }
  
  // GLSL built-in functions (common ones)
  const builtInFunctions = new Set([
    // Trigonometry
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    // Exponential
    'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt',
    // Common
    'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep',
    // Geometric
    'length', 'distance', 'dot', 'cross', 'normalize', 'faceforward', 'reflect', 'refract',
    // Texture
    'texture2D', 'texture', 'textureLod',
    // Noise (if defined in shader)
    'noise', 'hash', 'fbm', 'snoise',
    // Constructor-like
    'vec2', 'vec3', 'vec4', 'mat2', 'mat3', 'mat4', 'int', 'float', 'bool'
  ]);
  
  // Extract all function calls
  const funcCallMatches = trimmed.matchAll(/(\w+)\s*\(/g);
  for (const match of funcCallMatches) {
    const funcName = match[1];
    // Skip if it's a definition (we're in the call list), a builtin, or a type constructor
    if (!functionDefs.has(funcName) && !builtInFunctions.has(funcName)) {
      // Check if it's actually a macro or keyword
      if (!['if', 'for', 'while', 'return', 'switch', 'case', 'default'].includes(funcName)) {
        errors.push(`GLSL: Undefined function '${funcName}()' - must be defined before use or is a built-in`);
      }
    }
  }
  
  // Check for invalid % operator (GLSL uses mod() instead)
  // Match % that isn't inside a comment or string
  const lines = trimmed.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Remove comments
    const cleanLine = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//, '');
    if (/%\s*[\d.]/.test(cleanLine)) {
      errors.push(`GLSL Line ${i + 1}: Invalid '%' operator - GLSL uses mod(x, y) instead of x % y`);
    }
  }
  
  // Check for undefined uniforms (if texture2D is used, a sampler2D must be declared)
  if (/texture2D\s*\(/.test(trimmed) && !/sampler2D\s+\w+/.test(trimmed)) {
    errors.push('GLSL: texture2D() used but no sampler2D uniform declared');
  }
  
  return errors;
}

// -----------------------------------------------------------------------------
// Check 5.6: Tone.js API Validation (catches hallucinated classes)
// -----------------------------------------------------------------------------
const VALID_TONE_CLASSES = new Set([
  // Core
  'Transport', 'Destination', 'Master', 'Listener', 'Context',
  // Sources
  'Oscillator', 'PulseOscillator', 'PWMOscillator', 'FatOscillator',
  'AMSynth', 'FMSynth', 'MonoSynth', 'PolySynth', 'Synth', 'MembraneSynth', 
  'MetalSynth', 'NoiseSynth', 'DuoSynth', 'PluckSynth', 'GrainSynth',
  // Effects
  'Reverb', 'Delay', 'FeedbackDelay', 'PingPongDelay',
  'Distortion', 'Chorus', 'Phaser', 'Tremolo', 'Vibrato',
  'Filter', 'EQ3', 'Compressor', 'Limiter', 'Gate',
  'AutoFilter', 'AutoPanner', 'AutoWah', 'BitCrusher', 'Chebyshev',
  'Convolver', 'JCReverb', 'StereoWidener', 'PitchShift', 'FrequencyShifter',
  // Components
  'Envelope', 'LFO', 'AmplitudeEnvelope', 'FrequencyEnvelope', 'ScaledEnvelope',
  'Meter', 'FFT', 'Waveform', 'DCMeter', 'LevelMeter',
  // Signals
  'Gain', 'Signal', 'Multiply', 'Add', 'Subtract', 'Abs', 'Negate', 'Pow',
  // Events/Sequencing
  'Loop', 'Part', 'Pattern', 'Sequence', 'Event', 'Draw',
  // Utils
  'PanVol', 'Panner', 'Panner3D', 'Merge', 'Split', 'Mono', 'Solo',
  'ToneAudioBuffer', 'ToneAudioBuffers', 'Time', 'Frequency'
]);

export function validateToneJS(code: string): string[] {
  const errors: string[] = [];
  
  // Find all Tone.XXX class instantiations
  const classMatches = code.matchAll(/new\s+Tone\.(\w+)/g);
  for (const match of classMatches) {
    const className = match[1];
    if (!VALID_TONE_CLASSES.has(className)) {
      errors.push(`Tone.js: Invalid class 'Tone.${className}' - check Tone.js API documentation`);
    }
  }
  
  // Find Tone.XXX method calls (some classes are method-only)
  const methodMatches = code.matchAll(/Tone\.(\w+)\s*\(/g);
  for (const match of methodMatches) {
    const methodName = match[1];
    // Common valid methods
    const validMethods = new Set([
      'start', 'stop', 'pause', 'dispose', 'toDestination', 'toMaster',
      'connect', 'disconnect', 'chain', 'fan',
      'set', 'get', 'triggerAttack', 'triggerRelease', 'triggerAttackRelease',
      'sync', 'unsync', 'mute', 'unmute',
      'dbToGain', 'gainToDb', 'intervalToFrequencyRatio', 'frequencyToMidi',
      'now', 'immediate', 'seconds', 'transport', 'context', 'destination'
    ]);
    if (!VALID_TONE_CLASSES.has(methodName) && !validMethods.has(methodName)) {
      // Might be a valid method we haven't listed, don't error yet
    }
  }
  
  // Check for common hallucinations from AUDIT
  const hallucinationPatterns = [
    { pattern: /Tone\.Reverberator/, suggestion: 'Tone.Reverb' },
    { pattern: /Tone\.DrivingPattern/, suggestion: 'Tone.Pattern or Tone.Loop' },
    { pattern: /Tone\.ReverbNode/, suggestion: 'Tone.Reverb' },
    { pattern: /Tone\.PitchBend/, suggestion: 'Tone.PitchShift or signal value manipulation' },
    { pattern: /Tone\.Noise\s*\(\s*['"]8ves['"]/, suggestion: 'Tone.Noise("brown") or Tone.Noise("pink")' }
  ];
  
  for (const { pattern, suggestion } of hallucinationPatterns) {
    if (pattern.test(code)) {
      errors.push(`Tone.js: Invalid API '${pattern.source.replace(/\\/g, '')}' - did you mean '${suggestion}'?`);
    }
  }
  
  return errors;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export class CodeValidator {
  /**
   * Validate generated code in multiple passes:
   *   1. Strip LLM reasoning text
   *   2. Strip contamination tags
   *   3. Structural validation per domain
   *   4. Self-contained HTML check
   *   5. Size validation (reject tiny outputs)
   *   6. Quality checks
   *
   * Returns { valid, cleanedCode, errors }.
   * If `valid` is false, `cleanedCode` may be empty or partial.
   */
  static validate(code: string, domain?: string): ValidationResult {
    if (!code || typeof code !== 'string') {
      return { valid: false, cleanedCode: '', errors: ['No code provided'] };
    }

    // Pre-check: Strip LLM contamination tags (e.g., <think> blocks)
    const decontaminated = stripContamination(code);
    
    // Check 1: Strip reasoning text
    const cleaned = stripReasoningText(decontaminated);
    if (!cleaned.trim()) {
      return { valid: false, cleanedCode: '', errors: ['Code is empty after stripping LLM reasoning text'] };
    }

    // Detect domain if not provided
    const detectedDomain: Domain = (domain as Domain) || detectDomain(cleaned);

    // Check 2: Structural validation
    const structuralErrors = validateStructure(cleaned, detectedDomain);

    // Check 3: Self-contained check
    const selfContainedErrors = validateSelfContained(cleaned, detectedDomain);
    
    // Check 4: Size validation (NEW from AUDIT)
    const sizeErrors = validateSize(cleaned, detectedDomain);
    
    // Check 5: Quality checks (NEW from AUDIT)
    const qualityErrors = validateQuality(cleaned, detectedDomain);
    
    // Check 6: Tone.js API validation (catches hallucinated classes)
    const toneJSErrors = detectedDomain === 'unknown' && /Tone\./.test(cleaned) 
      ? validateToneJS(cleaned) 
      : [];

    const allErrors = [...structuralErrors, ...selfContainedErrors, ...sizeErrors, ...qualityErrors, ...toneJSErrors];

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
  
  /** Get minimum size requirement for a domain */
  static getMinSize(domain: Domain): number {
    return MIN_SIZE_REQUIREMENTS[domain] || MIN_SIZE_REQUIREMENTS['unknown'];
  }
  
  /** Validate Tone.js code for hallucinated APIs */
  static validateToneJS(code: string): string[] {
    return validateToneJS(code);
  }
}
