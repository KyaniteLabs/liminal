/**
 * ASCIIValidator - ASCII art validation logic
 *
 * Validates ASCII art content including valid characters,
 * dimensions, and structure.
 */

export interface ASCIIValidationResult {
  valid: boolean;
  errors: string[];
}

export class ASCIIValidator {
  /**
   * Valid ASCII art characters
   */
  private static readonly VALID_ASCII_CHARS = new Set([
    // Space and basic symbols
    ' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
    // Digits
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    // More symbols
    ':', ';', '<', '=', '>', '?', '@',
    // Uppercase
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    // More symbols
    '[', '\\', ']', '^', '_', '`',
    // Lowercase
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // Braces and tilde
    '{', '|', '}', '~',
    // Common box drawing characters (extended ASCII)
    '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼',
    '═', '║', '╔', '╗', '╚', '╝', '╠', '╣', '╦', '╩', '╬',
    // Block elements
    '█', '▀', '▄', '▌', '▐', '░', '▒', '▓',
    // Common art characters
    '★', '☆', '♠', '♥', '♦', '♣', '•', '○', '●', '◐', '◑', '◒', '◓',
    '←', '↑', '→', '↓', '↔', '↕', '╱', '╲', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█',
  ]);

  /**
   * Validate ASCII art content
   */
  static validate(code: string): ASCIIValidationResult {
    const errors: string[] = [];
    const trimmed = code.trim();

    if (!trimmed) {
      errors.push('Code is empty');
      return { valid: false, errors };
    }

    // Basic structure validation
    errors.push(...this.validateStructure(trimmed));

    // Character validation
    errors.push(...this.validateCharacters(trimmed));

    // Quality validation
    errors.push(...this.validateQuality(trimmed));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate ASCII art structure
   */
  private static validateStructure(code: string): string[] {
    const errors: string[] = [];

    const lines = code.split('\n');
    
    // Skip validation for structure - just needs content

    // Check for consistent line endings (no trailing whitespace issues)
    let maxLineLength = 0;
    let minLineLength = Infinity;
    
    for (const line of lines) {
      const len = line.length;
      maxLineLength = Math.max(maxLineLength, len);
      minLineLength = Math.min(minLineLength, len);
    }

    // Warn if lines vary wildly in length
    if (maxLineLength > minLineLength * 3 && minLineLength > 0) {
      // Lines vary significantly - might be intentional or malformed
    }

    return errors;
  }

  /**
   * Validate ASCII art characters
   */
  private static validateCharacters(code: string): string[] {
    const errors: string[] = [];
    const invalidChars = new Set<string>();

    for (const char of code) {
      // Check if character is valid ASCII or extended ASCII art character
      const codePoint = char.codePointAt(0) || 0;
      
      // Standard ASCII range (0-127)
      const isStandardAscii = codePoint >= 32 && codePoint <= 126;
      
      // Common control characters we allow
      const isAllowedControl = char === '\n' || char === '\r' || char === '\t';
      
      // Extended ASCII art characters
      const isExtendedAscii = this.VALID_ASCII_CHARS.has(char);

      if (!isStandardAscii && !isAllowedControl && !isExtendedAscii) {
        invalidChars.add(char);
      }
    }

    if (invalidChars.size > 0) {
      const chars = Array.from(invalidChars).slice(0, 10);
      const charList = chars.map(c => `'${c}' (U+${c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})`).join(', ');
      const extra = invalidChars.size > 10 ? ` and ${invalidChars.size - 10} more` : '';
      errors.push(`ASCII art contains invalid characters: ${charList}${extra}`);
    }

    return errors;
  }

  /**
   * Validate ASCII art quality
   */
  private static validateQuality(code: string): string[] {
    const errors: string[] = [];
    const lines = code.split('\n');

    // Must have reasonable dimensions
    if (lines.length < 1) {
      errors.push('ASCII art must have at least 1 line');
    }

    // Check minimum content (not just whitespace)
    const hasContent = /[^\s]/.test(code);
    if (!hasContent) {
      errors.push('ASCII art must contain non-whitespace characters');
    }

    // Warn if art is very small
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length < 2) {
      // Very minimal art - could be valid but warn
    }

    // Check aspect ratio isn't extreme
    const maxWidth = Math.max(...lines.map(l => l.length));
    const height = nonEmptyLines.length;
    if (maxWidth > 0 && height > 0) {
      const ratio = maxWidth / height;
      if (ratio > 20 || ratio < 0.05) {
        errors.push(`ASCII art has extreme aspect ratio (${ratio.toFixed(2)}:1) - may be malformed`);
      }
    }

    return errors;
  }

  /**
   * Detect if code looks like ASCII art
   */
  static detectASCII(code: string): boolean {
    const trimmed = code.trim();
    
    // Quick heuristics for ASCII art detection
    const lines = trimmed.split('\n');
    if (lines.length < 2) return false;

    // Count ASCII art characters vs code-like characters
    let artChars = 0;
    let codeChars = 0;

    const artPatterns = /[|/\\\-+=*_#@$%&~^:;,.<>{}[\]()`"']+/;
    const codePatterns = /(function|const|let|var|if|for|while|class|import|export|return|=|;|\{|\})/;

    for (const line of lines) {
      if (artPatterns.test(line)) artChars++;
      if (codePatterns.test(line)) codeChars++;
    }

    // More art-like than code-like
    return artChars > codeChars * 2;
  }

  /**
   * Get minimum size requirement for ASCII art
   */
  static getMinSize(): number {
    return 50; // Minimal ASCII art
  }
}
