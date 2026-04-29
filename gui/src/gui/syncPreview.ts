const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js';
const THREE_CDN = 'https://unpkg.com/three@0.160.0/build/three.module.js';

function escapeScript(code: string): string {
  return code.replace(/<\/script>/gi, '<\\/script>');
}

function sensorPolicyBootstrap(): string {
  return `
(function liminalSensorPolicy() {
  const nativeAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = function(type, listener, options) {
    const eventName = String(type).toLowerCase();
    if (eventName === 'devicemotion' || eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute') return;
    return nativeAddEventListener(type, listener, options);
  };
  try { Object.defineProperty(window, 'DeviceMotionEvent', { value: undefined, configurable: true }); } catch {}
  try { Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined, configurable: true }); } catch {}
})();
`;
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

function p5CanvasPlacementBootstrap(): string {
  return `
(function liminalP5CanvasPlacement() {
  function fit(canvas) {
    const sourceWidth = Number(canvas.getAttribute('width')) || canvas.width || canvas.clientWidth || window.innerWidth;
    const sourceHeight = Number(canvas.getAttribute('height')) || canvas.height || canvas.clientHeight || window.innerHeight;
    const ratio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 4 / 3;
    const targetWidth = Math.max(1, Math.min(window.innerWidth, 960, window.innerHeight * ratio));
    canvas.style.setProperty('display', 'block', 'important');
    canvas.style.setProperty('width', targetWidth + 'px', 'important');
    canvas.style.setProperty('height', 'auto', 'important');
    canvas.style.setProperty('max-width', '100vw', 'important');
    canvas.style.setProperty('max-height', '100vh', 'important');
    canvas.style.setProperty('object-fit', 'contain', 'important');
  }
  function adoptP5Canvases() {
    const stage = document.querySelector('[data-liminal-sync-preview="p5"]');
    if (!stage) return;
    document.querySelectorAll('body > canvas').forEach((canvas) => stage.appendChild(canvas));
    stage.querySelectorAll('canvas').forEach(fit);
  }
  window.__liminalAdoptP5Canvas = adoptP5Canvases;
  new MutationObserver(adoptP5Canvases).observe(document.body, { childList: true });
  window.addEventListener('resize', adoptP5Canvases);
  queueMicrotask(adoptP5Canvases);
  setTimeout(adoptP5Canvases, 0);
})();
`;
}

function inferStageDomain(code: string): 'p5' | 'three' | 'html' {
  if (/\bTHREE\.|from\s+['"]three['"]|new\s+THREE\./.test(code)) return 'three';
  if (/<!doctype\s+html|<html\b/i.test(code)) return 'html';
  return 'p5';
}

function needsThreeCanvasBinding(code: string): boolean {
  const declaresCanvas = [
    /\b(?:const|let|var)\s+canvas\b/,
    /\b(?:const|let|var)\s*\{[^}]*\bcanvas\s*(?:[,}=])/s,
    /\b(?:const|let|var)\s*\{[^}]*:\s*canvas\s*(?:[,}=])/s,
    /\bimport\s+(?:canvas\b|\{[^}]*\bcanvas\b)/s,
  ].some((pattern) => pattern.test(code));
  return /\bcanvas\b/.test(code) && !declaresCanvas;
}

export function buildSyncPreviewHtml(code: string): string {
  const domain = inferStageDomain(code);
  if (domain === 'html') {
    return code.replace(/<head([^>]*)>/i, `<head$1><script>${audioBootstrap()}</script>`);
  }

  if (domain === 'three') {
    const hasImport = /\bimport\b[\s\S]*?\bfrom\s+['"](?:three|https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/(?:npm\/)?three)/m.test(code);
    const needsCanvas = needsThreeCanvasBinding(code);
    const canvasBootstrap = needsCanvas ? `const canvas = document.getElementById('liminal-three-canvas');\n` : '';
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
  ${needsCanvas ? '<canvas id="liminal-three-canvas"></canvas>' : ''}
  <script type="module">${canvasBootstrap}${moduleCode}</script>
</body>
</html>`;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liminal Sync Stage</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070a}main{position:fixed;inset:0;display:grid;place-items:center}main > canvas,body > canvas{display:block;max-width:100vw;max-height:100vh;object-fit:contain}body > canvas{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important}</style>
  <script>${sensorPolicyBootstrap()}</script>
  <script>${audioBootstrap()}</script>
  <script src="${P5_CDN}"></script>
</head>
<body>
  <main data-liminal-sync-preview="p5"></main>
  <script>${p5CanvasPlacementBootstrap()}</script>
  <script>${escapeScript(code)}</script>
</body>
</html>`;
}
