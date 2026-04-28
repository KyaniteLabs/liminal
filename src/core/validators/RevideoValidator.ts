/**
 * RevideoValidator - Revideo video composition validation logic
 *
 * Revideo is the active programmatic video framework. The supported contract is
 * makeScene(name, function* (view) { ... }) with @revideo/core and @revideo/2d
 * scene components. It must not use @revideo/react, React.FC, or
 * useCurrentFrame/AbsoluteFill/Composition API.
 */

export interface RevideoValidationResult {
  valid: boolean;
  errors: string[];
}

export class RevideoValidator {
  private static readonly VALID_REVIDEO_IMPORTS = new Set([
    'makeScene', 'useTime', 'createSignal', 'createRef',
    'interpolate', 'spring', 'Easing', 'Audio', 'Img', 'Video',
    'OffthreadVideo', 'staticFile'
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

    if (/makeScene\s*\(\s*\{/.test(code)) {
      errors.push('Revideo makeScene must use makeScene("SceneName", function* (view) { ... }), not makeScene({ render: ... })');
    }

    if (!/makeScene\s*\(\s*['"][^'"]+['"]\s*,\s*function\*/.test(code)) {
      errors.push('Revideo composition must use makeScene("SceneName", function* (view) { ... })');
    }

    return errors;
  }

  private static validateImports(code: string): string[] {
    const errors: string[] = [];
    if (/@revideo\/react/.test(code)) {
      errors.push('Revideo code must not import @revideo/react; use @revideo/core and @revideo/2d');
    }
    if (/\bremotion\b|from\s+['"]remotion['"]/.test(code)) {
      errors.push('Revideo code must not import or reference the remotion package');
    }
    if (/\b(useFrame|useCurrentFrame|React\.FC)\b/.test(code)) {
      errors.push('Revideo code must not use React hooks like useFrame/useCurrentFrame or React.FC');
    }
    if (/\bcreateCanvas\b|function\s+setup\s*\(|function\s+draw\s*\(|\bp5\b|p5\.js/i.test(code)) {
      errors.push('Revideo code must not use p5.js APIs such as createCanvas, setup(), or draw()');
    }
    const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]@revideo\/core['"]/g);
    for (const match of importMatches) {
      const namedImports = match[0].match(/\{([^}]+)\}/);
      if (namedImports) {
        const imports = namedImports[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
        for (const imp of imports) {
          if (!this.VALID_REVIDEO_IMPORTS.has(imp)) {
            errors.push(`Unknown Revideo import: ${imp}`);
          }
        }
      }
    }
    if (!/@revideo\/2d/.test(code)) {
      errors.push('Revideo scene should import visual components such as Txt/Rect from @revideo/2d');
    }
    return errors;
  }

  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    const hasMakeScene = /makeScene/.test(code);
    const hasSignalOrRef = /createSignal|createRef/.test(code);
    const hasJSX = /<[A-Z][A-Za-z0-9]*/.test(code) || /<[a-z]+/.test(code);
    const hasViewAdd = /\bview\.add\s*\(/.test(code);
    const hasYield = /\byield\*/.test(code);

    if (!hasMakeScene) {
      errors.push('Revideo code must define a makeScene function');
    }

    if (!hasSignalOrRef && !hasJSX) {
      errors.push('Revideo composition should use createSignal, createRef, or contain JSX');
    }

    if (!hasViewAdd) {
      errors.push('Revideo scene should add elements with view.add(...)');
    }

    if (!hasYield) {
      errors.push('Revideo animation should use generator/yield* animation steps');
    }

    const hasDefaultMakeSceneExport = /export\s+default\s+makeScene\s*\(/.test(code);
    if (!hasDefaultMakeSceneExport) {
      errors.push('Revideo code should export default makeScene(...)');
    }

    return errors;
  }

  static getMinSize(): number {
    return 500;
  }
}
