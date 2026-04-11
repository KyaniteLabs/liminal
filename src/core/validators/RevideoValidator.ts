/**
 * RevideoValidator - Revideo video composition validation logic
 *
 * Revideo v0.12+ is a programmatic video framework based on Remotion but uses
 * DIFFERENT APIs: @revideo/core, makeScene(), useTime(), createSignal()
 * NOT Remotion's useCurrentFrame, AbsoluteFill, Composition
 */

export interface RevideoValidationResult {
  valid: boolean;
  errors: string[];
}

export class RevideoValidator {
  private static readonly VALID_REVIDEO_IMPORTS = new Set([
    'makeScene', 'useTime', 'useFrame', 'createSignal', 'createRef',
    'interpolate', 'spring', 'Easing', 'Audio', 'Img', 'Video',
    'OffthreadVideo', 'staticFile', 'AbsoluteFill', 'Series', 'Sequence'
  ]);

  static validate(code: string): RevideoValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    errors.push(...this.validateStructure(trimmed));
    errors.push(...this.validateImports(trimmed));
    errors.push(...this.validateSemantics(trimmed));

    return { valid: errors.length === 0, errors };
  }

  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    const hasRevideo = /@revideo\/core/.test(code) ||
                       /\b(makeScene|useTime|createSignal)\b/.test(code);

    if (!hasRevideo) {
      errors.push('Revideo code must use @revideo/core APIs (makeScene, useTime, createSignal)');
    }

    const hasMakeScene = /makeScene/.test(code);
    if (!hasMakeScene) {
      errors.push('Revideo composition must export a makeScene function');
    }

    return errors;
  }

  private static validateImports(code: string): string[] {
    const errors: string[] = [];
    const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]@revideo\/core['"]/g);
    for (const match of importMatches) {
      const namedImports = match[0].match(/\{([^}]+)\}/);
      if (namedImports) {
        const imports = namedImports[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
        for (const imp of imports) {
          if (!this.VALID_REVIDEO_IMPORTS.has(imp) && !this.isReactImport(imp)) {
            errors.push(`Unknown Revideo import: ${imp}`);
          }
        }
      }
    }
    return errors;
  }

  private static isReactImport(name: string): boolean {
    const reactImports = new Set([
      'React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
      'useContext', 'useReducer', 'Fragment', 'createElement'
    ]);
    return reactImports.has(name);
  }

  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    const hasMakeScene = /makeScene/.test(code);
    const hasSignalOrRef = /createSignal|createRef/.test(code);
    const hasJSX = /<[A-Z][A-Za-z0-9]*/.test(code) || /<[a-z]+/.test(code);

    if (!hasMakeScene) {
      errors.push('Revideo code must define a makeScene function');
    }

    if (!hasSignalOrRef && !hasJSX) {
      errors.push('Revideo composition should use createSignal, createRef, or contain JSX');
    }

    const hasFunctionExport = /export\s+(const\s+\w+\s*=|function\s+\w+)/.test(code) ||
                              /makeScene\s*[:=]/.test(code);

    if (!hasFunctionExport) {
      errors.push('Revideo code should export a named function (e.g., export const makeScene = ...)');
    }

    return errors;
  }

  static getMinSize(): number {
    return 500;
  }
}
