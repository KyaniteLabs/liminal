#!/usr/bin/env tsx
/**
 * Single Example Generator - Forces LLM usage (bypasses template generators)
 * Usage: tsx generate-single.ts <provider> <model> <domain>
 */

import { P5GeneratorLLM } from '../../src/generators/p5/P5GeneratorLLM.js';
import { ShaderGenerator } from '../../src/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from '../../src/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from '../../src/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from '../../src/generators/hydra/HydraGenerator.js';
import { writeFileSync } from 'fs';
import { ensureDir } from '../../src/utils/fs.js';
import { LLMClient } from '../../src/llm/LLMClient.js';

const PROMPTS: Record<string, string> = {
  p5: `Create an animated p5.js sketch featuring colorful fireworks exploding in the night sky. Include particle physics, gravity, and fading trails.`,
  
  glsl: `Create a GLSL fragment shader that renders a mesmerizing plasma effect with animated color shifts. Include noise functions and time-based animation.`,
  
  three: `Create a Three.js scene with a rotating wireframe torus knot that changes colors. Include orbit controls and animated lighting.`,
  
  strudel: `Create a Strudel pattern that plays a techno beat with kick, snare, hi-hat, and a bassline. Use pattern functions and effects.`,
  
  hydra: `Create a Hydra video synth patch with feedback effects, color shifting, and geometric patterns. Make it visually striking.`,
  
  revideo: `Create a Revideo scene that animates text typing with a cursor blink, then fades in a subtitle.`,
  
  html: `Create a responsive landing page for a creative coding portfolio. Include a hero section with animated gradient background, project cards, and contact form.`,
  
  ascii: `Create simple ASCII art of a mountain landscape. Use only basic characters like @ # % * + = - . and spaces.`,
  
  tone: `Create a Tone.js synthesizer patch that plays an ambient drone with reverb and delay effects. Use multiple oscillators and LFOs for rich sound.`
};

// Removed MiniMax-M2.1 (consistently times out)
interface ModelConfig {
  baseUrl: string;
  apiKeyEnv: string;
  modelId?: string;
  apiStyle?: 'openai' | 'ollama' | 'anthropic';
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'MiniMax-M2.7': { baseUrl: 'https://api.minimaxi.com/v1', apiKeyEnv: 'MINIMAX_API_KEY' },
  'MiniMax-M2.5': { baseUrl: 'https://api.minimaxi.com/v1', apiKeyEnv: 'MINIMAX_API_KEY' },
  'Qwen3.5-9B': { baseUrl: 'http://localhost:1234/v1', apiKeyEnv: 'LMSTUDIO_API_KEY', modelId: 'qwen3.5-9b' },
  'Qwen3-Coder-40B': { baseUrl: 'http://localhost:1234/v1', apiKeyEnv: 'LMSTUDIO_API_KEY', modelId: 'qwen3-coder-next-reap-40b-a3b-i1' },
  'Gemma3-4B': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'gemma3:4b' },
  'Kimi-K2.5': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'kimi-k2.5:cloud' },
  // Ollama Local Models
  'Granite4-1b': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'granite4:1b' },
  'Granite4-350m': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'granite4:350m' },
  // Qwen models REQUIRE native Ollama API - OpenAI compatibility layer breaks them
  // See: https://github.com/ollama/ollama/issues/XXX (Qwen OpenAI compat issue)
  'Qwen3.5-0.8b': { baseUrl: 'http://localhost:11434', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'qwen3.5:0.8b', apiStyle: 'ollama' },
  'Qwen3.5-2b': { baseUrl: 'http://localhost:11434', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'qwen3.5:2b', apiStyle: 'ollama' },
  'Phi4-Mini': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'phi4-mini:latest' },
  'Gemma3-4B-Ollama': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'gemma3:4b' },
  'LFM2.5-Thinking': { baseUrl: 'http://localhost:11434/v1', apiKeyEnv: 'OLLAMA_API_KEY', modelId: 'lfm2.5-thinking:1.2b' }
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function normalizeDomain(domain: string): string {
  return domain === 'remotion' ? 'revideo' : domain;
}

function isLocalBaseUrl(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1|::1/.test(baseUrl);
}

function formatError(context: string, error: unknown): string {
  if (error instanceof Error) return `${context}: ${error.message}`;
  return `${context}: ${String(error)}`;
}

