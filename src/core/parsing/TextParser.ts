/**
 * TextParser - Simple paragraph-splitting parser for unsupported file types
 *
 * This is the fallback parser when neither CodeParser nor DocParser applies.
 * It performs basic text processing: paragraph splitting, heading detection,
 * code block extraction, and metrics computation.
 */

import type { LIRTextToken } from '../lir/types.js';

/**
 * TextParser parses plain text content into LIRTextToken
 *
 * This is intentionally simple — it's a fallback parser for unsupported file types.
 */
export class TextParser {
  private counter = 0;

  /**
   * Parse text content into LIR text tokens
   *
   * @param content - The text content to parse
   * @param _file - The file path for location tracking (unused in TextParser, kept for interface consistency)
   * @returns Array containing a single LIRTextToken
   */
  parse(content: string, _file: string): LIRTextToken[] {
    // Normalize content: trim leading/trailing whitespace
    const normalizedContent = content.trim();

    // Extract structure (headings and code blocks)
    const structure = this.extractStructure(normalizedContent);

    // Compute metrics
    const metrics = this.computeMetrics(normalizedContent, structure);

    // Generate ID
    const id = this.generateId();

    // Build and return token
    const token: LIRTextToken = {
      id,
      type: 'text',
      domain: 'unstructured',
      layer: 'content',
      metadata: {},
      tags: [],
      content: normalizedContent,
      structure,
      metrics,
    };

    return [token];
  }

  /**
   * Extract structural elements from text (headings and code blocks)
   */
  private extractStructure(content: string): LIRTextToken['structure'] {
    const headings = this.extractHeadings(content);
    const codeBlocks = this.extractCodeBlocks(content);

    return {
      headings,
      codeBlocks,
    };
  }

  /**
   * Extract markdown-style headings using regex
   * Matches lines starting with 1-6 # characters followed by whitespace and text
   */
  private extractHeadings(content: string): Array<{ level: number; text: string }> {
    const headings: Array<{ level: number; text: string }> = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text });
    }

    return headings;
  }

  /**
   * Extract markdown-style fenced code blocks
   * Matches ```language ... ``` patterns
   */
  private extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const codeBlocks: Array<{ language: string; code: string }> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'unknown';
      const code = match[2].trim();
      codeBlocks.push({ language, code });
    }

    return codeBlocks;
  }

  /**
   * Compute metrics for the text content
   */
  private computeMetrics(
    content: string,
    structure: LIRTextToken['structure']
  ): LIRTextToken['metrics'] {
    // Split on double newlines (normalized) to get paragraphs
    const paragraphs = this.splitIntoParagraphs(content);

    // Count words (split on whitespace)
    const words = content.split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Paragraph count (non-empty after trimming)
    const paragraphCount = paragraphs.filter((p) => p.length > 0).length;

    // Heading count
    const headingCount = structure.headings.length;

    return {
      wordCount,
      paragraphCount,
      headingCount,
    };
  }

  /**
   * Split content into paragraphs on double newlines
   * Handles both LF and CRLF line endings
   */
  private splitIntoParagraphs(content: string): string[] {
    // Normalize line endings to LF
    const normalized = content.replace(/\r\n/g, '\n');
    // Split on double newlines
    const paragraphs = normalized.split(/\n\n+/);
    // Trim each paragraph
    return paragraphs.map((p) => p.trim());
  }

  /**
   * Generate unique ID for tokens
   */
  private generateId(): string {
    return `text-${Date.now()}-${this.counter++}`;
  }
}
