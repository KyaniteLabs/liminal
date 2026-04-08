/**
 * HTMLValidator - HTML document validation logic
 *
 * Validates HTML structure including proper document structure,
 * required tags, and security considerations.
 */

export interface HTMLValidationResult {
  valid: boolean;
  errors: string[];
}

export class HTMLValidator {
  /**
   * Validate HTML document structure
   */
  static validate(code: string): HTMLValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Basic structure validation
    errors.push(...this.validateStructure(trimmed));

    // Security validation
    errors.push(...this.validateSecurity(trimmed));

    // Semantic validation
    errors.push(...this.validateSemantics(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate HTML document structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    // Must start with DOCTYPE
    if (!code.trim().toUpperCase().startsWith('<!DOCTYPE')) {
      errors.push('HTML document must start with <!DOCTYPE html>');
    }

    // Must have html tag
    if (!/<html[^>]*>/i.test(code)) {
      errors.push('HTML document must contain <html> tag');
    }

    // Check for closing tags
    if (!/<\/html>/i.test(code)) {
      errors.push('HTML document must have closing </html> tag');
    }

    // Should have head and body
    if (!/<head[^>]*>/i.test(code)) {
      errors.push('HTML document should contain <head> tag');
    }
    if (!/<body[^>]*>/i.test(code)) {
      errors.push('HTML document should contain <body> tag');
    }

    // Check for properly closed tags (basic check)
    const selfClosing = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);
    
    // Find all opening tags
    const openTags: string[] = [];
    const tagMatches = code.matchAll(/<(\w+)[^>]*>/g);
    for (const match of tagMatches) {
      const tag = match[1].toLowerCase();
      if (!selfClosing.has(tag)) {
        openTags.push(tag);
      }
    }

    // Find all closing tags
    const closeTags: string[] = [];
    const closeMatches = code.matchAll(/<\/(\w+)>/g);
    for (const match of closeMatches) {
      closeTags.push(match[1].toLowerCase());
    }

    // Basic balance check for main structural tags
    const criticalTags = ['html', 'head', 'body'];
    for (const tag of criticalTags) {
      const opens = (code.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length;
      const closes = (code.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (opens !== closes) {
        errors.push(`HTML document has mismatched <${tag}> tags: ${opens} opening, ${closes} closing`);
      }
    }

    return errors;
  }

  /**
   * Validate HTML security
   */
  private static validateSecurity(code: string): string[] {
    const errors: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/i, msg: 'Dangerous eval() detected' },
      { pattern: /new\s+Function\s*\(/i, msg: 'Dangerous new Function() detected' },
      { pattern: /document\.write\s*\(/i, msg: 'document.write() is discouraged' },
      { pattern: /innerHTML\s*=/i, msg: 'innerHTML assignment - ensure content is sanitized' },
    ];

    for (const { pattern, msg } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`HTML Security: ${msg}`);
      }
    }

    // SECURITY: Check for HTML event handler attributes (XSS prevention)
    const EVENT_HANDLER_PATTERN = /\son\w+\s*=/i;
    const JAVASCRIPT_URL_PATTERN = /javascript:/i;
    
    if (EVENT_HANDLER_PATTERN.test(code)) {
      errors.push('HTML Security: Event handler attributes (on*) are not allowed');
    }
    
    if (JAVASCRIPT_URL_PATTERN.test(code)) {
      errors.push('HTML Security: javascript: URLs are not allowed');
    }

    // Check for script tags with external sources
    const scriptMatches = code.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi);
    for (const match of scriptMatches) {
      const src = match[1];
      if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
        // Local or relative path - OK
      }
    }

    return errors;
  }

  /**
   * Validate HTML semantics
   */
  private static validateSemantics(code: string): string[] {
    const errors: string[] = [];

    // Should have title in head
    if (!/<title[^>]*>[^<]+<\/title>/i.test(code)) {
      errors.push('HTML document should have a <title> in <head>');
    }

    // Meta charset is recommended
    if (!/<meta[^>]+charset/i.test(code)) {
      errors.push('HTML document should specify charset meta tag');
    }

    // Viewport meta for responsive design
    if (!/<meta[^>]+viewport/i.test(code)) {
      // Not strictly an error, but recommended
    }

    return errors;
  }

  /**
   * Get minimum size requirement for HTML code
   */
  static getMinSize(): number {
    return 200; // Minimal valid HTML document
  }
}
