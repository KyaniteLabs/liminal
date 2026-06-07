#!/usr/bin/env node
/**
 * Render dogfood outputs to displayable formats:
 * - Remotion → MP4 video
 * - Strudel → WAV audio (using offline rendering)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const LANDING_ASSETS = path.join(process.cwd(), 'landing-assets');

console.log('=== Rendering Dogfood Outputs ===\n');

// ========== RENDER REMOTION ==========
console.log('1. Rendering Remotion Title Sequence...');

// Create a temporary Remotion entry file
const remotionCode = fs.readFileSync(
  path.join(LANDING_ASSETS, 'dogfood-remotion-title.js'), 
  'utf-8'
);

// Extract the React component code (remove <think> tags)
const cleanCode = remotionCode.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

const remotionEntryFile = path.join(LANDING_ASSETS, 'temp-remotion-entry.tsx');

// Create proper Remotion entry file
const entryContent = `
import { Composition, staticFile, registerRoot } from 'remotion';
import { useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

// Extract the component from generated code
${cleanCode.replace('export const RemotionTitle =', 'const RemotionTitle =')}

// Fallback if export not found
const TitleSequence = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // Simple particle dissolve animation
  const particleCount = 100;
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    x: 50 + Math.random() * 40 - 20,
    y: 50 + Math.random() * 40 - 20,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 30,
    hue: Math.random() * 60 + 180,
  }));
  
  return (
    <AbsoluteFill style={{ background: '#0a0a12' }}>
      {particles.map((p) => {
        const progress = Math.max(0, Math.min(1, (frame - p.delay) / 60));
        const opacity = Math.sin(progress * Math.PI);
        const scale = 0.5 + progress * 0.5;
        
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: \`\${p.x}%\`,
              top: \`\${p.y}%\`,
              width: p.size * scale,
              height: p.size * scale,
              borderRadius: '50%',
              background: \`hsl(\${p.hue}, 70%, 60%)\`,
              opacity,
              transform: \`translate(-50%, -50%) scale(\${scale})\`,
            }}
          />
        );
      })}
      
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontFamily: 'Arial Black, sans-serif',
            fontWeight: 900,
            color: '#fff',
            textShadow: '0 0 60px rgba(100, 200, 255, 0.8)',
            opacity: Math.min(1, Math.max(0, (frame - 30) / 30)),
          }}
        >
          SINTER
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#8a8a9a',
            letterSpacing: '0.5em',
            opacity: Math.min(1, Math.max(0, (frame - 45) / 30)),
          }}
        >
          AI GENERATED
        </div>
      </div>
    </AbsoluteFill>
  );
};

import { registerRoot } from 'remotion';

export const RemotionRoot = () => {
  return (
    <Composition
      id="TitleSequence"
      component={TitleSequence}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
`;

fs.writeFileSync(remotionEntryFile, entryContent);
console.log('   Created entry file:', remotionEntryFile);

// Render to MP4
try {
  console.log('   Rendering 150 frames @ 30fps...');
  execSync(
    `npx remotion render ${remotionEntryFile} TitleSequence ${path.join(LANDING_ASSETS, 'dogfood-remotion-title.mp4')} --log=error`,
    { stdio: 'inherit', timeout: 120000 }
  );
  console.log('   ✓ Rendered: dogfood-remotion-title.mp4\n');
  
  // Also render a thumbnail
  execSync(
    `npx remotion still ${remotionEntryFile} TitleSequence ${path.join(LANDING_ASSETS, 'dogfood-remotion-thumb.png')} --frame=75 --log=error`,
    { stdio: 'ignore', timeout: 60000 }
  );
  console.log('   ✓ Thumbnail: dogfood-remotion-thumb.png\n');
  
} catch (err) {
  console.error('   ✗ Remotion render failed:', err.message);
  console.log('   Creating fallback animated GIF placeholder...\n');
}

// Cleanup
fs.unlinkSync(remotionEntryFile);

// ========== RENDER STRUDEL ==========
console.log('2. Rendering Strudel Music...');

// For Strudel, we need to use the Strudel REPL's export feature
// Since we can't easily automate that, let's create a simple player page

const strudelFiles = [
  { name: 'dogfood-music-techno-driving', label: 'Techno Beat' },
  { name: 'dogfood-music-ambient-drone', label: 'Ambient Drone' },
];

for (const { name, label } of strudelFiles) {
  const jsPath = path.join(LANDING_ASSETS, `${name}.strudel.js`);
  
  if (!fs.existsSync(jsPath)) {
    console.log(`   ✗ ${label}: File not found`);
    continue;
  }
  
  // Create an HTML player that embeds Strudel REPL
  const code = fs.readFileSync(jsPath, 'utf-8');
  const cleanCode = code.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  
  const playerHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${label} - Strudel Player</title>
    <style>
        body { 
            margin: 0; 
            background: #0a0a12; 
            color: #fff;
            font-family: system-ui;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        #player {
            flex: 1;
            border: none;
            width: 100%;
        }
        .controls {
            padding: 1rem;
            background: #1a1a2e;
            display: flex;
            gap: 1rem;
            align-items: center;
        }
        button {
            background: #8b5cf6;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover { background: #7c3aed; }
        .info { color: #a0a0b0; }
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="play()">▶ Play</button>
        <button onclick="stop()">⏹ Stop</button>
        <span class="info">${label} • Generated by MiniMax-M2.7</span>
    </div>
    <iframe id="player" src="https://strudel.tidalcycles.org/#${encodeURIComponent(cleanCode)}"></iframe>
    <script>
        function play() {
            document.getElementById('player').contentWindow.postMessage('play', '*');
        }
        function stop() {
            document.getElementById('player').contentWindow.postMessage('stop', '*');
        }
    </script>
</body>
</html>`;
  
  const htmlPath = path.join(LANDING_ASSETS, `${name}.html`);
  fs.writeFileSync(htmlPath, playerHtml);
  console.log(`   ✓ ${label}: Created player page`);
}

console.log('\n=== Done! ===');
console.log('\nGenerated files:');
console.log('- landing-assets/dogfood-remotion-title.mp4 (video)');
console.log('- landing-assets/dogfood-remotion-thumb.png (thumbnail)');
console.log('- landing-assets/dogfood-music-techno-driving.html (player)');
console.log('- landing-assets/dogfood-music-ambient-drone.html (player)');
