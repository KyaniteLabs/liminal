/**
 * HydraValidator - Hydra video synth validation logic
 *
 * Hydra is a live coding video synth language.
 * It uses functions like osc(), src(), noise(), shape(), gradient(), solid()
 * chained with modifiers and ending with .out()
 */

export interface HydraValidationResult {
  valid: boolean;
  errors: string[];
}

export class HydraValidator {
  /**
   * Validate Hydra video synth code structure
   */
  static validate(code: string): HydraValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Basic structure validation
    errors.push(...this.validateStructure(trimmed));

    // Quality checks
    errors.push(...this.validateQuality(trimmed));

    // Semantic validation
    errors.push(...this.validateSemantics(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Hydra structure - must have source and output
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    // Must end with .out() to render
    if (!/\.out\(/.test(code)) {
      errors.push('Hydra code MUST end with .out() to render');
    }

    // Must have a source function
    const hasSource = /\b(osc|src|noise|shape|gradient|solid|voronoi)\s*\(/.test(code);
    if (!hasSource) {
      errors.push('Hydra code should use a source function: osc(), src(), noise(), shape(), gradient(), solid(), voronoi()');
    }

    return errors;
  }

  /**
   * Validate Hydra quality
   */
  private static validateQuality(code: string): string[] {
    const errors: string[] = [];

    // Check for invalid method chains
    const invalidMethods = [
      '.sin(',
      '.cos(',
      '.tan(',
      '.sqrt(',
      '.abs(',
      '.pow(',
      '.saturation(',
      '.feedback(',
      '.kaleidoscope(',
      '.colorShift(',
      '.post(',
    ];
    for (const method of invalidMethods) {
      if (code.includes(method)) {
        errors.push(`Hydra code contains invalid method: ${method} - use math functions differently in Hydra`);
      }
    }

    // Check for multiple outputs (valid in Hydra but warn if conflicting)
    const outCalls = (code.match(/\.out\(/g) || []).length;
    if (outCalls === 0) {
      errors.push('Hydra code must have at least one .out() call');
    }
    if (/\bloop\s*\(/.test(code)) {
      errors.push('Hydra code contains invalid function: loop() - use Hydra chains and .out(), not p5-style loop control');
    }

    return errors;
  }

  /**
   * Validate Hydra semantics
   */
  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    // Valid Hydra source functions
    const validSources = new Set([
      'osc', 'solid', 'gradient', 'noise', 'shape', 'voronoi',
      'src', 'srcO0', 'srcO1', 'srcO2', 'srcO3'
    ]);

    // Valid Hydra transform/modulation functions
    const validTransforms = new Set([
      'color', 'colorama', 'invert', 'contrast', 'brightness', 'luma',
      'thresh', 'posterize', 'saturate', 'hue',
      'rotate', 'scale', 'scrollX', 'scrollY', 'repeat', 'repeatX', 'repeatY',
      'kaleid', 'pixelate', 'modulate', 'modulateHue',
      'blend', 'add', 'sub', 'layer', 'mask', 'mult',
      'diff', 'o0', 'o1', 'o2', 'o3'
    ]);

    // Check for potential typos in function calls
    const funcCalls = code.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
    for (const match of funcCalls) {
      const funcName = match[1];
      const isValid = validSources.has(funcName) || 
                      validTransforms.has(funcName) ||
                      this.isJavaScriptBuiltin(funcName) ||
                      funcName === 'render' || funcName === 'setResolution' ||
                      funcName === 'initCam' || funcName === 'initScreen' ||
                      funcName === 'initVideo' || funcName === 'initImage';
      
      if (!isValid) {
        // Could be a custom variable - don't error but could warn
      }
    }

    // Check for s0.initCam() pattern (valid)
    if (/s\d+\.init(Cam|Screen|Video|Image)/.test(code)) {
      // Valid Hydra initialization pattern
    }

    // Check for proper chain syntax
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('//')) continue;

      // Lines should end with semicolon or be a valid chain
      if (!line.endsWith(';') && !line.endsWith(')') && !line.includes('.out(')) {
        // This is a style preference, not necessarily an error
      }
    }

    return errors;
  }

  /**
   * Check if a name is a JavaScript builtin
   */
  private static isJavaScriptBuiltin(name: string): boolean {
    const builtins = new Set([
      'Array', 'Object', 'String', 'Number', 'Math', 'console', 'log',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'parseInt', 'parseFloat', 'JSON', 'Date'
    ]);
    return builtins.has(name);
  }

  /**
   * Get minimum size requirement for Hydra code
   */
  static getMinSize(): number {
    return 150; // Hydra needs at least source + output
  }
}
