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
    let clean = code;
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip markdown code fences
    clean = clean.replace(/```(?:javascript|js|strudel)?\n/g, '').replace(/```/g, '');
    
    // Remove HTML-style comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    
    // Split into lines
    const lines = clean.split('\n');
    const codeLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (trimmed === '' && codeLines.length === 0) continue;
      
      // Skip explanation lines
      if (trimmed && !trimmed.startsWith('//')) {
        // Must have Strudel syntax indicators
        const hasStrudelSyntax = /\b(stack|s\(|sound|note|\.out\(|$:|\.(gain|delay|room|pan)|every\(|fast\(|slow\()/.test(trimmed);
        const hasInvalidSyntax = /\b(s1\s+\[|d1\s+\$|#|\$\s+sound)/.test(trimmed);
        
        if (!hasStrudelSyntax || hasInvalidSyntax) {
          continue;
        }
      }
      
      codeLines.push(line);
    }
    
    clean = codeLines.join('\n');
    
    return clean.trim();
  }
}
