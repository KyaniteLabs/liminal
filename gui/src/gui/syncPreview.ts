const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';

function escapeScript(code: string): string {
  return code.replace(/<\/script>/gi, '<\\/script>');
}

function audioBootstrap(): string {
  return `
window.__liminalAudio = window.__liminalAudio || {
  rms: 0,
  energy: 0,
  centroid: 0,
  brightness: 0,
  peak: 0,
  updatedAt: 0
};
window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'liminal-audio-frame') return;
  const frame = data.frame || {};
  window.__liminalAudio = {
    rms: Number(frame.rms) || 0,
    energy: Number(frame.rms) || 0,
    centroid: Number(frame.centroid) || 0,
    brightness: Number(frame.centroid) || 0,
    peak: Number(frame.peak) || Number(frame.rms) || 0,
    updatedAt: performance.now()
  };
});
`;
}

function inferStageDomain(code: string): 'p5' | 'three' | 'html' {
  if (/\bTHREE\.|from\s+['"]three['"]|new\s+THREE\./.test(code)) return 'three';
  if (/<!doctype\s+html|<html\b/i.test(code)) return 'html';
  return 'p5';
}

export function buildSyncPreviewHtml(code: string): string {
  const domain = inferStageDomain(code);
  if (domain === 'html') {
    return code.replace(/<head([^>]*)>/i, `<head$1><script>${audioBootstrap()}</script>`);
  }

  if (domain === 'three') {
    const hasImport = /\bimport\b[\s\S]*?\bfrom\s+['"](?:three|https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/(?:npm\/)?three)/m.test(code);
    const moduleCode = hasImport ? code : `import * as THREE from 'three';\n${code}`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liminal Sync Stage</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}canvas{display:block}</style>
  <script>${audioBootstrap()}</script>
  <script type="importmap">{"imports":{"three":"${THREE_CDN}"}}</script>
</head>
<body>
  <script type="module">${moduleCode}</script>
</body>
</html>`;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liminal Sync Stage</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070a}main{width:100%;height:100%;display:grid;place-items:center}</style>
  <script>${audioBootstrap()}</script>
  <script src="${P5_CDN}"></script>
</head>
<body>
  <main></main>
  <script>${escapeScript(code)}</script>
</body>
</html>`;
}
