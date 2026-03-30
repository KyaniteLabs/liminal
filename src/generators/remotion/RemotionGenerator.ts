import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';
import { selectRemotionTemplate } from './RemotionTemplates.js';
import { Logger } from '../../utils/Logger.js';

export interface RemotionGeneratorOptions {
  signal?: AbortSignal;
}

export class RemotionGenerator {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  canHandle(prompt: string): number {
    const lower = prompt.toLowerCase();
    if (/\b(remotion)\b/.test(lower)) return 0.9;
    if (/\b(video|animation|motion\s*graphics|title\s*sequence|intro\s*video)\b/.test(lower)) return 0.8;
    return 0;
  }

  async generate(prompt: string, options?: RemotionGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      return selectRemotionTemplate(prompt);
    }

    try {
      const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('remotion.generate', {
        prompt,
        fps: '30',
        duration: '150',
        width: '1920',
        height: '1080',
      });
      const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

      if (!response.code || response.code.trim() === '') {
        return selectRemotionTemplate(prompt);
      }

      return response.code;
    } catch (error) {
      Logger.error('RemotionGenerator', `LLM call failed, using template fallback: ${error instanceof Error ? error.message : error}`);
      return selectRemotionTemplate(prompt);
    }
  }
}
