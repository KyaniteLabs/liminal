export interface LLMConfig {
  provider: 'inception' | 'ollama' | 'openai' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  code: string;
  explanation?: string;
  success: boolean;
  error?: string;
}

export class LLMClient {
  private config: LLMConfig;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      provider: config?.provider || (process.env.ATELIER_LLM_PROVIDER as LLMConfig['provider']) || 'inception',
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? process.env.INCEPTION_API_KEY ?? process.env.ATELIER_LLM_API_KEY,
      baseUrl: config?.baseUrl || process.env.ATELIER_LLM_BASE_URL,
      model: config?.model || process.env.ATELIER_LLM_MODEL || 'inception-001',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
    };
  }

  /**
   * Generic LLM generation method.
   * Routes to the configured provider (inception, ollama, openai, anthropic).
   * Used by generateP5Sketch, improveP5Sketch, and domain-specific generators.
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<LLMResponse> {
    try {
      if (this.config.provider === 'inception') {
        return await this.callInception(systemPrompt, userPrompt, signal);
      } else if (this.config.provider === 'ollama') {
        return await this.callOllama(systemPrompt, userPrompt, signal);
      } else if (this.config.provider === 'openai') {
        return await this.callOpenAI(systemPrompt, userPrompt, signal);
      } else if (this.config.provider === 'anthropic') {
        return await this.callAnthropic(systemPrompt, userPrompt, signal);
      } else {
        return { code: '', success: false, error: 'Unknown provider: ' + this.config.provider };
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('LLMClient.generate failed:', errMsg);
      return {
        code: `// LLM generation failed: ${errMsg}`,
        success: false,
        error: errMsg,
      };
    }
  }

  async generateP5Sketch(prompt: string, context?: string, signal?: AbortSignal): Promise<LLMResponse> {
    const systemPrompt = `You are an expert creative coding assistant specializing in p5.js.
Generate valid, creative p5.js sketch code based on the user's description.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Include setup() and draw() functions
3. Use creative colors, animations, and effects that match the prompt
4. Add comments explaining key parts
5. Ensure code is self-contained and runnable
6. Canvas size: use createCanvas(800, 600) or appropriate size
7. Include p5.js library usage (shapes, colors, animation, interaction if relevant)

Example output format:
function setup() {
  createCanvas(800, 600);
  // initialization
}

function draw() {
  // drawing code
}`;

    const userPrompt = `Create a p5.js sketch: ${prompt}
${context ? `\nContext: ${context}` : ''}`;

    return this.generate(systemPrompt, userPrompt, signal);
  }

  /**
   * Ask the LLM to improve existing p5.js sketch code.
   * Uses same backend as generateP5Sketch (callInception/callOllama).
   */
  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const systemPrompt = `You are an expert creative coding assistant specializing in p5.js.
Improve the following p5.js sketch. Keep it valid and runnable.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Preserve or add setup() and draw() as needed
3. Improve aesthetics, performance, or structure without changing the core idea
4. Ensure code is self-contained and runnable
5. Canvas size: use createCanvas(800, 600) or appropriate size`;

    const userPrompt = `Improve this p5.js sketch. Current code:\n\n${currentCode}`;

    return this.generate(systemPrompt, userPrompt);
  }

  private async callInception(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.inceptionlabs.ai/v1';

    // Build headers - Authorization only if API key is provided (for LM Studio compatibility)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Inception API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
  }

  private parseChatCompletionResponse(data: { choices?: Array<{ message?: { content?: string } }> }): LLMResponse {
    const code = data.choices?.[0]?.message?.content || '';
    const codeMatch = code.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : code.trim();
    return {
      code: cleanCode,
      explanation: data.choices?.[0]?.message?.content,
      success: true,
    };
  }

  private async callOpenAI(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
  }

  private async callAnthropic(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey || '',
      'anthropic-version': '2023-06-01',
    };

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 2000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '';
    const codeMatch = text.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : text.trim();
    return { code, success: true };
  }

  private async callOllama(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const code = data.response || '';

    return {
      code: code.trim(),
      success: true,
    };
  }

  static isConfigured(): boolean {
    return !!(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.INCEPTION_API_KEY ||
      process.env.ATELIER_LLM_API_KEY ||
      process.env.ATELIER_LLM_BASE_URL
    );
  }
}
