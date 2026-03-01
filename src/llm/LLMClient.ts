
export interface LLMConfig {
  provider: 'inception' | 'ollama' | 'openai';
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
      apiKey: config?.apiKey || process.env.INCEPTION_API_KEY || process.env.ATELIER_LLM_API_KEY,
      baseUrl: config?.baseUrl || process.env.ATELIER_LLM_BASE_URL,
      model: config?.model || process.env.ATELIER_LLM_MODEL || 'inception-001',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
    };
  }

  async generateP5Sketch(prompt: string, context?: string): Promise<LLMResponse> {
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

    try {
      if (this.config.provider === 'inception') {
        return await this.callInception(systemPrompt, userPrompt);
      } else if (this.config.provider === 'ollama') {
        return await this.callOllama(systemPrompt, userPrompt);
      } else {
        return { code: '', success: false, error: 'Unknown provider: ' + this.config.provider };
      }
    } catch (error) {
      return {
        code: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async callInception(system: string, user: string): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.inceptionlabs.ai/v1';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Inception API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const code = data.choices?.[0]?.message?.content || '';
    
    // Extract code from markdown if present
    const codeMatch = code.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : code.trim();

    return {
      code: cleanCode,
      explanation: data.choices?.[0]?.message?.content,
      success: true,
    };
  }

  private async callOllama(system: string, user: string): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
        stream: false,
      }),
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
    return !!(process.env.INCEPTION_API_KEY || process.env.ATELIER_LLM_API_KEY);
  }
}
