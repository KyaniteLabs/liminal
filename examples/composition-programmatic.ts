/**
 * Programmatic Composition Example
 * 
 * Demonstrates the composition API without requiring LLM calls.
 * Creates layers with pre-defined code.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CompositionEngine,
  type LayerManager,
  createLayer,
  createComposition,
  p5Adapter,
  toneAdapter,
  exportProject,
} from '../src/index.js';

// Example p5.js code
const p5Code = `
let t = 0;

function setup() {
  createCanvas(800, 600);
  noFill();
  strokeWeight(2);
}

function draw() {
  background(10, 10, 30, 20);
  
  // Animated circles
  for (let i = 0; i < 5; i++) {
    let x = width/2 + sin(t + i) * 200;
    let y = height/2 + cos(t * 0.5 + i) * 150;
    let size = 50 + sin(t * 2 + i) * 30;
    
    stroke(
      100 + sin(t + i) * 100,
      100 + cos(t + i) * 100,
      200 + sin(t * 0.5) * 55
    );
    
    ellipse(x, y, size, size);
  }
  
  t += 0.02;
}
`;

// Example Tone.js code
const toneCode = `
// Create a synth
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sawtooth" },
  envelope: { attack: 0.5, decay: 0.5, sustain: 0.5, release: 2 }
}).toDestination();

// Add some reverb
const reverb = new Tone.Reverb(3).toDestination();
synth.connect(reverb);

// Create a loop
const notes = ["C3", "E3", "G3", "B3", "C4", "B3", "G3", "E3"];
let noteIndex = 0;

Tone.Transport.scheduleRepeat((time) => {
  const note = notes[noteIndex % notes.length];
  const duration = "4n";
  synth.triggerAttackRelease(note, duration, time);
  noteIndex++;
}, "2n");

Tone.Transport.bpm.value = 60;
`;

function main() {
  console.log('🎨 Programmatic Composition Example\n');

  // Create layers programmatically
  const p5Layer = createLayer('p5', p5Code, 'Animated rainbow circles', {
    generator: 'manual',
    model: 'none',
  }, {
    zIndex: 0,
    opacity: 1.0,
  });

  const toneLayer = createLayer('tone', toneCode, 'Ambient arpeggio', {
    generator: 'manual',
    model: 'none',
  }, {
    zIndex: 1,
    opacity: 1.0,
  });

  console.log('Created layers:');
  console.log(`  - P5 layer: ${p5Layer.id}`);
  console.log(`  - Tone layer: ${toneLayer.id}\n`);

  // Create composition engine
  const engine = new CompositionEngine({
    settings: {
      width: 800,
      height: 600,
      backgroundColor: '#0a0a1e',
    },
  });

  // Register adapters
  engine.registerAdapter('p5', p5Adapter);
  engine.registerAdapter('tone', toneAdapter);

  // Add layers
  engine.addLayer(p5Layer);
  engine.addLayer(toneLayer);

  console.log(`Composition has ${engine.getLayers().length} layers\n`);

  // Demonstrate LayerManager operations
  const layerManager: LayerManager = engine.getLayerManager();
  
  console.log('Layer operations demo:');
  
  // Toggle layer
  layerManager.toggleLayer(toneLayer.id);
  console.log(`  - Toggled Tone layer: enabled = ${layerManager.getLayer(toneLayer.id)?.enabled}`);
  
  // Re-enable it
  layerManager.toggleLayer(toneLayer.id);
  console.log(`  - Re-enabled Tone layer: enabled = ${layerManager.getLayer(toneLayer.id)?.enabled}`);
  
  // Update config
  layerManager.updateLayerConfig(p5Layer.id, { opacity: 0.8 });
  console.log(`  - Updated P5 opacity: ${layerManager.getLayer(p5Layer.id)?.config.opacity}`);
  
  // Duplicate layer
  const duplicated = layerManager.duplicateLayer(p5Layer.id);
  console.log(`  - Duplicated P5 layer: ${duplicated?.id}`);
  console.log(`  - Total layers now: ${layerManager.count}\n`);

  // Generate HTML output
  const html = engine.generateHTML();
  
  // Write to file
  const outputDir = process.env.LIMINAL_EXAMPLE_OUTPUT_DIR ?? './output';
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const htmlPath = path.join(outputDir, 'composition-programmatic.html');
  writeFileSync(htmlPath, html);
  console.log(`✓ HTML exported to ${htmlPath}`);

  // Export project
  const project = engine.exportProject('Programmatic Demo');
  const projectPath = path.join(outputDir, 'composition-programmatic.json');
  writeFileSync(projectPath, JSON.stringify(project, null, 2));
  console.log(`✓ Project saved to ${projectPath}`);

  // Demonstrate createComposition
  const composition = createComposition('Test Composition', {
    width: 1024,
    height: 768,
  });
  console.log(`\n✓ Created empty composition: ${composition.id}`);
  console.log(`  - Size: ${composition.globalSettings.width}x${composition.globalSettings.height}`);
  console.log(`  - Layers: ${composition.layers.length}`);
  console.log(`  - Export version: ${exportProject(composition).version}`);

  console.log('\n🎉 Done! Open the HTML file in a browser to see the composition.');
  console.log('   Note: Click anywhere to start audio (browser autoplay policy)');
}

main();
