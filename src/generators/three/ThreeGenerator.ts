import { LLMClient, LLMConfig } from '../../llm/LLMClient.js';
import { selectThreeTemplate } from './ThreeTemplates.js';

export interface ThreeGeneratorOptions {
  signal?: AbortSignal;
}

export class ThreeGenerator {
  private llm: LLMClient;

  constructor(llmConfig?: Partial<LLMConfig>) {
    this.llm = new LLMClient(llmConfig);
  }

  async generate(prompt: string, options?: ThreeGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      return selectThreeTemplate(prompt);
    }

    try {
      const systemPrompt = `You are an expert Three.js programmer.
Generate a creative 3D scene based on the user's description.

Rules:
1. Return ONLY a complete, self-contained HTML file
2. Use Three.js via CDN importmap (ES modules):
   <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
3. Use <script type="module"> for your code
4. Include OrbitControls for camera interaction
5. Handle window resize
6. Use lighting (ambient + point/directional)
7. Use MeshStandardMaterial or MeshPhysicalMaterial for realistic look
8. Include animation loop with requestAnimationFrame
9. Make it visually stunning`;

      const userPrompt = `Create a Three.js 3D scene: ${prompt}`;
      const response = await this.llm.generate(systemPrompt, userPrompt, options?.signal);

      if (!response.code || response.code.trim() === '') {
        return selectThreeTemplate(prompt);
      }

      return response.code;
    } catch (error) {
      console.error('ThreeGenerator.generate: LLM call failed, using template fallback:', error instanceof Error ? error.message : error);
      return selectThreeTemplate(prompt);
    }
  }
}
