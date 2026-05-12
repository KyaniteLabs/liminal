import { audioBootstrapScript } from './audioBootstrap.js';

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
    const stage = document.querySelector('[data-liminal-sing-preview="p5"]');
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

export function buildDefaultSingPreviewHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liminal Live Audio</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070a}canvas{display:block;position:fixed;inset:0}</style>
  <script>${audioBootstrapScript()}</script>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var c=document.getElementById('c'),ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1;
  function resize(){c.width=window.innerWidth*dpr;c.height=window.innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  resize();window.addEventListener('resize',resize);
  var particles=[];
  for(var i=0;i<120;i++){particles.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,vx:(Math.random()-0.5)*0.3,vy:(Math.random()-0.5)*0.3,r:Math.random()*2+0.5,phase:Math.random()*Math.PI*2})}
  var t=0;
  function draw(){
    requestAnimationFrame(draw);
    var w=window.innerWidth,h=window.innerHeight,a=window.__liminalAudio||{rms:0,centroid:0.5,pitch:440,onset:false,voiced:false};
    t+=0.016;
    ctx.fillStyle='rgba(5,7,10,0.15)';
    ctx.fillRect(0,0,w,h);
    var energy=a.rms||0,bright=a.centroid||0.5,pitch=a.pitch||440;
    var hue=200+bright*120;
    for(var i=0;i<particles.length;i++){
      var p=particles[i];
      var boost=energy*4;
      p.x+=p.vx+Math.sin(t+p.phase)*boost*0.5;
      p.y+=p.vy+Math.cos(t*0.7+p.phase)*boost*0.5;
      if(p.x<0)p.x=w;if(p.x>w)p.x=0;if(p.y<0)p.y=h;if(p.y>h)p.y=0;
      var size=p.r*(1+energy*3);
      var alpha=0.3+energy*0.7;
      ctx.beginPath();
      ctx.arc(p.x,p.y,size,0,Math.PI*2);
      ctx.fillStyle='hsla('+hue+',80%,'+(55+energy*30)+'%,'+alpha+')';
      ctx.fill();
    }
    if(a.voiced){
      ctx.beginPath();
      ctx.strokeStyle='hsla('+(hue+40)+',70%,60%,'+(0.1+energy*0.3)+')';
      ctx.lineWidth=1+energy*4;
      var cx=w/2,cy=h/2,radius=Math.max(1,50+energy*200);
      for(var i=0;i<=64;i++){
        var angle=(i/64)*Math.PI*2;
        var offset=Math.sin(angle*pitch/100+t*3)*energy*40;
        var px=cx+Math.cos(angle)*(radius+offset);
        var py=cy+Math.sin(angle)*(radius+offset);
        i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
      }
      ctx.closePath();ctx.stroke();
    }
    if(energy>0.01){
      ctx.beginPath();
      ctx.arc(w/2,h/2,Math.max(1,20+energy*60),0,Math.PI*2);
      ctx.fillStyle='hsla('+hue+',90%,70%,'+(energy*0.25)+')';
      ctx.fill();
    }
  }
  draw();
})();
</script>
</body>
</html>`;
}

export function buildSingPreviewHtml(code: string): string {
  const domain = inferStageDomain(code);
  if (domain === 'html') {
    return code.replace(/<head([^>]*)>/i, `<head$1><script>${audioBootstrapScript()}</script>`);
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
  <title>Liminal Sing Stage</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}canvas{display:block}</style>
  <script>${audioBootstrapScript()}</script>
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
  <title>Liminal Sing Stage</title>
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070a}main{position:fixed;inset:0;display:grid;place-items:center}main > canvas,body > canvas{display:block;max-width:100vw;max-height:100vh;object-fit:contain}body > canvas{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important}</style>
  <script>${sensorPolicyBootstrap()}</script>
  <script>${audioBootstrapScript()}</script>
  <script src="${P5_CDN}"></script>
</head>
<body>
  <main data-liminal-sing-preview="p5"></main>
  <script>${p5CanvasPlacementBootstrap()}</script>
  <script>${escapeScript(code)}</script>
</body>
</html>`;
}
