/**
 * StrudelGenerator - Generates Strudel (TidalCycles for JavaScript) patterns
 * 
 * Uses TierBasedGenerator for model-aware prompt adaptation
 */

import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface StrudelGeneratorOptions extends TierBasedGeneratorOptions {
  bpm?: number;
}

export class StrudelGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('strudel', llmOrConfig);
  }

  async generate(prompt: string, options?: StrudelGeneratorOptions): Promise<string> {
    const code = await super.generate(prompt, options);
    return this.sanitizeCode(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Must have at least one sound source
    if (!/\b(s\(|sound\(|note\()/.test(code)) {
      return { valid: false, error: 'No sound source found (need s(), sound(), or note())' };
    }
    return { valid: true };
  }

  private sanitizeCode(code: string): string {
    if (!code || code.trim().length === 0) {
      return '';
    }
    
    let clean = code;
    
    // Strip markdown code fences (only at start/end, preserve code inside)
    clean = clean.replace(/^```(?:javascript|js|strudel)?\n?/gm, '');
    clean = clean.replace(/\n?```$/gm, '');
    clean = clean.replace(/^```$/gm, '');
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip HTML-style comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    
    // Only filter out lines that are pure explanation (no code patterns at all)
    const lines = clean.split('\n');
    const codeLines: string[] = [];
    let foundCode = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (trimmed === '' && !foundCode) continue;
      
      // Keep lines that:
      // 1. Are comments (start with //)
      // 2. Have code-like patterns (parentheses, operators, function calls)
      // 3. Have Strudel-specific syntax
      const isComment = trimmed.startsWith('//');
      const hasCodePattern = /[()=.,;]/.test(trimmed);
      const hasStrudelSyntax = /\b(stack|s\(|sound|note|\.out\(|$:|\.(gain|delay|room|pan|cutoff|resonance|attack|decay|sustain|release|clip|shape)|every\(|fast\(|slow\(|cat\(|seq\(|struct\()/.test(trimmed);
      
      if (isComment || hasCodePattern || hasStrudelSyntax) {
        codeLines.push(line);
        if (hasStrudelSyntax || hasCodePattern) {
          foundCode = true;
        }
      }
      // Skip pure explanation lines (natural language without code patterns)
    }
    
    clean = codeLines.join('\n');
    
    return clean.trim();
  }
}
