/**
 * RevideoValidator - Revideo video composition validation logic
 *
 * Revideo is the active programmatic video framework. The supported contract is
 * canonical makeScene2D("SceneName", function* (view) { ... }) scenes with @revideo/2d
 * components and @revideo/core animation helpers. Legacy makeScene(name, ...)
 * scenes remain accepted for compatibility. It must not use @revideo/react,
 * React.FC, or useCurrentFrame/AbsoluteFill/Composition API.
 */

export interface RevideoValidationResult {
  valid: boolean;
  errors: string[];
}

export class RevideoValidator {
  private static readonly VALID_REVIDEO_CORE_IMPORTS = new Set([
    'makeScene', 'useTime', 'createSignal', 'createRef', 'waitFor',
    'interpolate', 'spring', 'Easing',
    'OffthreadVideo', 'staticFile'
  ]);

  private static readonly VALID_REVIDEO_2D_IMPORTS = new Set([
    'makeScene2D', 'Circle', 'Img', 'Layout', 'Line', 'Node', 'Path',
    'Ray', 'Rect', 'Spline', 'Txt', 'Video'
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

    const hasRevideo = /@revideo\/(core|2d)/.test(code) ||
                       /\b(makeScene2D|makeScene|useTime|createSignal)\b/.test(code);

    if (!hasRevideo) {
      errors.push('Revideo code must use @revideo/2d or @revideo/core APIs (makeScene2D, createRef, waitFor)');
    }

    const hasMakeScene2D = /\bmakeScene2D\s*\(/.test(code);
    const hasLegacyMakeScene = /\bmakeScene\s*\(/.test(code);
    if (!hasMakeScene2D && !hasLegacyMakeScene) {
      errors.push('Revideo composition must export makeScene2D(...) or makeScene(...)');
    }

    if (/makeScene\s*\(\s*\{/.test(code)) {
      errors.push('Revideo makeScene must use makeScene("SceneName", function* (view) { ... }), not makeScene({ render: ... })');
    }

    const hasNamedCanonicalScene = /makeScene2D\s*\(\s*['"][^'"]+['"]\s*,\s*function\*/.test(code);
    const hasSingleArgCanonicalScene = /makeScene2D\s*\(\s*function\*/.test(code);
    const hasCanonicalScene = hasNamedCanonicalScene || hasSingleArgCanonicalScene;
    const hasLegacyScene = /makeScene\s*\(\s*['"][^'"]+['"]\s*,\s*function\*/.test(code);
    if (!hasCanonicalScene && !hasLegacyScene) {
      errors.push('Revideo composition must use makeScene2D("SceneName", function* (view) { ... }), makeScene2D(function* (view) { ... }), or makeScene("SceneName", function* (view) { ... })');
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
    errors.push(
      ...this.validateNamedImports(
        code,
        /import\s+\{([^}]+)\}\s+from\s+['"]@revideo\/core['"]/g,
        this.VALID_REVIDEO_CORE_IMPORTS
      )
    );
    errors.push(
      ...this.validateNamedImports(
        code,
        /import\s+\{([^}]+)\}\s+from\s+['"]@revideo\/2d['"]/g,
        this.VALID_REVIDEO_2D_IMPORTS
      )
    );
    if (!/@revideo\/2d/.test(code)) {
      errors.push('Revideo scene should import visual components such as Txt/Rect from @revideo/2d');
    }
    return errors;
  }

  private static validateNamedImports(code: string, pattern: RegExp, allowed: Set<string>): string[] {
    const errors: string[] = [];
    for (const match of code.matchAll(pattern)) {
      const imports = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
      for (const imp of imports) {
        if (imp && !allowed.has(imp)) {
          errors.push(`Unknown Revideo import: ${imp}`);
        }
      }
    }
    return errors;
  }

  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    const hasMakeScene = /\b(makeScene2D|makeScene)\b/.test(code);
    const hasSignalOrRef = /createSignal|createRef/.test(code);
    const hasJSX = /<[A-Z][A-Za-z0-9]*/.test(code) || /<[a-z]+/.test(code);
    const hasViewAdd = /\bview\.add\s*\(/.test(code);
    const hasYield = /\byield\*/.test(code);

    if (!hasMakeScene) {
      errors.push('Revideo code must define a makeScene2D or makeScene function');
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

    const hasDefaultMakeSceneExport = /export\s+default\s+makeScene2D\s*\(/.test(code) ||
      /export\s+default\s+makeScene\s*\(/.test(code);
    if (!hasDefaultMakeSceneExport) {
      errors.push('Revideo code should export default makeScene2D("SceneName", ...) or makeScene(...)');
    }

    return errors;
  }

  static getMinSize(): number {
    return 500;
  }
}
