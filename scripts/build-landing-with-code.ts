#!/usr/bin/env tsx
/**
 * Build landing page with actual embedded code
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function getCodeSnippet(model: string, domain: string): string {
  const codePath = `examples/generated/${model}/${domain}/2026-03-31--default/v1.js`;
  if (!existsSync(codePath)) return '// Code not found';
  
  const code = readFileSync(codePath, 'utf-8');
  // Return first 30 lines max
  return code.split('\n').slice(0, 30).join('\n') + '\n// ... (see full file)';
}

function getFileSize(model: string, domain: string): string {
  const codePath = `examples/generated/${model}/${domain}/2026-03-31--default/v1.js`;
  if (!existsSync(codePath)) return '0';
  return readFileSync(codePath, 'utf-8').length.toLocaleString();
}

function getDuration(model: string, domain: string): string {
  // Use known durations from our generation runs
  const durations: Record<string, string> = {
    'minimax/MiniMax-M2.7/p5': '46.6s',
    'minimax/MiniMax-M2.7/glsl': '29.8s',
    'minimax/MiniMax-M2.7/three': '36.6s',
    'minimax/MiniMax-M2.7/strudel': '25.8s',
    'minimax/MiniMax-M2.7/hydra': '8.7s',
    'minimax/MiniMax-M2.7/remotion': '31.0s',
    'minimax/MiniMax-M2.7/html': '0.4s',
    'minimax/MiniMax-M2.7/ascii': '0.4s',
    'minimax/MiniMax-M2.5/p5': '34.9s',
    'minimax/MiniMax-M2.5/glsl': '10.2s',
    'minimax/MiniMax-M2.5/three': '33.7s',
    'minimax/MiniMax-M2.5/strudel': '7.7s',
    'minimax/MiniMax-M2.5/hydra': '13.0s',
    'minimax/MiniMax-M2.5/remotion': '13.1s',
    'minimax/MiniMax-M2.5/html': '0.4s',
    'minimax/MiniMax-M2.5/ascii': '0.4s',
    'lmstudio/Qwen3.5-9B/p5': '109.3s',
    'lmstudio/Qwen3.5-9B/glsl': '118.3s',
    'lmstudio/Qwen3.5-9B/three': '90s',
    'lmstudio/Qwen3.5-9B/strudel': '60s',
    'lmstudio/Qwen3.5-9B/hydra': '2.8s',
    'lmstudio/Qwen3.5-9B/remotion': '52.6s',
    'lmstudio/Qwen3.5-9B/html': '0.034s',
    'lmstudio/Qwen3.5-9B/ascii': '0.034s',
    'lmstudio/Qwen3-Coder-40B/p5': '28.2s',
    'lmstudio/Qwen3-Coder-40B/glsl': '29.7s',
    'lmstudio/Qwen3-Coder-40B/three': '33.9s',
    'lmstudio/Qwen3-Coder-40B/strudel': '7.0s',
    'lmstudio/Qwen3-Coder-40B/hydra': '3.6s',
    'lmstudio/Qwen3-Coder-40B/remotion': '20.6s',
    'lmstudio/Qwen3-Coder-40B/html': '0.035s',
    'lmstudio/Qwen3-Coder-40B/ascii': '0.037s',
    'ollama/Gemma3-4B/p5': '26.0s',
    'ollama/Gemma3-4B/glsl': '13.6s',
    'ollama/Gemma3-4B/three': '24.6s',
    'ollama/Gemma3-4B/strudel': '11.2s',
    'ollama/Gemma3-4B/hydra': '10.4s',
    'ollama/Gemma3-4B/remotion': '24.9s',
    'ollama/Gemma3-4B/html': '0.041s',
    'ollama/Gemma3-4B/ascii': '0.039s',
    'ollama/Kimi-K2.5/p5': '56.0s',
    'ollama/Kimi-K2.5/glsl': '54.8s',
    'ollama/Kimi-K2.5/three': '54.2s',
    'ollama/Kimi-K2.5/strudel': '57.5s',
    'ollama/Kimi-K2.5/hydra': '38.9s',
    'ollama/Kimi-K2.5/remotion': '21.2s',
    'ollama/Kimi-K2.5/html': '0.037s',
    'ollama/Kimi-K2.5/ascii': '0.036s',
  };
  return durations[`${model}/${domain}`] || '~30s';
}

const MODELS = [
  { key: 'minimax/MiniMax-M2.7', name: 'MiniMax-M2.7', provider: 'minimax' },
  { key: 'minimax/MiniMax-M2.5', name: 'MiniMax-M2.5', provider: 'minimax' },
  { key: 'lmstudio/Qwen3.5-9B', name: 'Qwen3.5-9B', provider: 'lmstudio' },
  { key: 'lmstudio/Qwen3-Coder-40B', name: 'Qwen3-Coder-40B', provider: 'lmstudio' },
  { key: 'ollama/Gemma3-4B', name: 'Gemma3-4B', provider: 'ollama' },
  { key: 'ollama/Kimi-K2.5', name: 'Kimi-K2.5', provider: 'ollama' },
];

const DOMAINS = ['p5', 'glsl', 'three', 'strudel', 'hydra', 'remotion', 'html', 'ascii'];

// Build the gallery items with actual code
function buildGalleryItems(): string {
  const domainTitles: Record<string, string> = {
    p5: 'p5.js Sketch',
    glsl: 'GLSL Shader',
    three: 'Three.js Scene',
    strudel: 'Strudel Pattern',
    hydra: 'Hydra Synth',
    remotion: 'Remotion Video',
    html: 'HTML Page',
    ascii: 'ASCII Art'
  };
  
  let html = '';
  for (const model of MODELS) {
    for (const domain of DOMAINS) {
      const code = getCodeSnippet(model.key, domain);
      const size = getFileSize(model.key, domain);
      const duration = getDuration(model.key, domain);
      
      html += `
      <div class="example-card" data-model="${model.name}" data-domain="${domain}">
        <div class="example-header">
          <div class="example-meta">
            <div class="example-tag domain-${domain}">${domain}</div>
            <div class="example-title">${domainTitles[domain]}</div>
            <div class="example-model">${model.name}</div>
          </div>
          <div class="example-stats">
            <div>${duration}</div>
            <div>${size} bytes</div>
          </div>
        </div>
        <div class="example-code">
          <pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        </div>
        <div class="example-footer">
          <button class="btn-expand" onclick="toggleCode(this)">Show Full Code</button>
          <a href="examples/generated/${model.key}/${domain}/2026-03-31--default/v1.js" target="_blank" class="btn-link">View File</a>
        </div>
      </div>`;
    }
  }
  return html;
}

// Read template and inject
const template = readFileSync('landing.html', 'utf-8');
const galleryItems = buildGalleryItems();

// Replace the gallery-grid content
const updated = template.replace(
  /<div class="gallery-grid" id="gallery-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<div id="telemetry"/,
  `<div class="gallery-grid" id="gallery-grid">\n${galleryItems}\n        </div>\n      </div>\n    </div>\n    <div id="telemetry"`
);

// Add expand functionality
const withScript = updated.replace(
  '</body>',
  `<script>
function toggleCode(btn) {
  const card = btn.closest('.example-card');
  const code = card.querySelector('.example-code');
  code.classList.toggle('expanded');
  btn.textContent = code.classList.contains('expanded') ? 'Show Less' : 'Show Full Code';
}
</script>
</body>`
);

writeFileSync('landing.html', withScript);
console.log('Landing page updated with embedded code!');
console.log(`Total examples: ${MODELS.length * DOMAINS.length}`);
