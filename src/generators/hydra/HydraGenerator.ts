import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';

export interface HydraGeneratorOptions {
  signal?: AbortSignal;
}

export class HydraGenerator {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  async generate(prompt: string, options?: HydraGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('HydraGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }

    const systemPrompt = `You are an expert in Hydra video synthesizer (hydra-synth).

Generate Hydra JavaScript code for live coding visual patterns.

CONSTRAINTS:
- Output ONLY valid Hydra JavaScript code
- Use Hydra's chainable API: osc(), shape(), noise(), voronoi(), etc.
- Connect to output with .out(o0) or similar
- Use .kaleid(), .color(), .rotate(), .scale() for effects
- NO markdown, NO explanation, NO code blocks

OUTPUT FORMAT:
- Single line or multi-line chain of Hydra methods
- Must end with .out(o0)`;

    const userPrompt = `Create Hydra video synth: ${prompt}`;
    
    const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

    if (!response.code || response.code.trim() === '') {
      throw new Error('HydraGenerator: LLM returned empty code');
    }

    return this.sanitizeCode(response.code);
  }

  private sanitizeCode(code: string): string {
    let clean = code;
    
    // Strip <think> tags and their content (LLM reasoning contamination)
    clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Strip markdown fences
    clean = clean.replace(/```(?:javascript|js)?\n/g, '').replace(/```/g, '');
    
    // Remove HTML comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    
    // Split into lines and filter
    const lines = clean.split('\n');
    const codeLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (trimmed === '' && codeLines.length === 0) continue;
      
      // Skip explanation lines (that don't look like code)
      if (trimmed && !trimmed.startsWith('//') && !/[\(\)=.,;]/.test(trimmed)) {
        // Might be an explanation - check if it has Hydra syntax
        if (!/\b(osc|shape|noise|voronoi|src|render|out)\b/.test(trimmed)) {
          continue;
        }
      }
      
      codeLines.push(line);
    }
    
    clean = codeLines.join('\n');
    
    // Ensure it ends with .out() if no render
    if (!clean.includes('.out(') && !clean.includes('render(')) {
      clean += '\n.out(o0)';
    }
    
    // Ensure there's a render call if multiple outputs
    if (clean.includes('.out(o1)') || clean.includes('.out(o2)') || clean.includes('.out(o3)')) {
      if (!clean.includes('render(')) {
        clean += '\nrender(o0)';
      }
    }
    
    return clean.trim();
  }
}
