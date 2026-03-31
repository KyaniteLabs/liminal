import { run } from './src/index.ts';
import { promises as fs } from 'fs';

async function main() {
  console.log('Generating fireworks example...');
  const result = await run('Create a p5.js particle fireworks simulation', { maxIterations: 2 });
  await fs.writeFile('examples/generated-fireworks.js', result.code);
  console.log(`Done: ${result.code.length} chars`);
}

main();
