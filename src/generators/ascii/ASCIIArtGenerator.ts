/**
 * ASCIIArtGenerator - Generates text-based ASCII art via LLM
 * 
 * NO TEMPLATES - Everything goes through the LLM
 * 
 * FIXED: Simplified prompt, reduced dimensions, added examples
 */

import { LLMClient } from '../../llm/LLMClient.js';

export type ASCIIStyle = 'simple' | 'landscape' | 'abstract';

export interface ASCIIOptions {
  style?: ASCIIStyle;
  width?: number;
  height?: number;
}

export class ASCIIArtGenerator {
  private llmClient: LLMClient;

  constructor(llmClient?: LLMClient) {
    this.llmClient = llmClient || new LLMClient();
  }

  async generate(prompt: string, options: ASCIIOptions = {}): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('ASCIIArtGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }
    
    // Reduced default size for faster generation
    const width = options.width || 40;
    const height = options.height || 20;
    const style = options.style || 'simple';
    
    const systemPrompt = `You create ASCII art. Output ONLY ASCII characters.

RULES:
1. Use ONLY these characters: space . - ~ + = * # % @
2. Output EXACTLY ${height} lines
3. Each line EXACTLY ${width} characters
4. NO code blocks, NO explanations, NO markdown
5. ONLY the ASCII art

EXAMPLE OUTPUT:
@@@@@@@@@@@@@@@@@@@@@@@@
@.....................@
@....@.........@......@
@...@...........@.....@
@..@....@@@......@....@
@@@@@@@@@@@@@@@@@@@@@@@@

Create ${style} ASCII art.`;

    const userPrompt = `Subject: ${prompt}

Output ${height} lines of ASCII art (${width} chars each):`;

    const response = await this.llmClient.generate(systemPrompt, userPrompt);
    const code = typeof response === 'string' ? response : (response.code || '');
    
    if (!code || code.trim() === '') {
      throw new Error('ASCIIArtGenerator: LLM returned empty code');
    }
    
    return this.formatASCII(code, width, height);
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
}
