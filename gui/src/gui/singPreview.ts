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

// ---------------------------------------------------------------------------
// Default visualization — always present as layer 0
// ---------------------------------------------------------------------------

function defaultVisualizationScript(): string {
  return `
(function(){
  var c=document.getElementById('liminal-layer-0'),ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1;
  function resize(){c.width=window.innerWidth*dpr;c.height=window.innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  resize();window.addEventListener('resize',resize);
  var w,h;
  function dims(){w=window.innerWidth;h=window.innerHeight}
  dims();window.addEventListener('resize',dims);

  var orbs=[];
  for(var i=0;i<10;i++){
    orbs.push({
      x:Math.random(),y:Math.random(),
      vx:(Math.random()-0.5)*0.0006,vy:(Math.random()-0.5)*0.0006,
      baseR:0.06+Math.random()*0.14,
      hueShift:Math.random()*80-40,
      phase:Math.random()*Math.PI*2,
      speed:0.2+Math.random()*0.8
    });
  }

  var ribbons=[];
  for(var i=0;i<6;i++){
    var pts=[];
    for(var j=0;j<100;j++) pts.push({x:0.5,y:0.5});
    ribbons.push({pts:pts,hue:i*45+15,width:1.5+Math.random()*3.5,speed:0.3+Math.random()*0.7,phase:i*1.1});
  }

  var sparks=[];
  var t=0;
  var smoothRms=0,smoothCentroid=0.5,smoothPitch=0.5;

  function draw(){
    requestAnimationFrame(draw);
    var a=window.__liminalAudio||{rms:0,centroid:0.5,pitch:440,onset:false,voiced:false};
    var rms=a.rms||0;var cent=a.centroid||0.5;var pitch=a.pitch||440;var onset=a.onset;var voiced=a.voiced;
    smoothRms+=(rms-smoothRms)*0.12;
    smoothCentroid+=(cent-smoothCentroid)*0.06;
    smoothPitch+=(Math.min(1,Math.max(0,(pitch-80)/800))-smoothPitch)*0.06;
    t+=0.016;

    var baseHue=15+smoothCentroid*50;

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='rgba(3,5,8,0.92)';
    ctx.fillRect(0,0,w,h);

    for(var i=0;i<orbs.length;i++){
      var o=orbs[i];
      o.x+=o.vx+Math.sin(t*o.speed+o.phase)*smoothRms*0.004;
      o.y+=o.vy+Math.cos(t*o.speed*0.7+o.phase)*smoothRms*0.004;
      if(o.x<-0.3)o.x=1.3;if(o.x>1.3)o.x=-0.3;
      if(o.y<-0.3)o.y=1.3;if(o.y>1.3)o.y=-0.3;
      var r=o.baseR*(1+smoothRms*2.5);
      var px=o.x*w,py=o.y*h,pr=Math.max(1,r*w);
      var hue=baseHue+o.hueShift+smoothRms*40;
      var grad=ctx.createRadialGradient(px,py,0,px,py,pr);
      grad.addColorStop(0,'hsla('+hue+',85%,60%,'+(0.08+smoothRms*0.3)+')');
      grad.addColorStop(0.4,'hsla('+(hue+25)+',70%,45%,'+(0.04+smoothRms*0.15)+')');
      grad.addColorStop(1,'hsla('+(hue+50)+',60%,20%,0)');
      ctx.fillStyle=grad;
      ctx.fillRect(px-pr,py-pr,pr*2,pr*2);
    }

    if(voiced||smoothRms>0.015){
      for(var i=0;i<ribbons.length;i++){
        var rb=ribbons[i];
        var head=rb.pts[rb.pts.length-1];
        var nx=head.x+Math.sin(t*rb.speed+rb.phase)*0.006+smoothRms*Math.cos(t*2.2+i)*0.01;
        var ny=head.y+Math.cos(t*rb.speed*0.8+rb.phase)*0.006+smoothRms*Math.sin(t*1.7+i*0.6)*0.008;
        nx=Math.max(0.02,Math.min(0.98,nx));
        ny=Math.max(0.02,Math.min(0.98,ny));
        rb.pts.push({x:nx,y:ny});
        if(rb.pts.length>100)rb.pts.shift();

        ctx.beginPath();
        ctx.strokeStyle='hsla('+(baseHue+rb.hue)+',80%,'+(50+smoothRms*35)+'%,'+(0.1+smoothRms*0.5)+')';
        ctx.lineWidth=rb.width*(1+smoothRms*4);
        ctx.lineCap='round';
        ctx.lineJoin='round';
        for(var j=0;j<rb.pts.length;j++){
          var p=rb.pts[j];
          j===0?ctx.moveTo(p.x*w,p.y*h):ctx.lineTo(p.x*w,p.y*h);
        }
        ctx.stroke();
      }
    }

    if(voiced){
      var cx=w/2,cy=h/2;
      var rings=4;
      for(var r=0;r<rings;r++){
        var baseR=Math.max(1,(50+r*40)*(1+smoothRms*2));
        ctx.beginPath();
        ctx.strokeStyle='hsla('+(baseHue+60+r*20)+',75%,65%,'+(0.12+smoothRms*0.4-r*0.025)+')';
        ctx.lineWidth=Math.max(0.5,(2.5-r*0.4)*(1+smoothRms*2.5));
        var pts=120;
        for(var i=0;i<=pts;i++){
          var angle=(i/pts)*Math.PI*2;
          var warp=Math.sin(angle*smoothPitch*10+t*5+r)*smoothRms*40;
          var warp2=Math.cos(angle*4+t*3+r*0.9)*smoothRms*25;
          var warp3=Math.sin(angle*7+t*2+r*1.5)*smoothRms*15;
          var px=cx+Math.cos(angle)*(baseR+warp+warp2+warp3);
          var py=cy+Math.sin(angle)*(baseR+warp+warp2+warp3);
          i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
        }
        ctx.closePath();ctx.stroke();
      }

      var glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,40+smoothRms*100));
      glow.addColorStop(0,'hsla('+(baseHue+70)+',90%,80%,'+(smoothRms*0.35)+')');
      glow.addColorStop(1,'hsla('+(baseHue+70)+',70%,40%,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(cx-120,cy-120,240,240);
    }

    if(onset){
      for(var i=0;i<16;i++){
        sparks.push({
          x:0.2+Math.random()*0.6,y:0.2+Math.random()*0.6,
          vx:(Math.random()-0.5)*0.025,vy:(Math.random()-0.5)*0.025,
          life:1,hue:baseHue+Math.random()*100,size:1.5+Math.random()*4
        });
      }
    }

    for(var i=sparks.length-1;i>=0;i--){
      var s=sparks[i];
      s.x+=s.vx;s.y+=s.vy;
      s.vx*=0.96;s.vy*=0.96;
      s.life-=0.02;
      if(s.life<=0){sparks.splice(i,1);continue;}
      ctx.beginPath();
      ctx.arc(s.x*w,s.y*h,Math.max(0.5,s.size*s.life),0,Math.PI*2);
      ctx.fillStyle='hsla('+s.hue+',90%,70%,'+(s.life*0.85)+')';
      ctx.fill();
    }

    var shimmerAlpha=0.015+Math.sin(t*0.4)*0.008;
    for(var i=0;i<4;i++){
      var sx=w*(0.25+0.17*i+Math.sin(t*0.25+i)*0.12);
      var sy=h*(0.25+0.17*Math.cos(t*0.2+i*1.8)*0.12);
      var sr=Math.max(1,50+Math.sin(t*0.35+i*0.7)*20);
      var sg=ctx.createRadialGradient(sx,sy,0,sx,sy,sr);
      sg.addColorStop(0,'hsla('+(baseHue+i*35)+',55%,50%,'+shimmerAlpha+')');
      sg.addColorStop(1,'hsla('+(baseHue+i*35)+',35%,30%,0)');
      ctx.fillStyle=sg;
      ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);
    }
  }
  draw();
})();
`;
}

