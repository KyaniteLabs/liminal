import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';

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
      throw new Error('ThreeGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }

    const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('three.generate', {
      prompt,
      threeVersion: '0.160.0',
    });
    const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

    if (!response.code || response.code.trim() === '') {
      throw new Error('ThreeGenerator: LLM returned empty code');
    }

    return response.code;
  }
}
