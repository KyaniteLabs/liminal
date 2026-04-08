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
    if (!code || code.trim().length === 0) {
      return '';
    }
    
    let clean = code;
    
    // Strip markdown code fences (only at start/end, preserve code inside)
    clean = clean.replace(/^```(?:javascript|js)?\n?/gm, '');
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
      // 2. Have code-like patterns (parentheses, method chains, operators)
      // 3. Have Hydra-specific syntax
      const isComment = trimmed.startsWith('//');
      const hasCodePattern = /[()=.,;]/.test(trimmed);
      const hasHydraSyntax = /\b(osc|shape|noise|voronoi|src|render|out|speed|scale|color|blend|modulate|pixelate|rotate|scroll|post|fast|slow|mask)\b/.test(trimmed);
      
      if (isComment || hasCodePattern || hasHydraSyntax) {
        codeLines.push(line);
        if (hasHydraSyntax || hasCodePattern) {
          foundCode = true;
        }
      }
      // Skip pure explanation lines (natural language without code patterns)
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
