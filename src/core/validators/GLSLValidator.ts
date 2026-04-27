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
    const uncommented = this.stripComments(code);

    // Check for complexity - simple gradients are not enough
    const hasNoise = /noise|hash|fbm|snoise|voronoi/.test(uncommented);
    const hasAnimation = /\b(?:u_time|time|iTime)\b/.test(uncommented);
    const vec3Constructors = (uncommented.match(/\bvec3\s*\(/g) ?? []).length;
    const hasMultipleColors = vec3Constructors >= 2 ||
      /vec3\s+\w+\s*=[\s\S]*vec3\s*\([\s\S]*?,[\s\S]*?,[\s\S]*?\)/.test(uncommented);

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
    const trimmed = this.stripComments(code).trim();

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
      // Constructor-like
      'vec2', 'vec3', 'vec4', 'mat2', 'mat3', 'mat4', 'int', 'float', 'bool'
    ]);

    // Extract all function calls (but not variable declarations like 'float x = ...')
    // Match: functionName( but exclude: void/return/if/for/while/variable declarations
    const funcCallPattern = /\b(?!(?:void|float|vec2|vec3|vec4|int|bool|return|if|for|while|switch|case|default)\b)(\w+)\s*(?=\()/g;
    const funcCallMatches = trimmed.matchAll(funcCallPattern);
    for (const match of funcCallMatches) {
      const funcName = match[1];
      // Skip if it's a definition or a builtin
      if (!functionDefs.has(funcName) && !builtInFunctions.has(funcName)) {
        errors.push(`GLSL: Undefined function '${funcName}()' - must be defined before use or is a built-in`);
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

    for (const match of trimmed.matchAll(/\b(?:float|vec2|vec3|vec4)\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g)) {
      const [, funcName, body] = match;
      if (funcName !== 'mainImage' && funcName !== 'main' && /\buv\b/.test(body) && !/\bvec2\s+uv\b/.test(body)) {
        errors.push(`GLSL: helper function '${funcName}' references uv without receiving or declaring it`);
      }
    }

    const floatNames = new Set<string>();
    for (const match of trimmed.matchAll(/\b(?:uniform\s+)?float\s+(\w+)\b/g)) {
      floatNames.add(match[1]);
    }
    for (const name of floatNames) {
      if (new RegExp(`\\b${name}\\.(?:xy|yx|rg|st)\\b`).test(trimmed)) {
        errors.push(`GLSL: float '${name}' cannot use vector field selection like .xy`);
      }
    }

    const vec3Variables = new Set<string>();
    for (const match of trimmed.matchAll(/\bvec3\s+(\w+)\s*=/g)) {
      vec3Variables.add(match[1]);
    }

    for (const variable of vec3Variables) {
      const directFragAssign = new RegExp(`\\b(?:gl_FragColor|fragColor)\\s*=\\s*${variable}\\s*;`);
      if (directFragAssign.test(trimmed)) {
        errors.push(`GLSL: Fragment output must be vec4; wrap vec3 '${variable}' as vec4(${variable}, 1.0)`);
      }
    }

    const vec2ToFloatPattern = /\bfloat\s+(\w+)\s*=\s*smoothstep\([^;]*\babs\s*\([^;]*\.(?:xy|yx|rg|st)\b[^;]*\)\s*[^;]*;/g;
    for (const match of trimmed.matchAll(vec2ToFloatPattern)) {
      errors.push(`GLSL: float '${match[1]}' is assigned a vec2 expression; reduce it with length(), .x, or .y`);
    }

    const vec2Vec3MultiplyPattern = /\b(\w+)\s*\+=\s*sin\([^;]*\buv\b[^;]*\)\s*\*\s*vec3\s*\(/g;
    for (const match of trimmed.matchAll(vec2Vec3MultiplyPattern)) {
      errors.push(`GLSL: '${match[1]}' adds a vec2 expression multiplied by vec3; convert the sine result to vec3 first`);
    }

    return errors;
  }

  private static stripComments(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
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
    return 300; // GLSL can be compact while still runnable and visually non-trivial
  }
}
