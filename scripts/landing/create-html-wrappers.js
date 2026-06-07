#!/usr/bin/env node
/**
 * Create HTML wrappers for generated JS files
 */

import fs from 'fs/promises';
import path from 'path';

const ASSETS_DIR = './landing-assets';

// HTML template for p5.js sketches
const p5Template = (jsFile) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sinter Dogfood - p5.js</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #0a0a0f; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script src="${jsFile}"></script>
</body>
</html>`;

// HTML template for Three.js scenes
const threeTemplate = (jsFile) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sinter Dogfood - Three.js</title>
    <script type="importmap">
    {
        "imports": {
            "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js"
        }
    }
    </script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #0a0a0f; }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="module" src="${jsFile}"></script>
</body>
</html>`;

// HTML template for GLSL shaders
const shaderTemplate = (jsFile) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sinter Dogfood - GLSL Shader</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #0a0a0f; }
        canvas { display: block; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="glcanvas"></canvas>
    <script src="${jsFile}"></script>
</body>
</html>`;

// HTML template for Hydra (simplified - just show the code)
const hydraTemplate = (code) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sinter Dogfood - Hydra Visual</title>
    <script src="https://unpkg.com/hydra-synth"></script>
    <style>
        body { margin: 0; padding: 0; overflow: hidden; background: #0a0a0f; }
        canvas { display: block; width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <canvas id="hydra-canvas"></canvas>
    <script>
        const hydra = new Hydra({ canvas: document.getElementById('hydra-canvas') });
        ${code}
    </script>
</body>
</html>`;

async function createWrappers() {
  const files = await fs.readdir(ASSETS_DIR);
  
  // Find all dogfood JS files without HTML equivalents
  const jsFiles = files.filter(f => f.startsWith('dogfood-') && f.endsWith('.js') && !f.endsWith('.html'));
  
  for (const jsFile of jsFiles) {
    const htmlFile = jsFile.replace('.js', '.html');
    const htmlPath = path.join(ASSETS_DIR, htmlFile);
    
    // Check if HTML already exists
    try {
      await fs.access(htmlPath);
      console.log(`✅ ${htmlFile} already exists`);
      continue;
    } catch {
      // HTML doesn't exist, create it
    }
    
    let html;
    const jsPath = path.join(ASSETS_DIR, jsFile);
    
    if (jsFile.includes('p5-')) {
      html = p5Template(jsFile);
    } else if (jsFile.includes('three-')) {
      html = threeTemplate(jsFile);
    } else if (jsFile.includes('shader-')) {
      html = shaderTemplate(jsFile);
    } else if (jsFile.includes('hydra-')) {
      const code = await fs.readFile(jsPath, 'utf-8');
      html = hydraTemplate(code);
    } else {
      // Skip music and other non-visual outputs
      console.log(`⏭️  Skipping ${jsFile} (non-visual)`);
      continue;
    }
    
    await fs.writeFile(htmlPath, html);
    console.log(`✅ Created ${htmlFile}`);
  }
  
  console.log('\n🎉 HTML wrapper creation complete!');
}

createWrappers().catch(console.error);
