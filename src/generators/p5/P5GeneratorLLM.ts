import { LLMClient, LLMConfig, LLMResponse } from '../../llm/LLMClient.js';
import { GenerationError } from '../../errors/GenerationError.js';
import { Layer, createLayer } from '../../composition/types.js';
import { getEffectiveConfig } from '../../config/ConfigLoader.js';

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
  private _configNeedsResolution: boolean;

  constructor(llmOrConfig?: LLMClient | Partial<LLMConfig>, _options?: P5GeneratorOptions) {
    this._configNeedsResolution = false;

    if (llmOrConfig instanceof LLMClient) {
      this.llm = llmOrConfig;
    } else if (llmOrConfig && (llmOrConfig.baseUrl || llmOrConfig.apiKey || llmOrConfig.model)) {
      this.llm = new LLMClient({ ...llmOrConfig, role: 'generator' });
    } else {
      this.llm = new LLMClient({ role: 'generator' });
      this._configNeedsResolution = true;
    }
  }

  /**
   * Resolve LLM config from getEffectiveConfig() if no explicit config was provided.
   * Called lazily on first generation to ensure providers like MiniMax (from
   * ~/.liminal/config.json) are properly wired without requiring env vars.
   */
  private async resolveConfigIfNeeded(): Promise<void> {
    if (!this._configNeedsResolution) return;
    this._configNeedsResolution = false;

    const config = await getEffectiveConfig(undefined, process.cwd());
    if (config.baseUrl || config.apiKey) {
      this.llm = new LLMClient({
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        role: 'generator',
      });
    }
  }

  async generate(prompt: string, options?: P5GeneratorOptions): Promise<string> {
    const response = await this.generateInternal(prompt, options);
    return response.code;
  }

  /**
   * Generate with full telemetry — returns complete LLMResponse
   * including reasoning traces, thinking source, quality scores.
   */
  async generateFull(prompt: string, options?: P5GeneratorOptions): Promise<LLMResponse> {
    return this.generateInternal(prompt, options);
  }

  /**
   * Generate a Layer with full metadata.
   */
  async generateLayer(prompt: string, options?: P5GeneratorOptions): Promise<Layer> {
    const response = await this.generateInternal(prompt, options);

    return createLayer('p5', response.code, prompt, {
      generator: 'P5GeneratorLLM',
      model: this.llm.getConfig().model || 'unknown',
      generatedAt: new Date().toISOString(),
      thinking: response.thinking,
      recoveredFromThinking: response.recoveredFromThinking,
      validation: { passed: true },
    });
  }

  /**
   * Internal generation method.
   */
  private async generateInternal(prompt: string, options?: P5GeneratorOptions): Promise<LLMResponse> {
    // Resolve LLM config lazily on first generation call
    await this.resolveConfigIfNeeded();

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

    return llmResponse;
  }

  /**
   * Returns true if the prompt suggests sound/audio (e.g. "sound", "audio", "music", "beep", "subtle sound").
   */
  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }
}
