import { LLMClient } from './dist/llm/LLMClient.js';
import { P5GeneratorV2 } from './dist/generators/p5/P5GeneratorV2.js';
import { ShaderGenerator } from './dist/generators/glsl/ShaderGenerator.js';
import { ThreeGenerator } from './dist/generators/three/ThreeGenerator.js';
import { StrudelGenerator } from './dist/generators/strudel/StrudelGenerator.js';
import { HydraGenerator } from './dist/generators/hydra/HydraGenerator.js';
import { ToneGenerator } from './dist/generators/tone/ToneGenerator.js';
import { RemotionGenerator } from './dist/generators/remotion/RemotionGenerator.js';
import { HTMLWebGenerator } from './dist/generators/html/HTMLWebGenerator.js';
import { ASCIIArtGenerator } from './dist/generators/ascii/ASCIIArtGenerator.js';
import fs from 'node:fs';

const DOMAINS = [
  { name: 'p5', prompt: 'Create a calming blue particle system', Generator: P5GeneratorV2 },
  { name: 'glsl', prompt: 'Create an abstract plasma shader', Generator: ShaderGenerator },
  { name: 'three', prompt: 'Create a rotating 3D cube', Generator: ThreeGenerator },
  { name: 'strudel', prompt: 'Create a techno beat', Generator: StrudelGenerator },
  { name: 'hydra', prompt: 'Create a kaleidoscope effect', Generator: HydraGenerator },
  { name: 'tone', prompt: 'Create ambient drone', Generator: ToneGenerator },
  { name: 'remotion', prompt: 'Create typing animation', Generator: RemotionGenerator },
  { name: 'html', prompt: 'Create landing page', Generator: HTMLWebGenerator },
  { name: 'ascii', prompt: 'Create mountain ASCII art', Generator: ASCIIArtGenerator },
];

const MODELS = [
  { name: 'minimax-m27', model: 'MiniMax-M2.7' },
  { name: 'minimax-m25', model: 'MiniMax-M2.5' },
];

async function main() {
  console.log('☁️ MiniMax Cloud Testing');
  let successCount = 0;
  let failCount = 0;

  for (const domain of DOMAINS) {
    for (const model of MODELS) {
      const testId = 'minimax-' + domain.name + '-' + model.name;
      try {
        const llm = new LLMClient({
          role: 'generator',
          baseUrl: 'https://api.minimaxi.chat/v1',
          model: model.model,
          temperature: 0.7,
          maxTokens: 4096,
        });
        const generator = new domain.Generator(llm);
        const code = await generator.generate(domain.prompt);
        fs.writeFileSync('landing-live/' + testId + '.html', code);
        console.log('✅ ' + testId);
        successCount++;
      } catch (e: any) {
        console.log('❌ ' + testId + ': ' + e.message);
        failCount++;
      }
    }
  }
  console.log('MiniMax Complete');
  console.log(`Results: ${successCount} passed, ${failCount} failed, ${successCount + failCount} total`);
}

main();
