// Domain detection for the gallery vision-audit renderer. Shared with
// render-gallery.mjs and unit-tested in test/unit/quality/detect-domain.test.ts.
//
// Audio (Strudel/Tidal live-coding music) is detected BEFORE hydra: Strudel's
// `.shape()` / `.out()` collide with Hydra's visual-source heuristic, so audio
// works were being wrapped as a visual domain and rendered blank with
// `bpm is not defined`. Audio works can't be vision-rendered, so the audit
// skips them rather than producing false-broken renders.

// True for live-coding music (Strudel/Tidal). Decisive signal: bpm()/setcpm()/
// cps() — visual live-coding has no tempo. Also mini-notation s("..")/note("..")
// chained to .out() without a Hydra visual source (osc/src/gradient/solid/voronoi).
export function isAudioCode(code) {
  if (/\b(?:bpm|setcpm|setBpm|cps)\s*\(/.test(code)) return true;
  const miniNotation = /\b(?:s|note|sound)\s*\(\s*["'`]/.test(code) && /\.out\s*\(/.test(code);
  const hydraSource = /\b(?:osc|src|gradient|solid|voronoi)\s*\(/.test(code);
  return miniNotation && !hydraSource;
}

// Detect the creative domain of raw code so it can be wrapped faithfully (the
// same HTMLWrapper the product uses) — guessing p5 for everything renders
// shaders/three/hydra as blank false-negatives, and audio as a `bpm` error.
export function detectDomain(code) {
  if (/^\s*</.test(code) || /<svg[\s>]/i.test(code)) return 'svg';
  if (/gl_FragColor|precision\s+(?:highp|mediump|lowp)|void\s+main\s*\(/.test(code)) return 'shader';
  if (/\bTHREE\.|new\s+Scene\(|WebGLRenderer/.test(code)) return 'three';
  if (isAudioCode(code)) return 'audio';
  if (/\bosc\(|\.out\(|\bsrc\(\s*o\d|noise\([^)]*\)\.|hydra/i.test(code)) return 'hydra';
  return 'p5';
}
