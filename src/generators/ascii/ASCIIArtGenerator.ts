/**
 * ASCIIArtGenerator - Generates text-based ASCII art via LLM
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 * NO TEMPLATES - Everything goes through the LLM
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';
import { ASCIIValidator } from '../../core/validators/ASCIIValidator.js';

export type ASCIIStyle = 'simple' | 'landscape' | 'abstract';

export interface ASCIIOptions extends TierBasedGeneratorOptions {
  style?: ASCIIStyle;
  width?: number;
  height?: number;
}

export class ASCIIArtGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('ascii', llmOrConfig);
  }

  async generate(prompt: string, options?: ASCIIOptions): Promise<string> {
    const width = options?.width || 40;
    const height = options?.height || 20;
    const asciiPrompt = [
      'Generate raw ASCII art only.',
      `Draw the requested scene in up to ${height} visible rows and at most ${width} columns per row.`,
      'The renderer will crop or pad the final size; do not explain or count rows.',
      'Use only plain ASCII characters: spaces, letters, digits, and symbols such as .,:;-=+*#%/\\|_~()[]{}<>.',
      'Do not use Unicode symbols, markdown fences, explanations, captions, or prose.',
      '',
      `User request: ${prompt}`,
    ].join('\n');
    let code: string;
    try {
      code = await super.generate(asciiPrompt, { ...options, maxTokens: options?.maxTokens ?? 2200, useGeneratorTools: false });
    } catch (error) {
      const recovered = await this.retryAsciiDirect(prompt, width, height, options);
      if (recovered) return recovered;
      throw error;
    }
    const recoveredFromText = this.recoverASCIIFromModelText(code, width, height);
    if (recoveredFromText) {
      const recoveredFormatted = this.formatASCII(recoveredFromText, width, height);
      if (!this.needsRetry(recoveredFormatted, height)) {
        return recoveredFormatted;
      }
    }

    const formatted = this.formatASCII(code, width, height);
    if (this.needsRetry(formatted, height)) {
      const recovered = await this.retryAsciiDirect(prompt, width, height, options);
      if (recovered) return recovered;
    }
    return formatted;
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    const result = ASCIIValidator.validate(code);
    if (!result.valid) {
      return { valid: false, error: result.errors[0] ?? 'Generated code contains invalid characters for ASCII art' };
    }
    return { valid: true };
  }

  private formatASCII(code: string, width: number, height: number): string {
    const lines = code.split('\n').filter(line => line.trim() !== '');
    
    // Remove code block markers if present
    const cleanLines = lines
      .filter(line => !line.startsWith('```'))
      .filter(line => !line.startsWith('//'))
      .slice(0, height)
      .map(line => line.slice(0, width).padEnd(width, ' '));
    
    // Ensure exactly height lines
    while (cleanLines.length < height) {
      cleanLines.push(' '.repeat(width));
    }
    
    return cleanLines.join('\n');
  }

  private async retryAsciiDirect(
    prompt: string,
    width: number,
    height: number,
    options?: ASCIIOptions
  ): Promise<string | null> {
    const direct = await this.llm.complete({
      systemPrompt: 'You create raw ASCII art. Output only the final ASCII art; no prose, no markdown.',
      prompt: [
        `Draw this as ASCII art: ${prompt}`,
        `Use 4 to ${height} visible rows and at most ${width} columns per row.`,
        'Use only plain ASCII characters.',
        'Do not count rows, describe constraints, or explain your process.',
        'If any hidden reasoning is emitted, include candidate rows as Line1: "...", Line2: "...", etc.',
      ].join('\n'),
      maxTokens: options?.maxTokens ?? 2200,
      temperature: this.llm.getConfig().temperature,
      signal: options?.signal,
    });
    if (!direct.success || !direct.text) return null;

    const raw = this.recoverASCIIFromModelText(direct.text, width, height);
    if (!raw) return null;
    const formatted = this.formatASCII(raw, width, height);
    return this.validateOutput(formatted).valid && !this.needsRetry(formatted, height) ? formatted : null;
  }

  private recoverASCIIFromModelText(text: string, width: number, height: number): string | null {
    const quotedLines: string[] = [];
    const linePattern = /Line\s*\d+\s*:\s*"((?:\\.|[^"])*)"/gi;
    for (const match of text.matchAll(linePattern)) {
      try {
        quotedLines.push(JSON.parse(`"${match[1]}"`) as string);
      } catch {
        quotedLines.push(match[1].replace(/\\\\/g, '\\'));
      }
    }
    const quotedArtLines = quotedLines.filter(line => this.looksLikeAsciiArtLine(line, width));
    if (quotedArtLines.length >= Math.max(2, Math.min(height, 4))) {
      return quotedArtLines.slice(-height).join('\n');
    }

    const withoutThink = text.replace(/<\/?think[^>]*>/gi, '');
    const candidateLines = withoutThink
      .split('\n')
      .map(line => line.replace(/^\s*(?:Line\s*)?\d+\s*:\s*/i, '').replace(/^["'`]|["'`]$/g, ''))
      .filter(line => this.looksLikeAsciiArtLine(line, width))
      .filter(line => !/[{};=]/.test(line))
      .filter(line => (line.match(/[A-Za-z]/g) ?? []).length <= Math.max(8, width * 0.35));

    return candidateLines.length >= 2 ? candidateLines.slice(-height).join('\n') : null;
  }

  private looksLikeAsciiArtLine(line: string, width: number): boolean {
    if (line.length === 0 || line.length > width) return false;
    const artChars = line.match(/[/\\|_~^*#%+=.-]/g) ?? [];
    if (artChars.length < 2) return false;
    const letters = line.match(/[A-Za-z]/g) ?? [];
    return letters.length <= Math.max(8, artChars.length * 2);
  }

  private isSparseASCII(code: string, targetHeight: number): boolean {
    const nonEmptyLines = code.split('\n').filter(line => line.trim().length > 0);
    return nonEmptyLines.length < Math.min(targetHeight, 8);
  }

  private isProseHeavyASCII(code: string): boolean {
    const contentLines = code.split('\n').filter(line => line.trim().length > 0);
    if (contentLines.length === 0) return true;
    const proseLines = contentLines.filter(line =>
      /\b(?:need|require|instruction|exactly|columns|unicode|markdown|prose|think|let's|should|avoid|allowed|characters)\b/i.test(line)
    );
    return proseLines.length >= 2;
  }

  private needsRetry(code: string, targetHeight: number): boolean {
    return this.isSparseASCII(code, targetHeight) || this.isProseHeavyASCII(code);
  }

  /**
   * Wrap ASCII art for gallery iframe display.
   * Uses a monospace pre block with dark background.
   */
  wrapForGallery(code: string): string {
    const escaped=code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ASCII Art</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:monospace;min-height:100vh;display:flex;align-items:center;justify-content:center}
pre{font-size:clamp(8px,1.5vw,16px);line-height:1.2;white-space:pre}
</style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
  }
}
