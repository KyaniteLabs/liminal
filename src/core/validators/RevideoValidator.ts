/**
 * RevideoValidator - Revideo video scene validation logic
 */

export interface RevideoValidationResult {
  valid: boolean;
  errors: string[];
}

export class RevideoValidator {
  static validate(code: string): RevideoValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Check for Revideo core import or reference
    const hasRevideoCore = /from\s+['"]@revideo\/core['"]/.test(code) ||
                           /\b(makeScene|useTime|createSignal)\b/.test(code);

    if (!hasRevideoCore) {
      errors.push('Revideo code must import from "@revideo/core" or use Revideo functions');
    }

    // Must have makeScene
    if (!code.includes('makeScene')) {
      errors.push('Revideo code must use makeScene to define scenes');
    }

    // Should have an export
    const hasExport = /export\s+default/.test(code);
    if (!hasExport) {
      errors.push('Revideo scene must have an export default makeScene(...)');
    }

    // Check for useTime or createSignal
    const hasUseTime = /useTime/.test(code);
    const hasCreateSignal = /createSignal/.test(code);

    if (!hasUseTime && !hasCreateSignal) {
      errors.push('Revideo scene should use useTime or createSignal for reactivity');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static getMinSize(): number {
    return 400;
  }
}