// ---------------------------------------------------------------------------
// Layer manager — composites multiple generated layers additively
// ---------------------------------------------------------------------------

function layerManagerBootstrap(): string {
  return `
(function liminalLayerManager(){
  var MAX_LAYERS = 8;
  var container = document.getElementById('liminal-layers');
  if (!container) return;

  window.__liminalLayers = window.__liminalLayers || {
    _layers: [],
    _idCounter: 0,

    addLayer: function(html, opts) {
      opts = opts || {};
      var blendMode = opts.blendMode || 'screen';
      var opacity = opts.opacity !== undefined ? opts.opacity : 0.7;
      var id = 'sing-layer-' + (++this._idCounter);

      var wrapper = document.createElement('div');
      wrapper.id = id;
      wrapper.className = 'liminal-sing-layer';
      wrapper.style.cssText = 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:' + blendMode + ';opacity:' + opacity + ';transition:opacity 0.6s ease';

      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block';
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('srcdoc', html);
      wrapper.appendChild(iframe);
      container.appendChild(wrapper);

      var entry = { id: id, element: wrapper, iframe: iframe, blendMode: blendMode, opacity: opacity, createdAt: Date.now() };
      this._layers.push(entry);

      while (this._layers.length > MAX_LAYERS) {
        var oldest = this._layers.shift();
        if (oldest && oldest.element.parentNode) oldest.element.parentNode.removeChild(oldest.element);
      }

      for (var i = 0; i < this._layers.length; i++) {
        var age = this._layers.length - 1 - i;
        var layerOpacity = i === this._layers.length - 1 ? opacity : Math.max(0.15, opacity - age * 0.12);
        this._layers[i].element.style.opacity = layerOpacity;
        this._layers[i].opacity = layerOpacity;
      }

      return entry;
    },

    removeLayer: function(layerId) {
      var idx = -1;
      for (var i = 0; i < this._layers.length; i++) {
        if (this._layers[i].id === layerId) { idx = i; break; }
      }
      if (idx === -1) return;
      var entry = this._layers.splice(idx, 1)[0];
      if (entry.element.parentNode) entry.element.parentNode.removeChild(entry.element);
    },

    clearLayers: function() {
      for (var i = 0; i < this._layers.length; i++) {
        var entry = this._layers[i];
        if (entry.element.parentNode) entry.element.parentNode.removeChild(entry.element);
      }
      this._layers = [];
    },

    getLayerCount: function() { return this._layers.length; }
  };
})();
`;
}

