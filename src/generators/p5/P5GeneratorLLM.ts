import { LLMClient, LLMConfig, LLMResponse } from '../../llm/LLMClient.js';
import { GenerationError } from '../../errors/GenerationError.js';
import { Layer, createLayer, LayerRole } from '../../composition/types.js';
import { getEffectiveConfig } from '../../config/ConfigLoader.js';
import { GENERATOR_TOOLS, createGeneratorToolExecutor } from '../../harness/tools/generator-tools.js';
import { P5Validator } from '../../core/validators/P5Validator.js';

export interface P5GeneratorOptions {
  maxIterations?: number;
  temperature?: number;
  /** Optional AbortSignal for request timeout/cancellation */
  signal?: AbortSignal;
  /** Bypass LLM cache for this generation */
  bypassCache?: boolean;
  /** Layer role hint — when 'overlay', prompt avoids opaque background() */
  layerRole?: LayerRole;
  /** Whether this layer should render with a transparent background */
  transparentBackground?: boolean;
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
    }, {
      role: options?.layerRole,
      transparentBackground: options?.transparentBackground,
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

    // Build system prompt with optional overlay rules
    let systemRules = '- Output ONLY JavaScript code\n- Use function setup() and function draw()\n- Include createCanvas()\n- NO explanations, NO markdown';
    if (options?.layerRole === 'overlay') {
      systemRules += '\n- This is a TRANSPARENT OVERLAY layer — do NOT call background() in draw()\n- Use clear() at the start of draw() to keep the canvas transparent\n- Only draw elements that should appear on top of the background layer';
    }

    const systemPrompt = `You are a creative coder. Generate p5.js code.\nRules:\n${systemRules}`;
    const userPrompt = `Create a p5.js sketch: ${prompt}${context ? '\\nContext: ' + context : ''}`;
    const toolLoopResult = await this.llm.generateWithToolLoop({
      systemPrompt,
      userPrompt,
      tools: GENERATOR_TOOLS,
      toolExecutor: createGeneratorToolExecutor('p5'),
      maxIterations: 3,
      signal: options?.signal,
    });
    let llmResponse: LLMResponse = {
      code: this.sanitizeP5Code(toolLoopResult.content),
      success: toolLoopResult.success,
      error: toolLoopResult.error,
    };

    if (!llmResponse.code || llmResponse.code.trim() === '') {
      const retryResponse = await this.retryWithDirectCompletion(
        prompt,
        systemPrompt,
        userPrompt,
        'The previous tool-assisted attempt returned no p5.js code.',
        options?.signal
      );
      if (!retryResponse) {
        throw new GenerationError(
          'P5GeneratorLLM: LLM returned empty code for prompt: ' + prompt.slice(0, 100),
          'p5',
          { prompt: prompt.slice(0, 100) }
        );
      }
      llmResponse = retryResponse;
    }

    const validation = P5Validator.validate(llmResponse.code);
    if (!validation.valid) {
      const retryResponse = await this.retryWithDirectCompletion(
        prompt,
        systemPrompt,
        userPrompt,
        `p5.js validation failed: ${validation.errors.join('; ')}`,
        options?.signal,
        llmResponse.code
      );
      if (retryResponse) {
        const retryValidation = P5Validator.validate(retryResponse.code);
        if (retryValidation.valid) {
          llmResponse = retryResponse;
        } else {
          throw new GenerationError(
            `P5GeneratorLLM: p5.js validation failed after retry: ${retryValidation.errors.join('; ')}`,
            'p5',
            { prompt: prompt.slice(0, 100), validationErrors: retryValidation.errors, generatedCode: retryResponse.code }
          );
        }
      } else {
        throw new GenerationError(
          `P5GeneratorLLM: p5.js validation failed: ${validation.errors.join('; ')}`,
          'p5',
          { prompt: prompt.slice(0, 100), validationErrors: validation.errors, generatedCode: llmResponse.code }
        );
      }
    }

    return llmResponse;
  }

  private async retryWithDirectCompletion(
    originalPrompt: string,
    systemPrompt: string,
    userPrompt: string,
    reason: string,
    signal?: AbortSignal,
    failedCode?: string
  ): Promise<LLMResponse | null> {
    if (typeof this.llm.complete !== 'function') return null;

    const directResult = await this.llm.complete({
      systemPrompt,
      prompt: [
        userPrompt,
        '',
        reason,
        'Regenerate the entire p5.js sketch now.',
        'Return only runnable p5.js JavaScript with function setup(), function draw(), and createCanvas().',
        `Original request: ${originalPrompt}`,
        failedCode ? `Previous failed output:\n${failedCode.slice(0, 4000)}` : '',
      ].filter(Boolean).join('\n'),
      signal,
    });

    const code = this.sanitizeP5Code(directResult.text ?? '');
    if (!code) return null;

    return {
      code,
      explanation: directResult.text,
      success: directResult.success,
      error: directResult.error,
    };
  }

  private sanitizeP5Code(code: string): string {
    let clean = code ?? '';
    clean = clean.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
    const fencedSketch = clean.match(/```(?:javascript|js)?\s*\n?([\s\S]*?)```/i);
    if (fencedSketch?.[1] && /function\s+setup\s*\(/.test(fencedSketch[1])) {
      clean = fencedSketch[1];
    } else {
      const unclosedFenceSketch = clean.match(/```(?:javascript|js)?\s*\n?([\s\S]*)/i);
      if (unclosedFenceSketch?.[1] && /function\s+setup\s*\(/.test(unclosedFenceSketch[1])) {
        clean = unclosedFenceSketch[1];
      }
    }
    return clean.trim();
  }

  /**
   * Returns true if the prompt suggests sound/audio (e.g. "sound", "audio", "music", "beep", "subtle sound").
   */
  private promptSuggestsSound(lowerPrompt: string): boolean {
    const soundKeywords = ['sound', 'audio', 'music', 'beep'];
    return soundKeywords.some((kw) => lowerPrompt.includes(kw));
  }
}
