const COMMON_HEADER = [
  'precision mediump float;',
  'uniform float u_time;',
  'uniform vec2 u_resolution;',
  '',
].join('\n');

// --- CRUSH shared GLSL utilities (inlined per template for self-containment) ---
const CRUSH_UTILS = `float crush_hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float crush_noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);float a=crush_hash(i);float b=crush_hash(i+vec2(1.0,0.0));float c=crush_hash(i+vec2(0.0,1.0));float d=crush_hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float crush_fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*crush_noise(p);p*=2.0;a*=0.5;}return v;}
vec3 crush_palette(float t){vec3 a=vec3(0.5,0.5,0.5);vec3 b=vec3(0.5,0.5,0.5);vec3 c=vec3(1.0,1.0,1.0);vec3 d=vec3(0.263,0.416,0.557);return a+b*cos(6.28318*(c*t+d));}
vec3 crush_procedural(vec2 uv,float t){float n1=crush_fbm(uv*3.0+t*0.3);float n2=crush_fbm(uv*5.0-t*0.2+vec2(5.2,1.3));return crush_palette(n1+n2*0.5+t*0.1);}`;

const RAYMARCH_TEMPLATE = `${COMMON_HEADER}
float sdSphere(vec3 p, float r) { return length(p) - r; }

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(uv, 1.0));
  float t = 0.0;
  for (int i = 0; i < 48; i++) {
    vec3 p = ro + rd * t;
    float d = sdSphere(p, 0.8 + 0.1 * sin(u_time));
    if (d < 0.001) break;
    t += d;
  }
  float shade = exp(-0.25 * t);
  gl_FragColor = vec4(vec3(shade), 1.0);
}`;

const FRACTAL_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution.xy - 0.5) * 2.5;
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 64; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uv;
    if (length(z) > 2.0) break;
    iter += 1.0;
  }
  gl_FragColor = vec4(vec3(iter / 64.0, 0.3, 1.0 - iter / 64.0), 1.0);
}`;

const VORONOI_TEMPLATE = `${COMMON_HEADER}
vec2 random2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy * 8.0;
  vec2 cell = floor(uv);
  vec2 local = fract(uv);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = random2(cell + neighbor);
      point = 0.5 + 0.5 * sin(u_time + 6.2831 * point);
      minDist = min(minDist, length(neighbor + point - local));
    }
  }
  gl_FragColor = vec4(vec3(minDist), 1.0);
}`;

const PLASMA_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float plasma = sin(uv.x * 12.0 + u_time) + sin(uv.y * 9.0 - u_time * 0.7);
  gl_FragColor = vec4(0.5 + 0.5 * sin(vec3(0.0, 2.1, 4.2) + plasma), 1.0);
}`;

const KALEIDOSCOPE_TEMPLATE = `${COMMON_HEADER}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy - 0.5;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float segments = 8.0;
  angle = mod(angle, 6.28318 / segments);
  vec3 color = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + radius * 12.0 + angle * segments + u_time);
  gl_FragColor = vec4(color, 1.0);
}`;

const SDF_2D_TEMPLATE = `${COMMON_HEADER}
float sdCircle(vec2 p, float r) { return length(p) - r; }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy - 0.5;
  float d = sdCircle(uv, 0.2 + 0.05 * sin(u_time));
  float edge = smoothstep(0.01, 0.0, abs(d));
  gl_FragColor = vec4(vec3(edge), 1.0);
}`;

// ============================================================
// CRUSH Glitch Effect Templates
// Self-contained GLSL shaders adapted from CRUSH shader library.
// Each template generates a procedural input and applies a glitch effect.
// ============================================================

const CRUSH_RGB_SHIFT = `${COMMON_HEADER}
// CRUSH: RGB Shift -- Chromatic channel separation on a flowing color field
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.4;
  vec3 base=crush_procedural(uv,t);
  float amount=0.025;
  float angle=u_time*0.5;
  float n=crush_hash(uv*u_resolution+t*100.0);
  vec2 dir=vec2(cos(angle),sin(angle))*amount*(1.0+(n-0.5)*0.6);
  float r=crush_procedural(uv+dir,t+0.1).r;
  float g=base.g;
  float b=crush_procedural(uv-dir,t+0.2).b;
  gl_FragColor=vec4(r,g,b,1.0);
}`;

