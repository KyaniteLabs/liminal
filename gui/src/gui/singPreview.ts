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
  <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#030508}canvas{display:block;position:fixed;inset:0}</style>
  <script>${audioBootstrapScript()}</script>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var c=document.getElementById('c'),ctx=c.getContext('2d'),dpr=window.devicePixelRatio||1;
  function resize(){c.width=window.innerWidth*dpr;c.height=window.innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  resize();window.addEventListener('resize',resize);
  var w,h;
  function dims(){w=window.innerWidth;h=window.innerHeight}
  dims();window.addEventListener('resize',dims);

  var orbs=[];
  for(var i=0;i<8;i++){
    orbs.push({
      x:Math.random(),y:Math.random(),
      vx:(Math.random()-0.5)*0.0008,vy:(Math.random()-0.5)*0.0008,
      baseR:0.08+Math.random()*0.12,
      hueShift:Math.random()*60-30,
      phase:Math.random()*Math.PI*2,
      speed:0.3+Math.random()*0.7
    });
  }

  var ribbons=[];
  for(var i=0;i<5;i++){
    var pts=[];
    for(var j=0;j<80;j++) pts.push({x:0.5,y:0.5});
    ribbons.push({pts:pts,hue:i*50+20,width:2+Math.random()*3,speed:0.4+Math.random()*0.6,phase:i*1.2});
  }

  var sparks=[];
  var t=0;
  var smoothRms=0,smoothCentroid=0.5,smoothPitch=0.5;

  function spawnSpark(x,y,hue){
    for(var i=0;i<3;i++){
      sparks.push({x:x,y:y,vx:(Math.random()-0.5)*0.01,vy:(Math.random()-0.5)*0.01,life:1,hue:hue,size:1+Math.random()*2});
    }
  }

  function draw(){
    requestAnimationFrame(draw);
    var a=window.__liminalAudio||{rms:0,centroid:0.5,pitch:440,onset:false,voiced:false};
    var rms=a.rms||0;var cent=a.centroid||0.5;var pitch=a.pitch||440;var onset=a.onset;var voiced=a.voiced;
    smoothRms+=(rms-smoothRms)*0.15;
    smoothCentroid+=(cent-smoothCentroid)*0.08;
    smoothPitch+=(Math.min(1,Math.max(0,(pitch-80)/800))-smoothPitch)*0.08;
    t+=0.016;

    var baseHue=15+smoothCentroid*40;

    ctx.fillStyle='rgba(3,5,8,0.08)';
    ctx.fillRect(0,0,w,h);

    // Ambient orbs — large glowing shapes
    for(var i=0;i<orbs.length;i++){
      var o=orbs[i];
      o.x+=o.vx+Math.sin(t*o.speed+o.phase)*smoothRms*0.003;
      o.y+=o.vy+Math.cos(t*o.speed*0.7+o.phase)*smoothRms*0.003;
      if(o.x<-0.2)o.x=1.2;if(o.x>1.2)o.x=-0.2;
      if(o.y<-0.2)o.y=1.2;if(o.y>1.2)o.y=-0.2;
      var r=o.baseR*(1+smoothRms*2);
      var px=o.x*w,py=o.y*h,pr=Math.max(1,r*w);
      var hue=baseHue+o.hueShift+smoothRms*30;
      var grad=ctx.createRadialGradient(px,py,0,px,py,pr);
      grad.addColorStop(0,'hsla('+hue+',85%,60%,'+(0.12+smoothRms*0.25)+')');
      grad.addColorStop(0.5,'hsla('+(hue+20)+',70%,40%,'+(0.06+smoothRms*0.1)+')');
      grad.addColorStop(1,'hsla('+(hue+40)+',60%,20%,0)');
      ctx.fillStyle=grad;
      ctx.fillRect(px-pr,py-pr,pr*2,pr*2);
    }

    // Flowing ribbons — voice-responsive paths
    if(voiced||smoothRms>0.02){
      for(var i=0;i<ribbons.length;i++){
        var rb=ribbons[i];
        var head=rb.pts[rb.pts.length-1];
        var nx=head.x+Math.sin(t*rb.speed+rb.phase)*0.005+smoothRms*Math.cos(t*2+i)*0.008;
        var ny=head.y+Math.cos(t*rb.speed*0.8+rb.phase)*0.005+smoothRms*Math.sin(t*1.5+i*0.5)*0.006;
        nx=Math.max(0.05,Math.min(0.95,nx));
        ny=Math.max(0.05,Math.min(0.95,ny));
        rb.pts.push({x:nx,y:ny});
        if(rb.pts.length>80)rb.pts.shift();

        ctx.beginPath();
        ctx.strokeStyle='hsla('+(baseHue+rb.hue)+',80%,'+(50+smoothRms*30)+'%,'+(0.15+smoothRms*0.4)+')';
        ctx.lineWidth=rb.width*(1+smoothRms*3);
        ctx.lineCap='round';
        ctx.lineJoin='round';
        for(var j=0;j<rb.pts.length;j++){
          var p=rb.pts[j];
          j===0?ctx.moveTo(p.x*w,p.y*h):ctx.lineTo(p.x*w,p.y*h);
        }
        ctx.stroke();
      }
    }

    // Central waveform ring
    if(voiced){
      var cx=w/2,cy=h/2;
      var rings=3;
      for(var r=0;r<rings;r++){
        var baseR=Math.max(1,(60+r*35)*(1+smoothRms*1.5));
        ctx.beginPath();
        ctx.strokeStyle='hsla('+(baseHue+50+r*25)+',75%,65%,'+(0.15+smoothRms*0.35-r*0.03)+')';
        ctx.lineWidth=Math.max(0.5,(2-r*0.5)*(1+smoothRms*2));
        var pts=96;
        for(var i=0;i<=pts;i++){
          var angle=(i/pts)*Math.PI*2;
          var warp=Math.sin(angle*smoothPitch*8+t*4+r)*smoothRms*35;
          var warp2=Math.cos(angle*3+t*2.5+r*0.8)*smoothRms*20;
          var px=cx+Math.cos(angle)*(baseR+warp+warp2);
          var py=cy+Math.sin(angle)*(baseR+warp+warp2);
          i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
        }
        ctx.closePath();ctx.stroke();
      }

      // Inner glow
      var glow=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,30+smoothRms*80));
      glow.addColorStop(0,'hsla('+(baseHue+60)+',90%,80%,'+(smoothRms*0.3)+')');
      glow.addColorStop(1,'hsla('+(baseHue+60)+',70%,40%,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(cx-100,cy-100,200,200);
    }

    // Sparks on onset
    if(onset){
      for(var i=0;i<12;i++){
        sparks.push({
          x:0.3+Math.random()*0.4,y:0.3+Math.random()*0.4,
          vx:(Math.random()-0.5)*0.02,vy:(Math.random()-0.5)*0.02,
          life:1,hue:baseHue+Math.random()*80,size:1.5+Math.random()*3
        });
      }
    }

    // Update and draw sparks
    for(var i=sparks.length-1;i>=0;i--){
      var s=sparks[i];
      s.x+=s.vx;s.y+=s.vy;
      s.vx*=0.97;s.vy*=0.97;
      s.life-=0.025;
      if(s.life<=0){sparks.splice(i,1);continue;}
      ctx.beginPath();
      ctx.arc(s.x*w,s.y*h,Math.max(0.5,s.size*s.life),0,Math.PI*2);
      ctx.fillStyle='hsla('+s.hue+',90%,70%,'+(s.life*0.8)+')';
      ctx.fill();
    }

    // Subtle idle shimmer — always alive even without voice
    var shimmerAlpha=0.02+Math.sin(t*0.5)*0.01;
    for(var i=0;i<3;i++){
      var sx=w*(0.3+0.2*i+Math.sin(t*0.3+i)*0.1);
      var sy=h*(0.3+0.2*Math.cos(t*0.2+i*2)*0.1);
      var sr=Math.max(1,40+Math.sin(t*0.4+i)*15);
      var sg=ctx.createRadialGradient(sx,sy,0,sx,sy,sr);
      sg.addColorStop(0,'hsla('+(baseHue+i*40)+',60%,50%,'+shimmerAlpha+')');
      sg.addColorStop(1,'hsla('+(baseHue+i*40)+',40%,30%,0)');
      ctx.fillStyle=sg;
      ctx.fillRect(sx-sr,sy-sr,sr*2,sr*2);
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
