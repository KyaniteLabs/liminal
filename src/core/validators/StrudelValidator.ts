/**
 * StrudelValidator - Strudel pattern language validation logic
 *
 * Strudel is a pattern library for live coding music.
 * It uses pattern functions like s(), note(), stack(), slow(), fast()
 */

export interface StrudelValidationResult {
  valid: boolean;
  errors: string[];
}

export class StrudelValidator {
  /**
   * Validate Strudel pattern code structure
   */
  static validate(code: string): StrudelValidationResult {
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
   * Validate Strudel structure - must contain pattern functions
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    // Must have at least one pattern function
    const hasPatternFunction = /\$:\s*s\(|\.stack\(|sound\(|note\(|\bs\(["']/.test(code);
    
    if (!hasPatternFunction) {
      errors.push('Strudel code must contain pattern functions: s(), note(), stack(), or sound()');
    }

    return errors;
  }

  /**
   * Validate Strudel quality
   */
  private static validateQuality(code: string): string[] {
    const errors: string[] = [];

    // Check for non-ASCII characters (Strudel uses ASCII only)
    if (/[\u4e00-\u9fff]/.test(code)) {
      errors.push('Strudel code contains non-ASCII characters');
    }

    // Check for valid pattern syntax
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('//')) continue;

      // Check for $: prefix on pattern lines (optional but recommended)
      if (/\bs\(|note\(|sound\(/.test(line) && !line.startsWith('$:')) {
        // This is a warning-level issue, not an error
        // Strudel can work without $: in some contexts
      }
    }

    return errors;
  }

  /**
   * Validate Strudel semantics
   */
  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    // Valid Strudel pattern functions
    const validFunctions = new Set([
      's', 'sound', 'note', 'n',
      'stack', 'seq', 'cat', 'fast', 'slow', 'early', 'late',
      'rev', 'jux', 'off', 'every', 'when', 'fix',
      'gain', 'cut', 'cutoff', 'resonance', 'hcutoff', 'hresonance',
      'bandf', 'bandq', 'delay', 'delaytime', 'delayfeedback',
      'room', 'size', 'orbit', 'speed', 'range', 'struct',
      'sine', 'saw', 'square', 'tri', 'rand',
      'irand', 'choose', 'pick', 'collect', 'cycle',
      'bite', 'chop', 'striate', 'slice', 'loopAt',
      'chunk', 'chunkback', 'invert', 'palindrome',
      'degrade', 'degradeBy', 'sometimes', 'sometimesBy',
      'often', 'rarely', 'almostNever', 'almostAlways',
      'hush', 'bpm', 'cps', 'setcps'
    ]);

    // Check for potential typos in function calls
    const funcCalls = code.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
    for (const match of funcCalls) {
      const funcName = match[1];
      if (!validFunctions.has(funcName) && !this.isJavaScriptBuiltin(funcName)) {
        // Could be a custom function - warn but don't error
      }
    }

    // Check for unmatched parentheses (basic check)
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push(`Strudel code has unmatched parentheses: ${openParens} opening, ${closeParens} closing`);
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
   * Get minimum size requirement for Strudel code
   */
  static getMinSize(): number {
    return 100; // Strudel patterns can be concise but need enough for a complete pattern
  }
}
