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
    
    // Find actual code start
    const lines = clean.split('\n');
    const codeStart = lines.findIndex(l => 
      l.trim().startsWith('stack') || 
      l.trim().startsWith('sound') ||
      l.trim().startsWith('s(') ||
      l.trim().startsWith('note') ||
      l.trim().startsWith('const') ||
      l.trim().startsWith('import')
    );
    
    if (codeStart > 0) {
      clean = lines.slice(codeStart).join('\n');
    }
    
    // Remove any remaining explanation lines (lines without Strudel syntax)
    const strudelLines = clean.split('\n').filter(line => {
      const trimmed = line.trim();
      if (trimmed === '') return false;
      if (trimmed.startsWith('//')) return true; // Keep comments
      // Keep lines with Strudel patterns
      return /[\(\)=.,;]/.test(trimmed) || 
             /\b(stack|s|note|sound|cpm|fast|slow|gain|pan|room|delay)\b/.test(trimmed);
    });
    
    return strudelLines.join('\n').trim();
  }
}
