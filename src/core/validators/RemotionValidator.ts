/**
 * RemotionValidator - Remotion video composition validation logic
 *
 * Remotion is a React framework for creating programmatic video.
 * It uses React components with hooks like useCurrentFrame, useVideoConfig
 */

export interface RemotionValidationResult {
  valid: boolean;
  errors: string[];
}

export class RemotionValidator {
  /**
   * Valid Remotion exports and hooks
   */
  private static readonly VALID_REMOTION_IMPORTS = new Set([
    'useCurrentFrame', 'useVideoConfig', 'AbsoluteFill', 'Composition',
    'interpolate', 'spring', 'Easing', 'Sequence', 'Series',
    'Audio', 'Img', 'Video', 'OffthreadVideo', 'staticFile',
    'getInputProps', 'delayRender', 'continueRender'
  ]);

  /**
   * Validate Remotion code structure
   */
  static validate(code: string): RemotionValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Basic structure validation
    errors.push(...this.validateStructure(trimmed));

    // Import validation
    errors.push(...this.validateImports(trimmed));

    // Semantic validation
    errors.push(...this.validateSemantics(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate Remotion structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    // Must have Remotion import or reference
    const hasRemotion = /from\s+['"]remotion['"]/.test(code) ||
                       /\b(useCurrentFrame|AbsoluteFill|Composition)\b/.test(code);
    
    if (!hasRemotion) {
      errors.push('Remotion code must import from "remotion" or use Remotion components/hooks');
    }

    // Should have a component export
    const hasExport = /export\s+default/.test(code) || 
                      /export\s+function/.test(code) || 
                      /export\s+const\s+\w+\s*=/.test(code);
    if (!hasExport) {
      errors.push('Remotion composition should have an export (default export or named export)');
    }

    return errors;
  }

  /**
   * Validate Remotion imports
   */
  private static validateImports(code: string): string[] {
    const errors: string[] = [];

    // Check for invalid Remotion imports
    const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]remotion['"]/g);
    for (const match of importMatches) {
      const importStatement = match[0];
      
      // Extract imported names
      const namedImports = importStatement.match(/\{([^}]+)\}/);
      if (namedImports) {
        const imports = namedImports[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
        for (const imp of imports) {
          if (!this.VALID_REMOTION_IMPORTS.has(imp) && !this.isReactImport(imp)) {
            // Could be a newer API - warn but don't error
          }
        }
      }
    }

    return errors;
  }

  /**
   * Check if import is a React builtin
   */
  private static isReactImport(name: string): boolean {
    const reactImports = new Set([
      'React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
      'useContext', 'useReducer', 'Fragment', 'createElement'
    ]);
    return reactImports.has(name);
  }

  /**
   * Validate Remotion semantics
   */
  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    // Check for useCurrentFrame usage (typical in Remotion) or Composition
    const hasUseCurrentFrame = /useCurrentFrame/.test(code);
    const hasComposition = /<Composition/.test(code);
    const hasJSX = /<[A-Z][A-Za-z0-9]*/.test(code) || /<[a-z]+/.test(code);
    
    if (!hasUseCurrentFrame && !hasJSX && !hasComposition) {
      errors.push('Remotion composition should use useCurrentFrame or contain JSX');
    }

    // Check for proper React component structure
    const hasFunctionComponent = /function\s+\w+\s*\(\s*\)/.test(code) ||
                                  /function\s+\w+\s*\(\s*\{[^}]*\}\s*\)/.test(code) ||
                                  /const\s+\w+\s*=\s*\([^)]*\)\s*=>/.test(code) ||
                                  /export\s+default\s+function/.test(code) ||
                                  /export\s+(const\s+\w+\s*=|function\s+\w+)/.test(code);
    
    if (!hasFunctionComponent && !hasComposition) {
      errors.push('Remotion code should define a React function component');
    }

    return errors;
  }

  /**
   * Get minimum size requirement for Remotion code
   */
  static getMinSize(): number {
    return 500; // Remotion needs export, imports, and component
  }
}
