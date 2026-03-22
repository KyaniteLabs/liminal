import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';
import { selectThreeTemplate } from './ThreeTemplates.js';
import { Logger } from '../../utils/Logger.js';

export interface ThreeGeneratorOptions {
  signal?: AbortSignal;
}

export class ThreeGenerator {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  async generate(prompt: string, options?: ThreeGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      return selectThreeTemplate(prompt);
    }

    try {
      const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('three.generate', {
        prompt,
        threeVersion: '0.160.0',
      });
      const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

      if (!response.code || response.code.trim() === '') {
        return selectThreeTemplate(prompt);
      }

      return response.code;
    } catch (error) {
      Logger.error('ThreeGenerator', `LLM call failed, using template fallback: ${error instanceof Error ? error.message : error}`);
      return selectThreeTemplate(prompt);
    }
  }
}
