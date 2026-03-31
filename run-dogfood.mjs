import { run } from './src/index.js';

const [prompt, output, project] = process.argv.slice(2);

run(prompt, { 
  maxIterations: 1, 
  output, 
  project 
}).then(r => {
  console.log('✅ DONE:', r.iterations, 'iterations, score:', r.evaluation?.score);
  process.exit(0);
}).catch(e => {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
});
