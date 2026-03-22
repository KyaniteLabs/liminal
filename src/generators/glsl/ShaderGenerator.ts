import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';
import { selectShaderTemplate } from './ShaderTemplates.js';
import { Logger } from '../../utils/Logger.js';

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
      return selectShaderTemplate(prompt);
    }

    try {
      const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('glsl.generate', {
        prompt,
      });
      const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

      if (!response.code || response.code.trim() === '') {
        return selectShaderTemplate(prompt);
      }

      return response.code;
    } catch (error) {
      Logger.error('ShaderGenerator', `LLM call failed, using template fallback: ${error instanceof Error ? error.message : error}`);
      return selectShaderTemplate(prompt);
    }
  }
}
