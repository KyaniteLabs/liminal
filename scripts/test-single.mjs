import { run } from '../src/index.js';
import fs from 'fs';
import path from 'path';

const [domain, model, tag, prompt] = process.argv.slice(2);
if (!domain || !model || !tag || !prompt) {
  console.error('Usage: node test-single.mjs <domain> <model> <tag> <prompt>');
  process.exit(1);
}

process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:11434/v1';
process.env.LIMINAL_LLM_MODEL = model;

const outputDir = `./landing-live/${domain}-${tag}.html`;
const start = Date.now();
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

console.log(`\n[TEST] ${domain} × ${tag}`);
console.log(`Model: ${model}`);

let result, error, duration;

try {
  result = await run(prompt, {
    maxIterations: 1,
    output: outputDir,
    project: `dogfood-${domain}-${tag}`
  });
  
  duration = Date.now() - start;
  const score = result?.evaluation?.score || 0;
  
  // Find the actual HTML file inside the directory
  let size = 0;
  let htmlFile = null;
  try {
    const files = fs.readdirSync(outputDir);
    htmlFile = files.find(f => f.endsWith('-final.html'));
    if (htmlFile) {
      size = fs.statSync(path.join(outputDir, htmlFile)).size;
    }
  } catch {}
  
  console.log(`✅ SUCCESS | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b`);
  
  // Append to telemetry log
  fs.appendFileSync('./dogfood-telemetry.log', 
    `[${timestamp}] Domain: ${domain} | Model: ${tag} | Status: ✅ | Duration: ${duration}ms | Score: ${score.toFixed(2)} | Size: ${size}b\n`);
  
} catch(e) {
  duration = Date.now() - start;
  error = e.message;
  console.log(`❌ FAILED | Duration: ${duration}ms | Error: ${error}`);
  
  fs.appendFileSync('./dogfood-telemetry.log', 
    `[${timestamp}] Domain: ${domain} | Model: ${tag} | Status: ❌ | Duration: ${duration}ms | Error: ${error}\n`);
}
