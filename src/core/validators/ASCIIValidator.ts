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

  /** Near-miss Unicode glyphs the LLM reaches for, mapped to allowed cousins.
   *  Observed killing whole generations in the self-improve daemon (2026-06-11):
   *  ◈ U+25C8, ◉ U+25C9, ◡ U+25E1 — each a sibling of an allowed glyph. */
  private static readonly SANITIZE_MAP: Record<string, string> = {
    '◈': '♦', '◆': '♦', '◇': '♦', '◉': '●', '◎': '○', '◠': '-', '◡': '_',
  };

  /**
   * Deterministically rewrite disallowed characters to allowed ones instead of
   * failing the whole generation: near-miss glyphs map to allowed cousins,
   * accented letters decompose to their ASCII base, anything else becomes a
   * single-width '*' (preserving line alignment). Allowed content is untouched.
   */
  static sanitize(code: string): string {
    let out = '';
    for (const char of code) {
      const codePoint = char.codePointAt(0) ?? 0;
      const isStandardAscii = codePoint >= 32 && codePoint <= 126;
      if (isStandardAscii || char === '\n' || char === '\r' || char === '\t' || this.VALID_ASCII_CHARS.has(char)) {
        out += char;
        continue;
      }
      const mapped = this.SANITIZE_MAP[char];
      if (mapped) {
        out += mapped;
        continue;
      }
      const base = char.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      const baseCp = base.codePointAt(0) ?? 0;
      if (base.length === 1 && base !== char && baseCp >= 32 && baseCp <= 126) {
        out += base;
        continue;
      }
      out += '*';
    }
    return out;
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

    // Reject very minimal art — the gauntlet receipt check requires >= 3
    // non-empty lines and >= 16 art characters, so the validator should
    // also catch this so the generator retries before reaching the gauntlet.
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    if (nonEmptyLines.length < 3) {
      errors.push(`ASCII art is too minimal (${nonEmptyLines.length} non-empty lines; need at least 3)`);
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
    // Near-miss glyphs the sanitizer remaps to allowed art characters can also
    // dominate a piece; without this, a drawing of only ◈/◉/◡ gets misrouted
    // to the p5 fallback and dies on a JavaScript syntax error (2026-06-15).
    const nearMissGlyphs = new Set([...Object.keys(this.SANITIZE_MAP), ...Object.values(this.SANITIZE_MAP)]);

    for (const line of lines) {
      const hasNearMiss = [...line].some((ch) => nearMissGlyphs.has(ch));
      if (artPatterns.test(line) || hasNearMiss) artChars++;
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
