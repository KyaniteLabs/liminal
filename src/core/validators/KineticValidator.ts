/**
 * KineticValidator - CSS/SVG/canvas kinetic artwork validation.
 *
 * Kinetic artifacts are complete HTML documents with visible surfaces and
 * time-based motion. Static HTML scaffolds should stay out of the core lane.
 */

import { parse } from '@babel/parser';
import { HTMLValidator } from './HTMLValidator.js';

export interface KineticValidationResult {
  valid: boolean;
  errors: string[];
}

export class KineticValidator {
  static validate(code: string): KineticValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    errors.push(...HTMLValidator.validate(trimmed).errors);
    errors.push(...this.validateSize(trimmed));
    errors.push(...this.validateCssSyntax(trimmed));
    errors.push(...this.validateProofBrightness(trimmed));
    errors.push(...this.validateJavaScriptSyntax(trimmed));
    errors.push(...this.validateVisibleSurface(trimmed));
    errors.push(...this.validateMotion(trimmed));

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static getMinSize(): number {
    return 320;
  }

  private static validateSize(code: string): string[] {
    if (code.length < this.getMinSize()) {
      return ['Kinetic HTML is too small to be a substantive kinetic artwork'];
    }
    return [];
  }

  private static validateVisibleSurface(code: string): string[] {
    const body = this.extractBody(code);
    const visibleBody = this.stripNonSurfaceContent(body);

    const hasDomSurface = /<(?:main|section|article|div|span|p|h[1-6]|ul|ol|li)\b[^>]*>/i.test(visibleBody);
    const hasSvgSurface = /<svg\b/i.test(visibleBody) && /<(?:text|path|circle|ellipse|rect|line|polyline|polygon)\b/i.test(visibleBody);
    const hasCanvasSurface = /<canvas\b/i.test(visibleBody);

    if (!hasDomSurface && !hasSvgSurface && !hasCanvasSurface) {
      return ['Kinetic artwork must include a visible DOM, SVG, or canvas surface'];
    }

    return [];
  }

