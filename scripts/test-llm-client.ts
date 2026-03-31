import { LLMClient } from '../src/llm/LLMClient.js';

async function main() {
  console.log("Creating LLMClient...");
  const client = new LLMClient({
    baseUrl: 'https://api.minimax.io/v1',
    apiKey: process.env.LIMINAL_LLM_API_KEY,
    model: 'MiniMax-M2.7'
  });
  
  console.log("Calling generate with GLSL system prompt...");
  const start = Date.now();
  
  try {
    const result = await client.generate(
      `You are a senior GLSL shader programmer. Generate fragment shaders. Output ONLY raw GLSL code.`,
      "Create a plasma effect shader"
    );
    const duration = Date.now() - start;
    console.log(`✅ Completed in ${duration}ms`);
    console.log("Success:", result.success);
    console.log("Code length:", result.code?.length || 0);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