// ---------------------------------------------------------------------------
// Build a single generated layer's HTML (with audio bootstrap)
// ---------------------------------------------------------------------------

function buildGeneratedLayerHtml(code: string): string {
  const domain = inferStageDomain(code);

  if (domain === 'html') {
    const injected = code.replace(
      /<head([^>]*)>/i,
      `<head$1><script>${audioBootstrapScript()}</script>`
    );
    return injected;
  }

  if (domain === 'three') {
    const hasImport = /\bimport\b[\s\S]*?\bfrom\s+['"](?:three|https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/(?:npm\/)?three)/m.test(code);
    const needsCanvas = needsThreeCanvasBinding(code);
    const canvasBootstrap = needsCanvas ? `const canvas = document.getElementById('liminal-three-canvas');\n` : '';
    const moduleCode = hasImport ? code : `import * as THREE from 'three';\n${code}`;
    return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{display:block}</style>
<script>${audioBootstrapScript()}</script>
<script type="importmap">{"imports":{"three":"${THREE_CDN}"}}</script>
</head><body>${needsCanvas ? '<canvas id="liminal-three-canvas"></canvas>' : ''}
<script type="module">${canvasBootstrap}${moduleCode}</script>
</body></html>`;
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}main{position:fixed;inset:0;display:grid;place-items:center}main > canvas,body > canvas{display:block;max-width:100vw;max-height:100vh;object-fit:contain}body > canvas{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important}</style>
<script>${sensorPolicyBootstrap()}</script>
<script>${audioBootstrapScript()}</script>
<script src="${P5_CDN}"></script>
</head><body><main data-liminal-sing-preview="p5"></main>
<script>${p5CanvasPlacementBootstrap()}</script>
<script>${escapeScript(code)}</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildDefaultSingPreviewHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liminal Live Audio</title>
  <style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#030508}
    #liminal-layer-0{position:absolute;inset:0;z-index:0}
    #liminal-layers{position:absolute;inset:0;z-index:1}
    canvas{display:block;width:100%;height:100%}
  </style>
  <script>${audioBootstrapScript()}</script>
</head>
<body>
  <canvas id="liminal-layer-0"></canvas>
  <div id="liminal-layers"></div>
  <script>${layerManagerBootstrap()}</script>
  <script>${defaultVisualizationScript()}</script>
</body>
</html>`;
}

export function buildSingPreviewHtml(code: string): string {
  return buildGeneratedLayerHtml(code);
}

export function buildLayeredSingHtml(baseHtml: string, layers: Array<{ code: string; blendMode?: string; opacity?: number }>): string {
  if (layers.length === 0) return baseHtml;

  const layerHtmlChunks = layers.map((layer) => {
    const html = buildGeneratedLayerHtml(layer.code);
    const blend = layer.blendMode || 'screen';
    const opacity = layer.opacity !== undefined ? layer.opacity : 0.7;
    const escaped = html.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    return `window.__liminalLayers.addLayer('${escaped}', {blendMode:'${blend}', opacity:${opacity}});`;
  }).join('\n');

  const injection = `<script>
if (window.__liminalLayers) {
  ${layerHtmlChunks}
}
</script>`;

  if (baseHtml.includes('</body>')) {
    return baseHtml.replace('</body>', injection + '\n</body>');
  }
  return baseHtml + injection;
}

// ---------------------------------------------------------------------------
// Visual mapping — audio features to generator selection and prompt structure
// ---------------------------------------------------------------------------

export interface VoiceVisualProfile {
  power: 'intense' | 'dynamic' | 'gentle';
  brightness: 'bright' | 'balanced' | 'deep';
  rhythm: 'smooth' | 'pulsing' | 'chaotic';
  avgPitch: number;
  noteName: string;
  durationSeconds: number;
  palette: string;
  movement: string;
  recommendedDomain: string;
  blendMode: string;
  layerOpacity: number;
}

export function deriveVoiceVisualProfile(summary: {
  avgRms: number;
  peakRms: number;
  avgCentroid: number;
  durationSeconds: number;
  avgPitch: number;
  onsetCount?: number;
}): VoiceVisualProfile {
  const { peakRms, avgCentroid, avgPitch, durationSeconds, onsetCount } = summary;

  const power = peakRms > 0.22 ? 'intense' : peakRms > 0.09 ? 'dynamic' : 'gentle';
  const brightness = avgCentroid > 0.5 ? 'bright' : avgCentroid > 0.2 ? 'balanced' : 'deep';

  const onsetRate = onsetCount && durationSeconds > 0 ? onsetCount / durationSeconds : 0;
  const rhythm = onsetRate > 3 ? 'chaotic' : onsetRate > 1 ? 'pulsing' : 'smooth';

  const noteName = avgPitch > 0 ? freqToNoteSync(avgPitch) : 'C4';
  const pitchHz = Math.round(avgPitch || 440);

  const palettes: Record<string, string[]> = {
    'intense-bright': ['crimson red, electric gold, white-hot highlights', 'molten copper, solar flare orange, platinum white'],
    'intense-balanced': ['coral, teal, amber — tropical storm', 'fire opal, deep magenta, burnt sienna'],
    'intense-deep': ['obsidian black with emerald green veins and silver sparks', 'deep midnight sapphire with copper wire filaments'],
    'dynamic-bright': ['warm amber, peach, cream — sunrise over water', 'turquoise, goldenrod, soft white — sunlit ocean'],
    'dynamic-balanced': ['terracotta, sage green, warm sand', 'rose gold, slate blue, ivory — modern warmth'],
    'dynamic-deep': ['deep teal, burgundy, brass — luxurious and moody', 'indigo, chestnut, cream — candlelit study'],
    'gentle-bright': ['pastel peach, soft gold, pearl white — morning light', 'champagne, pale rose, warm ivory'],
    'gentle-balanced': ['dusty rose, sage, warm grey — watercolor softness', 'muted coral, seafoam, oat — quiet beach'],
    'gentle-deep': ['charcoal, deep burgundy, muted gold — velvet night', 'forest canopy, loam, soft moss green'],
  };

  const movements: Record<string, string> = {
    'intense': 'explosive bursts, rapid pulsing, dramatic scaling, sharp directional shifts',
    'dynamic': 'flowing ribbons, organic spirals, smooth waves that breathe and undulate',
    'gentle': 'slow drifting, soft breathing, delicate floating particles, meditative calm',
  };

  const domainRouting: Record<string, Record<string, string>> = {
    'intense': { 'bright': 'glsl', 'balanced': 'three', 'deep': 'glsl' },
    'dynamic': { 'bright': 'p5', 'balanced': 'p5', 'deep': 'hydra' },
    'gentle': { 'bright': 'p5', 'balanced': 'hydra', 'deep': 'p5' },
  };

  const blendModes: Record<string, string> = {
    'intense': 'lighten',
    'dynamic': 'screen',
    'gentle': 'soft-light',
  };

  const key = `${power}-${brightness}`;
  const [primary, fallback] = palettes[key] || palettes['dynamic-balanced'];
  const palette = Math.random() > 0.5 ? primary : fallback;

  return {
    power,
    brightness,
    rhythm,
    avgPitch: pitchHz,
    noteName,
    durationSeconds,
    palette,
    movement: movements[power],
    recommendedDomain: domainRouting[power]?.[brightness] || 'p5',
    blendMode: blendModes[power] || 'screen',
    layerOpacity: power === 'intense' ? 0.85 : power === 'dynamic' ? 0.7 : 0.55,
  };
}

function freqToNoteSync(freq: number): string {
  if (freq <= 0 || !Number.isFinite(freq)) return 'C4';
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[(midi % 12 + 12) % 12];
  return `${name}${octave}`;
}

export function profileToPrompt(profile: VoiceVisualProfile): string {
  const domainInstruction = profile.recommendedDomain === 'glsl'
    ? 'Create a GLSL fragment shader that produces stunning generative visuals. Use uniforms: u_time, u_resolution, and read __liminalAudio for voice data via a uniform struct.'
    : profile.recommendedDomain === 'three'
    ? 'Create a Three.js 3D scene with generative geometry and particles. Read window.__liminalAudio in the animation loop.'
    : profile.recommendedDomain === 'hydra'
    ? 'Create a Hydra video synth patch (using osc, noise, shape, solid, etc. chained with .out()). Read window.__liminalAudio for voice-reactive modulation.'
    : 'Create a p5.js generative sketch with setup() and draw(). Read window.__liminalAudio in draw().';

  return [
    domainInstruction,
    `The voice was ${profile.power} and ${profile.brightness}, ${profile.rhythm} rhythm, centered around ${profile.noteName} (${profile.avgPitch} Hz), lasting ${profile.durationSeconds.toFixed(1)} seconds.`,
    `Color palette: ${profile.palette}. DO NOT use generic purple/blue gradients.`,
    `Movement: ${profile.movement}.`,
    `Map window.__liminalAudio.rms to size/speed/intensity. Map .centroid to hue shifts. Map .pitch to spatial patterns. Map .onset to sudden visual events.`,
    `The visualization MUST be beautiful and mesmerizing even when silent, but transform dramatically when voice is active.`,
    `Use a TRANSPARENT background (no solid background fill) so this layer composites cleanly over other layers.`,
    `Full viewport canvas. Smooth 60fps animation.`
  ].join(' ');
}
