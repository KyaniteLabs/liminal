/**
 * ASCIIArtGenerator - Generates text-based ASCII art
 * 
 * Creates ASCII art in various styles:
 * - Geometric patterns
 * - Character/figure art
 * - Landscape scenes
 * - Abstract compositions
 * - Typography
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
    this.llmClient = llmClient || new LLMClient({
      provider: 'ollama',
      model: 'qwen2.5-coder:7b',
    });
  }

  async generate(prompt: string, options: ASCIIOptions = {}): Promise<string> {
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

    try {
      const response = await this.llmClient.generate(systemPrompt, userPrompt);
      const code = typeof response === 'string' ? response : (response.code || '');
      return this.formatASCII(code, width, height);
    } catch (error) {
      console.error('ASCII generation failed:', error);
      return this.getFallbackArt(prompt, options);
    }
  }

  private formatASCII(code: string, width: number, height: number): string {
    // Remove markdown code blocks if present
    const art = code.replace(/```[\s\S]*?```/g, '').trim();
    
    // Split into lines
    let lines = art.split('\n');
    
    // Trim or pad each line to width
    lines = lines.map(line => {
      if (line.length > width) return line.slice(0, width);
      return line.padEnd(width, ' ');
    });
    
    // Trim or pad to height
    if (lines.length > height) {
      lines = lines.slice(0, height);
    } else {
      while (lines.length < height) {
        lines.push(' '.repeat(width));
      }
    }
    
    return lines.join('\n');
  }

  private getFallbackArt(_prompt: string, options: ASCIIOptions): string {
    const style = options.style || 'abstract';
    const fallbacks: Record<ASCIIStyle, string> = {
      geometric: this.getGeometricArt(),
      character: this.getCharacterArt(),
      landscape: this.getLandscapeArt(),
      abstract: this.getAbstractArt(),
      typography: this.getTypographyArt(),
      mandala: this.getMandalaArt(),
    };
    return fallbacks[style] || fallbacks.abstract;
  }

  /**
   * Quick template-based generation
   */
  static generateQuick(style: ASCIIStyle): string {
    const generator = new ASCIIArtGenerator();
    return generator.getFallbackArt('', { style });
  }

  private getGeometricArt(): string {
    return `
        ██████╗ 
       ██╔════╝ 
       ██║  ███╗
       ██║   ██║
       ╚██████╔╝
        ╚═════╝ 
    `.trim();
  }

  private getCharacterArt(): string {
    return `
      O
     /|\\
      |
     / \\
    `.trim();
  }

  private getLandscapeArt(): string {
    return `
         ~-~-~-~-~-~-~-~
      ~-~  /\\  /\\  ~-~
    ~-~   /  \\/  \\   ~-~
   ~-~___/____\\____\\___~-~
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    `.trim();
  }

  private getAbstractArt(): string {
    return `
    .-~~~-.
   /       \\  .-~-.  
  |  o   o  | /     \\ 
  |    ~    |/  .-.  \\ 
   \\  '-'  /  /   \\  |
    '-...-'   '...'
    `.trim();
  }

  private getTypographyArt(): string {
    return `
 _    _      _ _         __          __        _     _ 
| |  | |    | | |        \\ \\        / /       | |   | |
| |__| | ___| | | ___     \\ \\  /\\  / /__  _ __| | __| |
|  __  |/ _ \\ | |/ _ \\     \\ \\/  \\/ / _ \\| '__| |/ _\` |
| |  | |  __/ | | (_) |     \\  /\\  / (_) | |  | | (_| |
|_|  |_|\\___|_|_|\\___/       \\/  \\/ \\___/|_|  |_|\\__,_|
    `.trim();
  }

  private getMandalaArt(): string {
    return `
         .-:-.
        /     \\
       |  .-.  |
        \\|   |/
    .-===:   :===-.
   /     |   |     \\
  |      |   |      |
   \\     |   |     /
    '-===:   :===-'
        /|   |\\
       |  '-'  |
        \\     /
         '-:-'
    `.trim();
  }

  /**
   * Generate animated ASCII (returns array of frames)
   */
  async generateAnimated(prompt: string, frames: number = 10, options: ASCIIOptions = {}): Promise<string[]> {
    const baseArt = await this.generate(prompt, options);
    const result: string[] = [baseArt];
    
    // Generate simple animation frames by rotating characters
    const rotationChars = ['|', '/', '-', '\\\\'];
    
    for (let i = 1; i < frames; i++) {
      const rotated = baseArt.split('').map((char) => {
        if (rotationChars.includes(char)) {
          const nextIdx = (rotationChars.indexOf(char) + 1) % rotationChars.length;
          return rotationChars[nextIdx];
        }
        return char;
      }).join('');
      result.push(rotated);
    }
    
    return result;
  }

  /**
   * Create ASCII from pattern definition
   */
  static fromPattern(pattern: string[][]): string {
    return pattern.map(row => row.join('')).join('\n');
  }

  /**
   * Common ASCII patterns library
   */
  static getPatterns() {
    return {
      heart: [
        '  **   **  ',
        ' ***** ***** ',
        '*************',
        ' *********** ',
        '  *********  ',
        '   *******   ',
        '    *****    ',
        '     ***     ',
        '      *      ',
      ],
      star: [
        '      *      ',
        '     ***     ',
        '    *****    ',
        '   *******   ',
        '*************',
        '   *******   ',
        '  *********  ',
        ' *********** ',
        '*************',
      ],
      spiral: [
        '    ######   ',
        '  ##    ##   ',
        ' ##  ####    ',
        ' ## ##       ',
        ' ##### ####  ',
        '  ####    ## ',
        '       ## ## ',
        '    ####  ## ',
        '   ##    ##  ',
        '    ######   ',
      ],
    };
  }
}
