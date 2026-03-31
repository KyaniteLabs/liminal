/**
 * ASCIIArtGenerator - Generates text-based ASCII art via LLM
 * 
 * NO TEMPLATES - Everything goes through the LLM
 */

import { LLMClient } from '../../llm/LLMClient.js';

export type ASCIIStyle = 'geometric' | 'character' | 'landscape' | 'abstract' | 'typography' | 'mandala';

export interface ASCIIOptions {
  style?: ASCIIStyle;
  width?: number;
  height?: number;
  characters?: string;
  animated?: boolean;
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
    
    const width = options.width || 60;
    const height = options.height || 30;
    const style = options.style || 'abstract';
    
    const systemPrompt = `You are an ASCII art expert. Create precise, beautiful ASCII art.

RULES:
1. Output ONLY ASCII characters, no markdown, no explanations
2. Use space, .,-~+=*#%@ for shading (light to dark)
3. Width: ${width} characters, Height: ${height} lines
4. Style: ${style}
5. Keep proportions correct
6. Use negative space effectively`;

    const userPrompt = `Create ASCII art: ${prompt}

Dimensions: ${width}x${height}
Style: ${style}

Output ONLY the ASCII art (no code blocks, no explanations):`;

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
      .slice(0, height)
      .map(line => line.slice(0, width));
    
    return cleanLines.join('\n');
  }
}
