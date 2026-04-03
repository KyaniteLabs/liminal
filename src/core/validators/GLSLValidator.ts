/**
 * GLSLValidator - GLSL shader-specific validation logic
 *
 * Extracted from CodeValidator.ts using Strangler Fig pattern.
 * Handles validation of GLSL shader code including fragment and vertex shaders.
 */

export interface GLSLValidationResult {
  valid: boolean;
  errors: string[];
}

export class GLSLValidator {
  /**
   * Validate GLSL shader code structure
   */
  static validate(code: string): GLSLValidationResult {
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
    errors.push(...this.validateGLSLSemantics(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate GLSL structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    const hasMain = /void\s+main\s*\(/.test(code);
    const hasFrag = /gl_FragColor|fragColor/.test(code);
    const hasGLPos = /gl_Position|gl_FragCoord/.test(code);

    if (!hasMain && !hasFrag && !hasGLPos) {
      errors.push('GLSL shader must contain void main(), gl_FragColor/fragColor, or gl_Position/gl_FragCoord');
    }

    return errors;
  }

  /**
   * Validate GLSL quality (complexity)
   */
  private static validateQuality(code: string): string[] {
    const errors: string[] = [];

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

    return errors;
  }

  /**
   * Validate GLSL semantics (catches undefined functions, invalid operators)
   */
  private static validateGLSLSemantics(code: string): string[] {
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
      // Skip if it's a definition, a builtin, or a type constructor
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
      if (/[%]\s*[\d.]/.test(cleanLine)) {
        errors.push(`GLSL Line ${i + 1}: Invalid '%' operator - GLSL uses mod(x, y) instead of x % y`);
      }
    }

    // Check for undefined uniforms (if texture2D is used, a sampler2D must be declared)
    if (/texture2D\s*\(/.test(trimmed) && !/sampler2D\s+\w+/.test(trimmed)) {
      errors.push('GLSL: texture2D() used but no sampler2D uniform declared');
    }

    return errors;
  }

  /**
   * Validate HTML-wrapped GLSL
   */
  static validateHTMLWrapped(code: string): string[] {
    const errors: string[] = [];

    if (!/getContext\(['"]webgl/.test(code) && !/<canvas/.test(code)) {
      errors.push('HTML-wrapped GLSL must include <canvas> and webgl context');
    }

    return errors;
  }

  /**
   * Get minimum size requirement for GLSL code
   */
  static getMinSize(): number {
    return 800; // GLSL needs uniforms, main(), and shader logic
  }
}
