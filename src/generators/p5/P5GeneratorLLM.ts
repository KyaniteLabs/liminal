import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { GenerationError } from '../../errors/GenerationError.js';

export interface P5GeneratorOptions {
  maxIterations?: number;
  temperature?: number;
  /** Optional AbortSignal for request timeout/cancellation */
  signal?: AbortSignal;
  /** Bypass LLM cache for this generation */
  bypassCache?: boolean;
}

export class P5GeneratorLLM {
  private llm: LLMClient;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>, _options?: P5GeneratorOptions) {
    this.llm = llmOrConfig instanceof LLMClient ? llmOrConfig : new LLMClient(llmOrConfig);
  }

  async generate(prompt: string, options?: P5GeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new GenerationError(
        '[P5Generator] Using LLM-based generation. Ensure LIMINAL_LLM_API_KEY or OPENAI_API_KEY is set.',
        'p5'
      );
    }

    // Only add sound-specific instructions via context
    const lowerPrompt = prompt.toLowerCase();
    const soundContext = this.promptSuggestsSound(lowerPrompt)
      ? '\nNote: The user wants sound/audio. Include Web Audio API (AudioContext, createOscillator) or p5.sound.'
      : '';
    const context = soundContext || undefined;
    const llmResponse = await this.llm.generateP5Sketch(prompt, context, options?.signal, options?.bypassCache);

    if (!llmResponse.code || llmResponse.code.trim() === '') {
      throw new GenerationError(
        'P5GeneratorLLM: LLM returned empty code for prompt: ' + prompt.slice(0, 100),
        'p5',
        { prompt: prompt.slice(0, 100) }
      );
    }

    return llmResponse.code;
  }

  /**
   * Returns true if the prompt suggests sound/audio (e.g. "sound", "audio", "music", "beep", "subtle sound").
   */
  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }
}
