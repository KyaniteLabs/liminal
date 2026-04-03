/**
 * ThreeValidator - Three.js-specific validation logic
 *
 * Extracted from CodeValidator.ts using Strangler Fig pattern.
 * Handles validation of Three.js code including ES modules and global THREE.
 */

export interface ThreeValidationResult {
  valid: boolean;
  errors: string[];
}

export class ThreeValidator {
  /**
   * Validate Three.js code structure
   */
  static validate(code: string): ThreeValidationResult {
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

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Three.js structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    const hasTHREE = /THREE\.|import.*from\s+['"]three['"]|from\s+['"]three['"]/.test(code);

    if (!hasTHREE) {
      errors.push('Three.js code must reference THREE object or import from "three"');
    }

    return errors;
  }

  /**
   * Validate Three.js quality checks
   */
  private static validateQuality(code: string): string[] {
    const errors: string[] = [];

    // Check for ES module issues (from AUDIT: CDNs use global, code uses imports)
    const usesImportMap = /<script\s+type="importmap">/.test(code);
    const usesGlobalTHREE = /new\s+THREE\./.test(code) && !/import.*three/.test(code);

    if (usesImportMap && usesGlobalTHREE) {
      errors.push('Three.js code mixing importmap with global THREE - use one style consistently');
    }

    return errors;
  }

  /**
   * Check if code is HTML-wrapped
   */
  private static _isAlreadyWrapped(_code: string): boolean {
    const trimmed = code.trim();
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html');
  }

  /**
   * Validate HTML-wrapped Three.js
   */
  static validateHTMLWrapped(code: string): string[] {
    const errors: string[] = [];

    if (!/three\.js|three\.module\.js|from\s+['"]three['"]|importmap/.test(code)) {
      errors.push('HTML-wrapped Three.js must include Three.js CDN or importmap');
    }

    return errors;
  }

  /**
   * Detect if code uses ES modules (importmap) vs global THREE
   */
  static detectModuleStyle(code: string): 'module' | 'global' | 'unknown' {
    const hasImportMap = /<script\s+type="importmap">/.test(code);
    const hasImport = /import.*from\s+['"]three['"]/.test(code);
    const hasGlobalTHREE = /new\s+THREE\./.test(code) && !hasImport;

    if (hasImportMap || hasImport) return 'module';
    if (hasGlobalTHREE) return 'global';
    return 'unknown';
  }

  /**
   * Get minimum size requirement for Three.js code
   */
  static getMinSize(): number {
    return 800; // Three.js needs scene setup, objects, animation
  }
}
