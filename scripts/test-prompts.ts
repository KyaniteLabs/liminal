import { PromptLibrary } from '../src/prompts/index.js';

// Test what prompts are being generated
console.log("Testing PromptLibrary.render('glsl.generate')...\n");

try {
  const { system, user } = PromptLibrary.render('glsl.generate', {
    prompt: 'Create a GLSL fragment shader with a plasma effect'
  });
  
  console.log("=== SYSTEM PROMPT ===");
  console.log(system);
  console.log("\n=== USER PROMPT ===");
  console.log(user);
  console.log("\n=== LENGTHS ===");
  console.log("System:", system.length);
  console.log("User:", user.length);
} catch (err) {
  console.error("Error:", err);
}