const CRUSH_PIXEL_SORTING = `${COMMON_HEADER}
// CRUSH: Pixel Sorting -- Luma-weighted displacement on a noise field
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  vec3 col=crush_procedural(uv,t);
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  float threshold=0.4;
  if(luma>threshold){
    float lumaAbove=(luma-threshold)/(1.0-threshold);
    float row=uv.y*u_resolution.y;
    float rowNoise=crush_hash(vec2(row*0.37,floor(t*5.0)));
    float sortLen=0.15;
    float offset=lumaAbove*sortLen*(0.5+rowNoise*0.5);
    vec2 srcUV=vec2(clamp(uv.x-offset,0.0,1.0),uv.y);
    col=crush_procedural(srcUV,t);
  }
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_MACROBLOCKING = `${COMMON_HEADER}
// CRUSH: Macroblocking -- Block quantization on a gradient
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  float blockSize=0.04+0.02*sin(u_time*0.5);
  vec2 blockCoord=floor(uv/blockSize)*blockSize+blockSize*0.5;
  vec3 blocked=crush_procedural(clamp(blockCoord,vec2(0.0),vec2(1.0)),t);
  float levels=8.0;
  blocked=floor(blocked*levels)/levels;
  vec3 orig=crush_procedural(uv,t);
  float intensity=0.8;
  vec3 col=mix(orig,blocked,intensity);
  float edgeDist=min(min(mod(uv.x,blockSize),blockSize-mod(uv.x,blockSize)),min(mod(uv.y,blockSize),blockSize-mod(uv.y,blockSize)));
  col+=vec3(0.08)*smoothstep(0.003,0.0,edgeDist);
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_DATAMOSHING = `${COMMON_HEADER}
// CRUSH: Datamoshing -- Simulated I-frame/P-frame corruption
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  vec3 base=crush_procedural(uv,t);
  float drift=0.08;
  float iframeInterval=4.0;
  float frame=floor(u_time*15.0);
  float gopProgress=mod(frame,iframeInterval)/iframeInterval;
  float mvX=crush_hash(vec2(uv.y*137.0,floor(t*3.0)))-0.5;
  float mvY=crush_hash(vec2(uv.x*241.0,floor(t*3.0)+100.0))-0.5;
  vec2 mv=vec2(mvX,mvY)*drift*gopProgress*2.0;
  vec2 moshUV=clamp(uv+mv,vec2(0.0),vec2(1.0));
  vec3 moshed=crush_procedural(moshUV,t);
  vec3 col=mix(base,moshed,smoothstep(0.1,0.8,gopProgress));
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_VHS_TRACKING = `${COMMON_HEADER}
// CRUSH: VHS Tracking -- Rolling horizontal bands with color bleed
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time;
  vec3 base=crush_procedural(uv,t*0.3);
  float band=sin(uv.y*20.0+t*3.0)*0.5+0.5;
  band=pow(band,4.0)*0.8;
  float offset=band*0.08;
  vec3 shifted=crush_procedural(vec2(clamp(uv.x+offset,0.0,1.0),uv.y),t*0.3);
  float chromaOff=0.015;
  shifted.r=crush_procedural(vec2(clamp(uv.x+offset+chromaOff,0.0,1.0),uv.y),t*0.3+0.05).r;
  float noise=crush_hash(uv*u_resolution+t*137.0);
  shifted+=(noise-0.5)*0.08;
  float scanline=0.95+0.05*sin(uv.y*u_resolution.y*1.5);
  shifted*=scanline;
  gl_FragColor=vec4(shifted,1.0);
}`;

const CRUSH_SCANLINE_JITTER = `${COMMON_HEADER}
// CRUSH: Scanline Jitter -- Row-based horizontal glitch
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time;
  float rowHeight=3.0;
  float row=floor(uv.y*u_resolution.y/rowHeight);
  float n=crush_hash(vec2(row,floor(t*8.0)));
  float jitter=0.0;
  float frequency=0.35;
  if(n<frequency){
    float n2=crush_hash(vec2(row*17.0,t*3.0));
    jitter=(n2-0.5)*2.0*0.04;
  }
  vec2 jitteredUV=vec2(clamp(uv.x+jitter,0.0,1.0),uv.y);
  vec3 col=crush_procedural(jitteredUV,t*0.3);
  float scanline=0.92+0.08*sin(uv.y*u_resolution.y*0.5);
  col*=scanline;
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_SLIT_SCAN = `${COMMON_HEADER}
// CRUSH: Slit Scan -- Temporal displacement simulated via time-based UV warp
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  float depth=6.0;
  float temporalT=uv.y*depth;
  float timeOffset=temporalT*0.5;
  vec2 warpedUV=uv;
  warpedUV.x+=sin(uv.y*10.0+t)*0.03*uv.y;
  vec3 col=crush_procedural(warpedUV,t+timeOffset);
  col*=0.85+0.15*sin(uv.y*200.0);
  float vignette=1.0-0.3*length(uv-0.5);
  col*=vignette;
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_SCREEN_TEARING = `${COMMON_HEADER}
// CRUSH: Screen Tearing -- Horizontal tear strips on a gradient
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time;
  vec3 base=crush_procedural(uv,t*0.3);
  int tearCount=5;
  float offsetRange=0.06;
  float speed=1.5;
  float totalOffset=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);
    float tearY=fract((fi+1.0)/6.0+t*speed*0.1);
    float dist=abs(uv.y-tearY);
    float weight=1.0-smoothstep(0.0,0.02,dist);
    float tearOffset=crush_hash(vec2(fi*7.0,floor(t*speed)))-0.5;
    totalOffset+=tearOffset*offsetRange*weight;
  }
  vec2 tearUV=vec2(clamp(uv.x+totalOffset,0.0,1.0),uv.y);
  vec3 col=crush_procedural(tearUV,t*0.3);
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_TURBULENT_DISPLACEMENT = `${COMMON_HEADER}
// CRUSH: Turbulent Displacement -- Organic FBM noise warp
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time;
  float amount=0.15;
  float scale=4.0;
  float speed=0.5;
  vec2 noiseCoord=uv*scale+vec2(t*speed*0.5,t*0.2);
  float dx=crush_fbm(noiseCoord)-0.5;
  float dy=crush_fbm(noiseCoord+vec2(43.0,17.0))-0.5;
  vec2 displaced=uv+vec2(dx,dy)*amount*2.0;
  displaced=clamp(displaced,vec2(0.0),vec2(1.0));
  vec3 col=crush_procedural(displaced,t*0.3);
  float warpIntensity=length(vec2(dx,dy))*2.0;
  col+=vec3(0.1,0.0,0.15)*warpIntensity;
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_DIGITAL_FEEDBACK = `${COMMON_HEADER}
// CRUSH: Digital Feedback -- Layered recursive UV transforms
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  vec3 col=vec3(0.0);
  float decay=0.65;
  float scale=0.97;
  float rotation=u_time*5.0*3.14159265/180.0;
  vec2 center=vec2(0.5);
  vec2 currentUV=uv;
  vec3 currentCol=crush_procedural(uv,t);
  col+=currentCol*0.4;
  for(int i=1;i<6;i++){
    float fi=float(i);
    vec2 d=currentUV-center;
    d/=max(scale,0.001);
    float cs=cos(-rotation*fi);
    float sn=sin(-rotation*fi);
    currentUV=vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs)+center;
    if(currentUV.x>=0.0&&currentUV.x<1.0&&currentUV.y>=0.0&&currentUV.y<1.0){
      vec3 layer=crush_procedural(currentUV,t+fi*0.1);
      col+=layer*pow(decay,fi)*0.35;
    }
  }
  gl_FragColor=vec4(col,1.0);
}`;

const CRUSH_DEPTH_SPLATTING = `${COMMON_HEADER}
// CRUSH: Depth Splatting -- 3D parallax displacement of a procedural scene
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  vec3 col=crush_procedural(uv,t);
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  float depth=(luma-0.5)*2.0;
  depth=sign(depth)*pow(abs(depth),1.5)*0.3;
  float rotX=sin(t*0.7)*15.0*3.14159265/180.0;
  float rotY=cos(t*0.5)*20.0*3.14159265/180.0;
  vec2 offset;
  offset.x=sin(rotY)*depth*0.12;
  offset.y=-sin(rotX)*depth*0.12;
  vec2 displaced=clamp(uv+offset,vec2(0.0),vec2(1.0));
  float pointSize=6.0;
  float cellSize=pointSize/u_resolution.x;
  vec2 cellCenter=(floor(displaced/cellSize)+0.5)*cellSize;
  cellCenter=clamp(cellCenter,vec2(0.0),vec2(1.0));
  vec2 diff=(displaced-cellCenter)*u_resolution;
  float dist=length(diff);
  if(dist>pointSize*0.5){
    gl_FragColor=vec4(0.0,0.0,0.02,1.0);
    return;
  }
  vec3 pointCol=crush_procedural(cellCenter,t);
  gl_FragColor=vec4(pointCol,1.0);
}`;

const CRUSH_CMKY_SPLIT = `${COMMON_HEADER}
// CRUSH: CMYK Split -- Print-registration color plate separation
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float t=u_time*0.3;
  float amount=0.03;
  float angle=t*0.5;
  float noiseAmt=0.3;
  vec2 dirC=vec2(cos(angle),sin(angle))*amount;
  vec2 dirM=vec2(cos(angle+1.5708),sin(angle+1.5708))*amount;
  vec2 dirY=vec2(cos(angle+3.1416),sin(angle+3.1416))*amount;
  vec2 dirK=vec2(cos(angle+4.7124),sin(angle+4.7124))*amount*0.6;
  float n=crush_hash(uv*u_resolution+t*100.0);
  float nScale=(n-0.5)*noiseAmt*2.0;
  dirC*=(1.0+nScale);
  dirM*=(1.0+nScale*0.8);
  dirY*=(1.0+nScale*1.2);
  dirK*=(1.0+nScale*0.6);
  vec3 sC=crush_procedural(clamp(uv+dirC,vec2(0.0),vec2(1.0)),t);
  vec3 sM=crush_procedural(clamp(uv+dirM,vec2(0.0),vec2(1.0)),t);
  vec3 sY=crush_procedural(clamp(uv+dirY,vec2(0.0),vec2(1.0)),t);
  vec3 sK=crush_procedural(clamp(uv+dirK,vec2(0.0),vec2(1.0)),t);
  float c=1.0-sC.r;
  float m=1.0-sM.g;
  float y=1.0-sY.b;
  float k=min(min(1.0-sK.r,1.0-sK.g),1.0-sK.b)*0.6;
  float r=(1.0-c)*(1.0-k);
  float g=(1.0-m)*(1.0-k);
  float b=(1.0-y)*(1.0-k);
  gl_FragColor=vec4(r,g,b,1.0);
}`;

const CRUSH_POINT_CLOUD = `${COMMON_HEADER}
// CRUSH: Point Cloud -- Particle dissolution of a procedural pattern
${CRUSH_UTILS}
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float w=u_resolution.x;
  float h=u_resolution.y;
  float t=u_time;
  float scatter=0.06;
  float density=0.7;
  float pointSize=4.0;
  float softness=0.4;
  float speed=0.6;
  float cellSzX=3.0/w;
  float cellSzY=3.0/h;
  vec2 cell=floor(uv/vec2(cellSzX,cellSzY));
  int searchRadius=3;
  vec4 bestColor=vec4(0.0,0.0,0.02,1.0);
  float bestAlpha=0.0;
  for(int cy=-3;cy<=3;cy++){
    for(int cx=-3;cx<=3;cx++){
      vec2 nc=cell+vec2(float(cx),float(cy));
      vec2 ncOrigin=(nc+0.5)*vec2(cellSzX,cellSzY);
      float cellHash=crush_hash(nc*0.7+0.1);
      if(cellHash>density*density)continue;
      float pSeed1=crush_hash(nc*3.71+0.3);
      float pSeed2=crush_hash(nc*5.13+0.7);
      vec2 jitter=vec2((crush_hash(nc*2.31+0.5)-0.5)*cellSzX*0.9,(crush_hash(nc*4.67+0.9)-0.5)*cellSzY*0.9);
      ncOrigin+=jitter;
      vec2 srcUV=clamp(ncOrigin,vec2(0.0),vec2(1.0));
      vec3 srcCol=crush_procedural(srcUV,t*0.3);
      float srcLuma=dot(srcCol,vec3(0.2126,0.7152,0.0722));
      float scatterMul=scatter*(1.0+(1.0-srcLuma)*2.0);
      float noiseTime=t*speed*0.4;
      vec2 noiseCoord=nc*0.1+vec2(pSeed1*100.0,pSeed2*100.0);
      vec2 scatterOff;
      scatterOff.x=(crush_fbm(noiseCoord+vec2(noiseTime,0.0))-0.5)*scatterMul*0.6;
      scatterOff.y=(crush_fbm(noiseCoord+vec2(0.0,noiseTime+50.0))-0.5)*scatterMul*0.6;
      vec2 particlePos=ncOrigin+scatterOff;
      float effectiveRadius=pointSize*0.5;
      vec2 diff=(uv-particlePos)*vec2(w,h);
      float dist=length(diff);
      if(dist>effectiveRadius*1.5)continue;
      float tt=dist/max(effectiveRadius,0.5);
      float softFactor=mix(8.0,2.0,softness);
      float alpha=exp(-tt*tt*softFactor);
      if(alpha>bestAlpha){
        bestAlpha=alpha;
        bestColor=vec4(srcCol*alpha+bestColor.rgb*(1.0-alpha),1.0);
      }
    }
  }
  gl_FragColor=bestColor;
}`;

export function selectShaderTemplate(prompt: string): string {
  const lower = prompt.toLowerCase();

  // CRUSH glitch effects
  if (/\b(rgb\s*shift|chromatic\s*aberration|color\s*fringe)\b/.test(lower)) return CRUSH_RGB_SHIFT;
  if (/\b(pixel\s*sort(ing)?|luma\s*sort)\b/.test(lower)) return CRUSH_PIXEL_SORTING;
  if (/\b(macro\s*block(ing)?|block(ing)?\s*pixel|chunky\s*pixel|mpeg\s*artifact)\b/.test(lower)) return CRUSH_MACROBLOCKING;
  if (/\b(datamosh(ing)?|iframe|p.frame|motion\s*corrupt)\b/.test(lower)) return CRUSH_DATAMOSHING;
  if (/\b(vhs|tracking\s*error|tracking\s*band|tape\s*glitch)\b/.test(lower)) return CRUSH_VHS_TRACKING;
  if (/\b(scanline\s*jitter|row\s*glitch|horizontal\s*jitter)\b/.test(lower)) return CRUSH_SCANLINE_JITTER;
  if (/\b(slit\s*scan|temporal\s*displace|time\s*warp)\b/.test(lower)) return CRUSH_SLIT_SCAN;
  if (/\b(screen\s*tear(ing)?|horizontal\s*tear|frame\s*tear)\b/.test(lower)) return CRUSH_SCREEN_TEARING;
  if (/\b(turbulent|turbulence|fbm\s*warp|organic\s*warp|noise\s*displace)\b/.test(lower)) return CRUSH_TURBULENT_DISPLACEMENT;
  if (/\b(digital\s*feedback|recursive|echo\s*layer|feedback\s*loop)\b/.test(lower)) return CRUSH_DIGITAL_FEEDBACK;
  if (/\b(depth\s*splat(ting)?|parallax\s*point|3d\s*point)\b/.test(lower)) return CRUSH_DEPTH_SPLATTING;
  if (/\b(cmyk\s*split|print\s*registration|plate\s*separation|cmyk)\b/.test(lower)) return CRUSH_CMKY_SPLIT;
  if (/\b(point\s*cloud|particle\s*dissolve|particle\s*scatter)\b/.test(lower)) return CRUSH_POINT_CLOUD;
  // Generic "glitch" catch-all: pick a random-ish one based on prompt hash
  if (/\bglitch\b/.test(lower)) {
    const idx = Math.abs(hashString(lower)) % 5;
    return [CRUSH_RGB_SHIFT, CRUSH_VHS_TRACKING, CRUSH_SCANLINE_JITTER, CRUSH_DATAMOSHING, CRUSH_SCREEN_TEARING][idx];
  }

  // Original Sinter templates
  if (/\b(fractal|mandelbrot|julia)\b/.test(lower)) return FRACTAL_TEMPLATE;
  if (/\bvoronoi\b/.test(lower)) return VORONOI_TEMPLATE;
  if (/\b(plasma|lava|fire)\b/.test(lower)) return PLASMA_TEMPLATE;
  if (/\b(kaleidoscope|mirror|symmetry)\b/.test(lower)) return KALEIDOSCOPE_TEMPLATE;
  if (/\b(2d\s*sdf|sdf shape|circle)\b/.test(lower)) return SDF_2D_TEMPLATE;
  return RAYMARCH_TEMPLATE;
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return hash;
}
