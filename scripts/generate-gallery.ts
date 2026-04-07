#!/usr/bin/env node
/**
 * Generate Landing Gallery from Dogfood Results
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface GalleryItem {
  domain: string;
  model: string;
  provider: string;
  path: string;
  success: boolean;
}

function parseFilename(filename: string): GalleryItem | null {
  // Skip index.html
  if (filename === 'index.html') return null;

  // Helper: parse provider-domain-model from filename
  const noExt = filename.replace(/\.html$/, '');

  // Pattern 0: compound prefixes like cloud-minimax-*, local-lmstudio-*, local-ollama-*
  const compoundMatch = noExt.match(/^(cloud-minimax|local-lmstudio|local-ollama)-(.+)-(.+)$/);
  if (compoundMatch) {
    const [, compound, domain, model] = compoundMatch;
    const provider = compound.split('-')[1]; // minimax, lmstudio, ollama
    return { domain, model, provider, path: filename, success: true };
  }

  // Pattern 1: provider-domain-model.html
  let match = noExt.match(/^(cloud|lmstudio|ollama|minimax|glm)-(.+)-(.+)$/);
  if (match) {
    const [, provider, domain, model] = match;
    return { domain, model, provider, path: filename, success: true };
  }

  // Pattern 2: domain-model.html (legacy)
  match = noExt.match(/^([a-z][\w:]+)-(.+)$/);
  if (match) {
    const [, domain, model] = match;
    // Guess provider from model name
    let provider = 'unknown';
    if (model.includes('lmstudio') || model.startsWith('google-')) provider = 'lmstudio';
    else if (model.includes('ollama')) provider = 'ollama';
    else if (['gemma', 'qwen', 'phi4', 'granite', 'lfm2.5', 'deepseek', 'kimi', 'gemini'].some(m => model.toLowerCase().includes(m))) {
      provider = 'ollama';
    }
    return { domain, model, provider, path: filename, success: true };
  }
  
  return null;
}

function generateGallery() {
  const landingDir = path.join(PROJECT_ROOT, 'landing-live');
  const files = fs.readdirSync(landingDir).filter(f => f.endsWith('.html') && f !== 'index.html');
  
  const items = files.map(parseFilename).filter((i): i is GalleryItem => i !== null);
  
  // Group by domain
  const byDomain: Record<string, GalleryItem[]> = {};
  for (const item of items) {
    if (!byDomain[item.domain]) byDomain[item.domain] = [];
    byDomain[item.domain].push(item);
  }

  // Generate gallery-data.js
  const galleryData = {
    timestamp: new Date().toISOString(),
    total: items.length,
    byDomain,
    items,
  };
  
  fs.writeFileSync(
    path.join(landingDir, 'gallery-data.js'),
    `window.GALLERY_DATA = ${JSON.stringify(galleryData, null, 2)};`
  );

  // Generate index.html
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liminal Dogfood Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
    }
    header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 40px 20px;
      text-align: center;
      border-bottom: 1px solid #333;
    }
    h1 {
      font-size: 3em;
      background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .subtitle { color: #888; font-size: 1.2em; }
    .stats {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .stat {
      background: rgba(255,255,255,0.05);
      padding: 15px 30px;
      border-radius: 10px;
      border: 1px solid #333;
    }
    .stat-value { font-size: 2em; font-weight: bold; color: #4ade80; }
    .stat-label { color: #888; font-size: 0.9em; }
    main { max-width: 1400px; margin: 0 auto; padding: 40px 20px; }
    .domain-section { margin-bottom: 50px; }
    .domain-title {
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #333;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border-color: #4ecdc4;
    }
    .card-header {
      background: #252525;
      padding: 15px;
      border-bottom: 1px solid #333;
    }
    .card-provider {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .provider-cloud { background: #3b82f6; color: white; }
    .provider-lmstudio { background: #8b5cf6; color: white; }
    .provider-ollama { background: #f59e0b; color: black; }
    .card-model { font-size: 1.1em; font-weight: 600; }
    .card-preview {
      height: 250px;
      background: #0f0f0f;
      overflow: hidden;
    }
    .card-preview iframe {
      width: 100%;
      height: 100%;
      border: none;
      pointer-events: none;
      transform: scale(1);
    }
    .card-footer {
      padding: 15px;
      display: flex;
      gap: 10px;
    }
    .btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: #333;
      color: white;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      font-size: 0.9em;
      transition: background 0.2s;
    }
    .btn:hover { background: #4ecdc4; color: black; }
    .filters {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 8px 20px;
      border: 1px solid #444;
      background: #1a1a1a;
      color: #888;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: #4ecdc4;
      color: black;
      border-color: #4ecdc4;
    }
    footer {
      text-align: center;
      padding: 40px;
      color: #555;
      border-top: 1px solid #222;
    }
  </style>
</head>
<body>
  <header>
    <h1>🔥 Liminal Dogfood Gallery</h1>
    <p class="subtitle">Multi-Provider Model Testing Results</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${items.length}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat">
        <div class="stat-value">${Object.keys(byDomain).length}</div>
        <div class="stat-label">Domains</div>
      </div>
      <div class="stat">
        <div class="stat-value">${new Set(items.map(i => i.model)).size}</div>
        <div class="stat-label">Models</div>
      </div>
    </div>
  </header>

  <main>
    <div class="filters">
      <button class="filter-btn active" onclick="filterAll()">All</button>
      <button class="filter-btn" onclick="filterProvider('cloud')">☁️ Cloud</button>
      <button class="filter-btn" onclick="filterProvider('lmstudio')">🖥️ LM Studio</button>
      <button class="filter-btn" onclick="filterProvider('ollama')">🦙 Ollama</button>
    </div>

    ${Object.entries(byDomain).map(([domain, domainItems]) => `
    <section class="domain-section" data-domain="${domain}">
      <h2 class="domain-title">${domain.toUpperCase()}</h2>
      <div class="grid">
        ${domainItems.map(item => `
        <div class="card" data-provider="${item.provider}">
          <div class="card-header">
            <span class="card-provider provider-${item.provider}">${item.provider}</span>
            <div class="card-model">${item.model}</div>
          </div>
          <div class="card-preview">
            <iframe src="${item.path}" loading="lazy" sandbox="allow-scripts"></iframe>
          </div>
          <div class="card-footer">
            <a href="${item.path}" class="btn" target="_blank">View Code</a>
          </div>
        </div>
        `).join('')}
      </div>
    </section>
    `).join('')}
  </main>

  <footer>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Liminal Dogfood Testing System</p>
  </footer>

  <script>
    function filterAll() {
      document.querySelectorAll('.domain-section').forEach(s => s.style.display = 'block');
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }
    
    function filterProvider(provider) {
      document.querySelectorAll('.card').forEach(c => {
        c.style.display = c.dataset.provider === provider ? 'block' : 'none';
      });
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(landingDir, 'index.html'), html);
  
  console.log('✅ Gallery generated!');
  console.log(`  - ${items.length} items`);
  console.log(`  - ${Object.keys(byDomain).length} domains`);
  console.log(`  - landing-live/index.html`);
  console.log(`  - landing-live/gallery-data.js`);
}

generateGallery();
