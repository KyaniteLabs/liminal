/**
 * P5Validator - P5.js-specific validation logic
 *
 * Extracted from CodeValidator.ts using Strangler Fig pattern.
 * Handles validation of p5.js code including raw JS and HTML-wrapped sketches.
 */

// Note: ValidationResult type can be imported from CodeValidator if needed for integration

export interface P5ValidationResult {
  valid: boolean;
  errors: string[];
}

export class P5Validator {
  /**
   * Validate p5.js code structure
   */
  static validate(code: string): P5ValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    const isHTMLWrapped = this.isAlreadyWrapped(trimmed);

    if (isHTMLWrapped) {
      // HTML-wrapped p5 validation
      errors.push(...this.validateHTMLWrapped(trimmed));
    } else {
      // Raw JS p5 validation
      errors.push(...this.validateRawJS(trimmed));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if code is HTML-wrapped
   */
  private static isAlreadyWrapped(code: string): boolean {
    const trimmed = code.trim();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
  }

  /**
   * Validate raw JS p5 code
   */
  private static validateRawJS(code: string): string[] {
    const errors: string[] = [];

    // Raw p5.js must have setup/draw/createCanvas
    const hasSetup = /function\s+setup\s*\(/.test(code);
    const hasDraw = /function\s+draw\s*\(/.test(code);
    const hasCreateCanvas = /createCanvas\s*\(/.test(code);

    if (!hasSetup && !hasDraw && !hasCreateCanvas) {
      errors.push('p5.js code must contain at least one of: function setup(), function draw(), or createCanvas()');
    }

    // Raw JS should not start with <!DOCTYPE
    if (code.startsWith('<!DOCTYPE')) {
      errors.push('p5.js code looks like HTML but was detected as raw JS — unexpected');
    }

    return errors;
  }

  /**
   * Validate HTML-wrapped p5 code
   */
  private static validateHTMLWrapped(code: string): string[] {
    const errors: string[] = [];

    // HTML-wrapped p5 must include p5 CDN
    if (!/p5\.js|p5\.min\.js/.test(code)) {
      errors.push('HTML-wrapped p5.js must include p5.js CDN');
    }

    // Should have script tag with p5 code
    if (!/<script[^>]*>.*[\s\S]*?<\/script>/i.test(code)) {
      errors.push('HTML-wrapped p5.js should contain a <script> tag with the sketch code');
    }

    return errors;
  }

  /**
   * Get minimum size requirement for p5 code
   */
  static getMinSize(): number {
    return 120; // p5 simple sketch: setup + draw + canvas (min valid sketch)
  }
}
