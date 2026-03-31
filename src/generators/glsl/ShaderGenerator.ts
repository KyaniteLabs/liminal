import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';

export interface ShaderGeneratorOptions {
  signal?: AbortSignal;
}

export class ShaderGenerator {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  async generate(prompt: string, options?: ShaderGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error('ShaderGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }

    const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('glsl.generate', {
      prompt,
    });
    const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

    if (!response.code || response.code.trim() === '') {
      throw new Error('ShaderGenerator: LLM returned empty code');
    }

    // Check for truncated/incomplete code - throw error instead of using template
    if (this.isTruncated(response.code)) {
      throw new Error('ShaderGenerator: Generated code appears truncated or incomplete');
    }

    return response.code;
  }

  /**
   * Detect if GLSL code is truncated or incomplete
   */
  private isTruncated(code: string): boolean {
    const trimmed = code.trim();
    
    // Check for mid-line truncation (no newline at end)
    const lastChar = trimmed.slice(-1);
    const lastLine = trimmed.split('\n').pop() || '';
    
    // Ends mid-line without semicolon or closing brace
    if (!['}', ';', '\n'].includes(lastChar) && lastLine.length > 0) {
      // Check if it's a comment (might be intentional)
      if (!lastLine.trim().startsWith('//') && !lastLine.trim().startsWith('/*')) {
        return true;
      }
    }
    
    // Check for unclosed braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      return true;
    }
    
    // Check for unclosed parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      return true;
    }
    
    // Check for missing main function or gl_FragColor
    if (!code.includes('void main') || !code.includes('gl_FragColor')) {
      return true;
    }
    
    return false;
  }
}
