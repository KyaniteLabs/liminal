import { ShaderGenerator } from '../src/generators/glsl/ShaderGenerator.js';

async function main() {
  console.log("Creating generator...");
  const gen = new ShaderGenerator();
  console.log("Generating GLSL...");
  
  const start = Date.now();
  try {
    const code = await gen.generate("Create a GLSL fragment shader with a plasma effect");
    const duration = Date.now() - start;
    console.log(`Done in ${duration}ms! Code length: ${code.length}`);
    console.log("---");
    console.log(code.substring(0, 500));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