async function generateWithLLM(prompt: string, domain: string, llmConfig: { baseUrl: string; apiKey: string; model: string; modelId?: string }): Promise<string> {
  const normalizedDomain = normalizeDomain(domain);
  const llm = new LLMClient({
    baseUrl: llmConfig.baseUrl,
    apiKey: llmConfig.apiKey,
    model: llmConfig.modelId || llmConfig.model,
    temperature: 0.7,
    maxTokens: 4000,
    apiStyle: llmConfig.apiStyle
  });
  
  llm.disableCache();
  
  switch (normalizedDomain) {
    case 'p5': {
      const gen = new P5GeneratorLLM(llm);
      return gen.generate(prompt);
    }
    case 'glsl': {
      const gen = new ShaderGenerator();
      (gen as any).llm = llm;
      return gen.generate(prompt);
    }
    case 'three': {
      const gen = new ThreeGenerator();
      (gen as any).llm = llm;
      return gen.generate(prompt);
    }
    case 'strudel': {
      const gen = new StrudelGenerator(llm);
      return gen.generate(prompt);
    }
    case 'hydra': {
      const gen = new HydraGenerator(llm);
      return gen.generate(prompt);
    }
    case 'revideo': {
      const { RemotionGenerator } = await import('../../src/generators/remotion/RemotionGenerator.js');
      const gen = new RemotionGenerator();
      (gen as any).llm = llm;
      return gen.generate(prompt);
    }
    case 'html': {
      const { HTMLWebGenerator } = await import('../../src/generators/html/HTMLWebGenerator.js');
      const gen = new HTMLWebGenerator(llm);
      return gen.generate(prompt, { responsive: true, includeAnimations: true });
    }
    case 'ascii': {
      const { ASCIIArtGenerator } = await import('../../src/generators/ascii/ASCIIArtGenerator.js');
      const gen = new ASCIIArtGenerator(llm);
      return gen.generate(prompt, { style: 'abstract', width: 60, height: 30 });
    }
    case 'tone': {
      const { ToneGenerator } = await import('../../src/generators/tone/ToneGenerator.js');
      const gen = new ToneGenerator(llm);
      return gen.generate(prompt);
    }
    default:
      throw new Error(`Unknown domain: ${domain}`);
  }
}

async function main() {
  const [provider, modelName, rawDomain] = process.argv.slice(2);
  const domain = normalizeDomain(rawDomain ?? '');
  
  if (!provider || !modelName || !rawDomain) {
    console.error('Usage: tsx generate-single.ts <provider> <model> <domain>');
    process.exit(1);
  }
  
  const config = MODEL_CONFIGS[modelName];
  if (!config) {
    console.error(`Unknown model: ${modelName}`);
    process.exit(1);
  }
  
  const basePrompt = PROMPTS[domain];
  if (!basePrompt) {
    console.error(`Unknown domain: ${domain}`);
    process.exit(1);
  }
  
  const prompt = `${basePrompt}\n\n[Model: ${modelName}]`;
  const apiKey = process.env[config.apiKeyEnv] || 'dummy-key';
  const outputDir = `examples/generated/${provider}/${sanitizeFilename(modelName)}/${domain}`;
  
  process.env.LIMINAL_LLM_BASE_URL = config.baseUrl;
  process.env.LIMINAL_LLM_API_KEY = apiKey;
  process.env.LIMINAL_LLM_MODEL = modelName;
  if (isLocalBaseUrl(config.baseUrl)) {
    process.env.LIMINAL_ALLOW_LOCALHOST_LLM = 'true';
    process.env.LIMINAL_ALLOW_LOCALHOST = 'true';
  }
  
  try {
    const startTime = Date.now();
    console.error(`Generating ${domain} with ${modelName}...`);
    
    const code = await generateWithLLM(prompt, domain, {
      baseUrl: config.baseUrl,
      apiKey,
      model: modelName,
      modelId: config.modelId
    });
    
    const duration = Date.now() - startTime;
    
    ensureDir(`${outputDir}/2026-03-31--default`);
    writeFileSync(`${outputDir}/2026-03-31--default/v1.js`, code);
    
    const output = {
      provider,
      model: modelName,
      domain,
      success: true,
      duration,
      codeLength: code.length,
      outputDir
    };
    
    console.log(`RESULT: ${JSON.stringify(output)}`);
    process.exit(0);
    
  } catch (error) {
    const output = {
      provider,
      model: modelName,
      domain,
      success: false,
      error: formatError('generate-single', error)
    };
    console.error(`RESULT: ${JSON.stringify(output)}`);
    process.exit(1);
  }
}

main();
