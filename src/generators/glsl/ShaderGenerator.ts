import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { selectShaderTemplate } from './ShaderTemplates.js';

export interface ShaderGeneratorOptions {
  signal?: AbortSignal;
}

export class ShaderGenerator {
  private llm: LLMClient;

  constructor(llmConfig?: Partial<LLMConfig>) {
    this.llm = new LLMClient(llmConfig);
  }

  async generate(prompt: string, options?: ShaderGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      return selectShaderTemplate(prompt);
    }

    try {
      const systemPrompt = `You are an expert GLSL shader programmer.
Generate a creative fragment shader based on the user's description.

Rules:
1. Return ONLY valid GLSL fragment shader code (no markdown, no explanations)
2. Include these uniforms: vec2 u_resolution, float u_time
3. Optionally include: vec2 u_mouse
4. Use precision highp float at the top
5. Output via gl_FragColor
6. Make it visually stunning — use ray marching, SDFs, noise, voronoi, or other advanced techniques
7. Ensure it animates smoothly with u_time
8. Keep it performant (avoid extremely expensive loops)`;

      const userPrompt = `Create a GLSL fragment shader: ${prompt}`;
      const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

      if (!response.code || response.code.trim() === '') {
        return selectShaderTemplate(prompt);
      }

      return response.code;
    } catch (error) {
      console.error('ShaderGenerator.generate: LLM call failed, using template fallback:', error instanceof Error ? error.message : error);
      return selectShaderTemplate(prompt);
    }
  }
}
