/**
 * Basic Composition Example - P5 + Tone
 * 
 * This example demonstrates:
 * 1. Creating layers from multiple generators
 * 2. Adding them to a composition
 * 3. Exporting standalone HTML
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CompositionEngine,
  p5Adapter,
  toneAdapter,
  P5GeneratorV2,
  ToneGenerator,
} from '../src/index.js';

async function main() {
  // Check LLM configuration
  if (!process.env.LIMINAL_LLM_BASE_URL) {
    console.log('Please set LIMINAL_LLM_BASE_URL to run this example');
    console.log('Example: export LIMINAL_LLM_BASE_URL=http://localhost:1234/v1');
    process.exit(1);
  }

  console.log('🎨 Creating composition with P5 + Tone...\n');

  // Create generators
  const p5Generator = new P5GeneratorV2();
  const toneGenerator = new ToneGenerator();

  // Generate layers
  console.log('Generating P5 layer: "rainbow circles that pulse"...');
  const p5Layer = await p5Generator.generateLayer(
    'Create rainbow colored circles that pulse and move with the mouse. Use p5.js.',
    { bypassCache: true }
  );
  console.log(`✓ P5 layer created: ${p5Layer.id}`);

  console.log('\nGenerating Tone layer: "ambient drone"...');
  const toneLayer = await toneGenerator.generateLayer(
    'Create an ambient drone that changes pitch slowly. Use Tone.js.',
    { bypassCache: true }
  );
  console.log(`✓ Tone layer created: ${toneLayer.id}`);

  // Create composition engine
  const engine = new CompositionEngine({
    settings: {
      width: 800,
      height: 600,
      backgroundColor: '#000000',
    },
  });

  // Register adapters
  engine.registerAdapter('p5', p5Adapter);
  engine.registerAdapter('tone', toneAdapter);

  // Add layers
  engine.addLayer(p5Layer);
  engine.addLayer(toneLayer);

  console.log(`\n✓ Composition created with ${engine.getLayers().length} layers`);

  // Show layer details
  console.log('\nLayer stack:');
  for (const layer of engine.getLayers()) {
    console.log(`  [${layer.config.zIndex}] ${layer.type}: ${layer.metadata.prompt.slice(0, 50)}...`);
  }

  // Export to HTML
  const html = engine.generateHTML();
  
  // Write to file
  const outputDir = process.env.LIMINAL_EXAMPLE_OUTPUT_DIR ?? './output';
  const outputPath = path.join(outputDir, 'composition-example.html');
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  writeFileSync(outputPath, html);
  console.log(`\n✓ Exported to ${outputPath}`);

  // Export project format
  const project = engine.exportProject('Rainbow Drone Composition');
  const projectPath = path.join(outputDir, 'composition-example.json');
  writeFileSync(projectPath, JSON.stringify(project, null, 2));
  console.log(`✓ Project saved to ${projectPath}`);

  console.log('\n🎉 Done! Open the HTML file in a browser to see the composition.');
  console.log('   Note: Click anywhere to start audio (browser autoplay policy)');
}

main().catch(console.error);