  private static validateMotion(code: string): string[] {
    const css = this.extractTagContents(code, 'style').join('\n');
    const scripts = this.extractJavaScriptContents(code).join('\n');

    const hasCssAnimation = /@keyframes\s+[-_a-zA-Z][-_a-zA-Z0-9]*/.test(css) &&
      /\banimation(?:-name)?\s*:/.test(css);
    const hasSvgAnimation = /<(?:animate|animateTransform|animateMotion)\b/i.test(code);
    const hasCanvasOrDomLoop = /\b(?:requestAnimationFrame|setInterval)\s*\(/.test(scripts) &&
      /(?:\.style\.(?:transform|opacity|left|top)|\.animate\s*\(|classList\.|getContext\s*\(|ctx\.)/.test(scripts);

    if (!hasCssAnimation && !hasSvgAnimation && !hasCanvasOrDomLoop) {
      return ['Kinetic artwork must define animation or time-based motion'];
    }

    return [];
  }

  private static validateCssSyntax(code: string): string[] {
    const errors: string[] = [];
    for (const css of this.extractTagContents(code, 'style')) {
      const sanitized = this.stripCssCommentsAndStrings(css);
      let depth = 0;
      for (const char of sanitized) {
        if (char === '{') depth++;
        if (char === '}') depth--;
        if (depth < 0) {
          errors.push('Kinetic CSS has invalid block syntax: unexpected closing brace');
          break;
        }
      }
      if (depth > 0) {
        errors.push('Kinetic CSS has invalid block syntax: unclosed block');
      }
    }
    return errors;
  }

  private static validateProofBrightness(code: string): string[] {
    for (const color of this.extractProofSurfaceBackgrounds(code)) {
      const luminance = this.hexLuminance(color);
      if (luminance < 48) {
        return [
          `Kinetic background color ${color} is too dark for image proof; use a bright or mid-tone scene background`,
        ];
      }
    }
    return [];
  }

  private static extractProofSurfaceBackgrounds(code: string): string[] {
    const colors: string[] = [];
    const css = this.extractTagContents(code, 'style').join('\n');
    const variables = this.extractCssVariables(css);
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
    for (const match of css.matchAll(rulePattern)) {
      const selector = match[1] ?? '';
      if (!this.isProofSurfaceSelector(selector)) continue;
      colors.push(...this.extractBackgroundHexColors(match[2] ?? '', variables));
    }

    const inlinePattern = /<(html|body|main|section|article|div|svg)\b([^>]*)>/gi;
    for (const match of code.matchAll(inlinePattern)) {
      const tag = match[1] ?? '';
      const attrs = match[2] ?? '';
      if (tag.toLowerCase() !== 'html' && tag.toLowerCase() !== 'body' && !this.isProofSurfaceSelector(attrs)) {
        continue;
      }
      const style = attrs.match(/\bstyle\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      colors.push(...this.extractBackgroundHexColors(style, variables));
    }

    return colors;
  }

  private static extractCssVariables(css: string): Map<string, string> {
    const variables = new Map<string, string>();
    for (const match of css.matchAll(/(--[-_a-zA-Z0-9]+)\s*:\s*([^;{}]+)/g)) {
      variables.set(match[1] ?? '', match[2]?.trim() ?? '');
    }
    return variables;
  }

  private static isProofSurfaceSelector(selector: string): boolean {
    return /\b(?:html|body|main|section|article)\b/i.test(selector) ||
      /\.(?:scene|stage|canvas|kinetic|field|composition|viewport|art|poster|backdrop)\b/i.test(selector) ||
      /#(?:app|root|scene|stage|canvas|kinetic)\b/i.test(selector);
  }

  private static extractBackgroundHexColors(declarations: string, variables: Map<string, string>): string[] {
    const colors: string[] = [];
    for (const match of declarations.matchAll(/\bbackground(?:-color)?\s*:\s*([^;}]+)/gi)) {
      const value = match[1] ?? '';
      colors.push(...this.extractHexColors(value, variables));
    }
    return colors;
  }

  private static extractHexColors(value: string, variables: Map<string, string>, seen = new Set<string>()): string[] {
    const colors = Array.from(value.matchAll(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi), (match) => match[0]);
    for (const match of value.matchAll(/var\(\s*(--[-_a-zA-Z0-9]+)(?:\s*,\s*([^)]+))?\s*\)/g)) {
      const name = match[1] ?? '';
      if (seen.has(name)) continue;
      seen.add(name);
      const resolved = variables.get(name) ?? match[2] ?? '';
      colors.push(...this.extractHexColors(resolved, variables, seen));
    }
    return colors;
  }

  private static hexLuminance(hex: string): number {
    const normalized = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  private static validateJavaScriptSyntax(code: string): string[] {
    const errors: string[] = [];
    for (const script of this.extractJavaScriptContents(code)) {
      if (!script.trim()) continue;
      try {
        parse(script, {
          sourceType: 'module',
          allowReturnOutsideFunction: false,
          plugins: ['jsx'],
        });
      } catch (error) {
        errors.push(`Kinetic JavaScript has invalid syntax: ${this.formatParseError(error)}`);
      }
    }
    return errors;
  }

  private static extractBody(code: string): string {
    return code.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  }

  private static stripNonSurfaceContent(code: string): string {
    return code
      .replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');
  }

  private static extractTagContents(code: string, tag: string): string[] {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    return Array.from(code.matchAll(pattern), (match) => match[1] ?? '');
  }

  private static extractJavaScriptContents(code: string): string[] {
    const scripts: string[] = [];
    const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    for (const match of code.matchAll(pattern)) {
      const attrs = match[1] ?? '';
      if (/\bsrc\s*=/i.test(attrs)) continue;
      const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
      scripts.push(match[2] ?? '');
    }
    return scripts;
  }

  private static stripCssCommentsAndStrings(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(["'])(?:\\[\s\S]|(?!\1)[\s\S])*\1/g, '""');
  }

  private static formatParseError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
