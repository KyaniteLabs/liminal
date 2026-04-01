/**
 * StrudelGenerator - Generates Strudel (TidalCycles for JavaScript) patterns
 * 
 * FIXED: Better prompt handling, more validation
 */

import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';

export interface StrudelGeneratorOptions {
  signal?: AbortSignal;
  bpm?: number;
}

export class StrudelGenerator {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  async generate(prompt: string, options?: StrudelGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('StrudelGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }

    const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('music.strudel', {
      prompt,
      bpm: String(options?.bpm || 120),
    });
    
    const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

    if (!response.code || response.code.trim() === '') {
      throw new Error('StrudelGenerator: LLM returned empty code');
    }

    return this.sanitizeCode(response.code);
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
    
    // Validate: must have at least one sound source
    if (!/\b(s\(|sound\(|note\()/.test(clean)) {
      throw new Error('StrudelGenerator: No sound source found (need s(), sound(), or note())');
    }
    
    return clean.trim();
  }
}
