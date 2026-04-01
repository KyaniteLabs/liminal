import { TierBasedGenerator, type TierBasedGeneratorOptions } from '../TierBasedGenerator.js';

export interface HydraGeneratorOptions extends TierBasedGeneratorOptions {}

export class HydraGenerator extends TierBasedGenerator {
  constructor(llmOrConfig?: ConstructorParameters<typeof TierBasedGenerator>[1]) {
    super('hydra', llmOrConfig);
  }

  async generate(prompt: string, options?: HydraGeneratorOptions): Promise<string> {
    const code = await super.generate(prompt, options);
    return this.sanitizeCode(code);
  }

  protected validateOutput(code: string): { valid: boolean; error?: string } {
    // Basic Hydra validation - must have Hydra-specific syntax
    if (!/\b(osc|shape|noise|voronoi|src|render|out)\b/.test(code)) {
      return { valid: false, error: 'No Hydra syntax found' };
    }
    return { valid: true };
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
      if (trimmed && !trimmed.startsWith('//') && !/[()=.,;]/.test(trimmed)) {
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
