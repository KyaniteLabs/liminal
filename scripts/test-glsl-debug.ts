import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';
import { LLMClient } from '../src/llm/LLMClient.js';
import { PromptLibrary } from '../src/prompts/index.js';

async function main() {
  console.log("1. Testing PromptLibrary...");
  const { system, user } = PromptLibrary.render('glsl.generate', {
    prompt: "Create a GLSL fragment shader with a plasma effect"
  });
  console.log("2. Prompts rendered successfully");
  console.log("System length:", system.length);
  console.log("User length:", user.length);
  
  console.log("\n3. Creating LLMClient...");
  const llm = new LLMClient();
  
  console.log("4. Calling LLM...");
  const start = Date.now();
  try {
    const response = await llm.generate(system, user);
    const duration = Date.now() - start;
    console.log(`5. LLM responded in ${duration}ms`);
    console.log("Code length:", response.code?.length || 0);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
