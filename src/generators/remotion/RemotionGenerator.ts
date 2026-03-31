import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { PromptLibrary } from '../../prompts/index.js';

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
      throw new Error('RemotionGenerator: No LLM configured. Set LIMINAL_LLM_BASE_URL and LIMINAL_LLM_MODEL.');
    }

    const { system: systemPrompt, user: userPrompt } = PromptLibrary.render('remotion.generate', {
      prompt,
      fps: '30',
      duration: '150',
      width: '1920',
      height: '1080',
    });
    const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

    if (!response.code || response.code.trim() === '') {
      throw new Error('RemotionGenerator: LLM returned empty code');
    }

    return response.code;
  }
}
