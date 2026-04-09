/**
 * TextGenerativeGenerator - Experimental text-based generative art
 * 
 * Unlike ASCIIArtGenerator which uses character density for visual patterns,
 * TextGenerativeGenerator produces freeform text: concrete poetry, word art,
 * experimental typography, and semantic visual compositions.
 * 
 * Key differences from ASCIIArtGenerator:
 * - No fixed grid (freeform output)
 * - No character restrictions (any text valid)
 * - Focus on semantic/playful creativity vs visual density
 * - Optimized for small/fast models (1.2B+)
 * 
 * @example
 *   Input: "dripping water"
 *   Output:
 *     d
 *      r
 *       i
 *        p
 *         p
 *          i
 *           n
 *            g
 * 
 * @example
 *   Input: "neon city in words"
 *   Output:
 *     ╔══════════════════╗
 *     ║  N  E  O  N      ║
 *     ║    C  I  T  Y    ║
 *     ║      G  L  O  W  ║
 *     ╚══════════════════╝
 * 
 * @since 2.2.0
 * @author Liminal Team
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

/** Available text generative forms */
export type TextGenForm = 
  | 'concrete'      // Visual poetry using word arrangement
  | 'cascade'       // Words flow/drip down the page
  | 'radial'        // Words radiate from center
  | 'interwoven'    // Overlapping text layers
  | 'typographic'   // Letter-as-shape compositions
  | 'ascii-poem'    // ASCII art meets poetry
  | 'freeform';     // No constraints, pure experimentation

/** Style modifiers for text generation */
export type TextGenStyle = 
  | 'minimal'       // Sparse, lots of whitespace
  | 'dense'         // Packed, overlapping
  | 'chaotic'       // Random, energetic
  | 'meditative'    // Slow, rhythmic
  | 'punk'          // Raw, aggressive
  | 'ethereal';     // Light, floating quality

/**
 * Options for text generative generation
 */
export interface TextGenOptions extends TierBasedGeneratorOptions {
  /** The compositional form */
  form?: TextGenForm;
  /** Stylistic modifier */
  style?: TextGenStyle;
  /** Maximum lines of output */
  maxLines?: number;
  /** Maximum characters per line */
  maxWidth?: number;
  /** Allow Unicode/emoji (true) or ASCII-only (false) */
  unicode?: boolean;
  /** Repeat pattern or single composition */
  repeating?: boolean;
}

/**
 * Generator for experimental text-based art
 * 
 * Optimized for speed over complexity - works well with small models (1.2B+)
 * due to the low token count of text outputs compared to code.
 */
export class TextGenerativeGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('textgen', llmOrConfig);
  }

  /**
   * Generate text-based art from a prompt
   * 
   * @param prompt - The creative concept (e.g., "dripping water", "neon anxiety")
   * @param options - Generation options
   * @returns Formatted text composition
   * 
   * @throws {GenerationError} If LLM returns invalid or empty output
   */
  async generate(prompt: string, options?: TextGenOptions): Promise<string> {
    const raw = await super.generate(prompt, options);
    return this.formatOutput(raw, options);
  }

  /**
   * Validate that output is appropriate text content
   * 
   * Unlike ASCIIArtGenerator, we don't restrict characters.
   * We only check that it's not empty and not code.
   */
  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Strip code fences and comments before validation (mirrors formatOutput preprocessing)
    const stripped = code
      .split('\n')
      .filter(line => !line.startsWith('```') && !line.startsWith('//'))
      .join('\n')
      .trim();

    if (!stripped || stripped.length === 0) {
      return { valid: false, error: 'Empty output' };
    }

    // Check for remaining code-like patterns after stripping fences
    if (/\bfunction\b/.test(stripped) || /\bclass\b/.test(stripped) ||
        /\bconst\b.*[=;]/.test(stripped) || /\blet\b.*[=;]/.test(stripped) ||
        /\breturn\b/.test(stripped) || /\bif\b.*\(/.test(stripped)) {
      return { valid: false, error: 'Output appears to be code, not text art' };
    }

    return { valid: true };
  }

  /**
   * Format and clean the generated text
   * 
   * - Removes code block markers
   * - Applies line/width constraints
   * - Handles Unicode vs ASCII preference
   */
  private formatOutput(raw: string, options?: TextGenOptions): string {
    let lines = raw
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => {
        // Remove markdown code blocks
        if (line.startsWith('```')) return false;
        // Remove comments
        if (line.startsWith('//')) return false;
        return line.trim().length > 0;
      });

    // Apply max lines constraint
    const maxLines = options?.maxLines || 40;
    lines = lines.slice(0, maxLines);

    // Apply max width constraint
    const maxWidth = options?.maxWidth || 80;
    lines = lines.map(line => line.slice(0, maxWidth));

    // Filter Unicode if requested
    if (options?.unicode === false) {
      // Filter to ASCII range (1-127), remove null bytes
      lines = lines.map(line => line.replace(/[\u0080-\uFFFF]/g, '').replace(/\0/g, ''));
    }

    return lines.join('\n');
  }

  /**
   * Get default options based on model tier
   * 
   * Small models get simpler constraints to avoid confusion
   */
  protected getDefaultOptions(): Partial<TextGenOptions> {
    if (this.tier === 'tiny') {
      return {
        form: 'concrete',
        style: 'minimal',
        maxLines: 20,
        maxWidth: 40,
        unicode: false,
      };
    }
    
    if (this.tier === 'local') {
      return {
        form: 'freeform',
        style: 'minimal',
        maxLines: 30,
        maxWidth: 60,
        unicode: true,
      };
    }

    // Flagship/Medium get full flexibility
    return {
      form: 'freeform',
      style: 'ethereal',
      maxLines: 40,
      maxWidth: 80,
      unicode: true,
    };
  }
}

export default TextGenerativeGenerator;
