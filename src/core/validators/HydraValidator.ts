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

    errors.push(...this.validateHeadlessSources(code));
    errors.push(...this.validateRenderTarget(code));

    return errors;
  }

  /**
   * Headless gallery/gauntlet previews cannot grant camera/screen/media input,
   * so source buffers like s0 render blank even when the Hydra syntax is valid.
   */
  private static validateHeadlessSources(code: string): string[] {
    const errors: string[] = [];

    if (/\bs\d+\.init(?:Cam|Screen|Video|Image)\s*\(/.test(code) || /\bsrc\s*\(\s*s\d+\s*\)/.test(code)) {
      errors.push('Hydra headless preview must use generated sources, not camera/screen/video/image input buffers like s0.initCam(), s0.initScreen(), or src(s0)');
    }

    return errors;
  }

  /**
   * Bare render()/render(all) asks Hydra to display the multi-output grid. If
   * any output buffer is unwritten, the unused quadrant renders black; require
   * render(oN) unless all four outputs are intentionally populated.
   */
  private static validateRenderTarget(code: string): string[] {
    const errors: string[] = [];
    const writtenOutputs = this.collectWrittenOutputs(code);

    for (const match of code.matchAll(/\brender\s*\(\s*([^)]*)\s*\)/g)) {
      const target = match[1].trim();
      if (target === '' || /^all$/i.test(target)) {
        const missing = ['o0', 'o1', 'o2', 'o3'].filter(output => !writtenOutputs.has(output));
        if (missing.length > 0) {
          errors.push('Hydra code uses render()/render(all) with unwritten output buffers; use render(o0) or write all o0-o3 outputs to avoid black grid quadrants');
        }
        continue;
      }

      if (/^o[0-3]$/.test(target) && !writtenOutputs.has(target)) {
        errors.push(`Hydra code renders ${target} but never writes .out(${target}); render a written output buffer to avoid blank frames`);
      }
    }

    return errors;
  }

  private static collectWrittenOutputs(code: string): Set<string> {
    const outputs = new Set<string>();
    for (const match of code.matchAll(/\.out\s*\(\s*(o[0-3])?\s*\)/g)) {
      outputs.add(match[1] || 'o0');
    }
    return outputs;
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
      '.screen(',
      '.output(',
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
    if (/\bs0\.(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      errors.push('Hydra code contains invalid s0 source method - use osc(), noise(), shape(), voronoi(), gradient(), or solid() directly');
    }
    if (/\.(?:osc|noise|shape|voronoi|gradient|solid)\s*\(/.test(code)) {
      errors.push('Hydra code contains invalid chained source method - use .add(osc(...)), .blend(noise(...)), or start a new source chain');
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
