/**
 * Behavior feature vector extraction for MAP-Elites grid placement.
 * Extracts ~32-dim behavior feature vectors from code strings.
 */

export type Domain = 'p5' | 'glsl' | 'three' | 'music';

/** Detect what domain a code string belongs to. */
export function detectDomain(code: string): Domain {
  // 1. GLSL: void main() + gl_FragColor or out vec4
  if (/void\s+main\s*\(\s*\)/.test(code) && (/gl_FragColor/.test(code) || /out\s+vec4/.test(code))) {
    return 'glsl';
  }

  // 2. Three.js: import from 'three' or THREE.* globals
  if (/import\s+.*\s+from\s+['"]three/.test(code) || /THREE\.(Scene|Camera|Renderer|Mesh|Geometry|Material|Light|Group|Object3D)/.test(code)) {
    return 'three';
  }

  // 3. Music: audio-specific patterns
  if (
    /play\s*\(\s*\)/.test(code) ||
    /oscillator/i.test(code) ||
    /AudioContext/i.test(code) ||
    /Tone\./.test(code) ||
    /MIDI/i.test(code) ||
    /note\s*\(/i.test(code) ||
    /scale\s*\(/i.test(code) ||
    /\bbpm\b/i.test(code)
  ) {
    return 'music';
  }

  // 4. p5: setup, draw, createCanvas
  if (/\bsetup\s*\(\s*\)/.test(code) || /\bdraw\s*\(\s*\)/.test(code) || /\bcreateCanvas\s*\(/.test(code)) {
    return 'p5';
  }

  // 5. Default to p5
  return 'p5';
}

/** Count occurrences of any of the given patterns in code. */
function countPatterns(code: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pat of patterns) {
    const matches = code.match(pat);
    if (matches) total += matches.length;
  }
  return total;
}

/** Normalize complexity: count structural elements, divide by divisor, clamp to [0,1]. */
function measureComplexity(code: string, divisor = 50): number {
  const count = countPatterns(code, [
    /\bfunction\b/g,
    /\b(const|let|var)\s+\w+\s*=/g,
    /\bif\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bclass\b/g,
    /=>\s*[{(]/g,
    /\?\?/g,
    /\?[^.?]/g,
  ]);
  return Math.min(count / divisor, 1);
}

/** Extract the 8-element p5 feature sub-vector. */
function extractP5Features(code: string): number[] {
  return [
    /\bsetup\s*\(\s*\)/.test(code) ? 1 : 0,           // 0: hasSetup
    /\bdraw\s*\(\s*\)/.test(code) ? 1 : 0,             // 1: hasDraw
    /\b(frameCount|frameRate|deltaTime)\b/.test(code) ? 1 : 0, // 2: usesAnimation
    /\b(fill|stroke|colorMode|background|color)\s*\(/.test(code) ? 1 : 0, // 3: usesColor
    /\b(mouseX|mouseY|mousePressed|keyPressed|mouseMoved|touchStarted)\b/.test(code) ? 1 : 0, // 4: hasInteractivity
    /\bclass\b/.test(code) ? 1 : 0,                    // 5: usesClasses
    /\[/.test(code) ? 1 : 0,                           // 6: usesArrays (simple heuristic)
    measureComplexity(code),                            // 7: codeComplexity
  ];
}

/** Extract the 8-element GLSL feature sub-vector. */
function extractGLSLFeatures(code: string): number[] {
  const uniformCount = (code.match(/\buniform\b/g) || []).length;
  return [
    /\bprecision\b/.test(code) ? 1 : 0,               // 8: hasPrecision
    Math.min(uniformCount / 10, 1),                     // 9: hasUniforms
    /\b(sin|cos|tan|atan|asin|acos|pow|sqrt|abs|floor|ceil|fract|mod|min|max|clamp|mix|step|smoothstep|noise|length|distance|dot|cross|normalize|reflect|refract)\b/.test(code) ? 1 : 0, // 10: usesMathFunctions
    /\b(ray\s*march|raymarch|sdf|signed\s*distance|mod\s*\(\s*p\b)/i.test(code) ? 1 : 0, // 11: usesRaymarching
    /\b(mix|smoothstep|clamp|step)\b/.test(code) ? 1 : 0, // 12: usesColorOperations
    /\b(for|while)\b/.test(code) ? 1 : 0,              // 13: usesLoops
    /\bu_time\b/.test(code) || /\buniform\s+float\s+time\b/.test(code) ? 1 : 0, // 14: usesTime
    measureComplexity(code),                            // 15: codeComplexity
  ];
}

/** Extract the 8-element Three.js feature sub-vector. */
function extractThreeFeatures(code: string): number[] {
  return [
    /THREE\.\s*Scene\b|new\s+Scene\b/.test(code) ? 1 : 0,   // 16: hasScene
    /THREE\.\s*(Perspective|Orthographic)?Camera\b|new\s+(Perspective|Orthographic)?Camera\b/.test(code) ? 1 : 0, // 17: hasCamera
    /THREE\.\s*WebGLRenderer\b|new\s+WebGLRenderer\b/.test(code) ? 1 : 0, // 18: hasRenderer
    /THREE\.\s*\w*Geometry\b|new\s+\w*Geometry\b/.test(code) ? 1 : 0, // 19: hasGeometry
    /THREE\.\s*\w*Material\b|new\s+\w*Material\b/.test(code) ? 1 : 0, // 20: hasMaterial
    /THREE\.\s*\w*Light\b|new\s+\w*Light\b|addLight|AmbientLight|DirectionalLight|PointLight|SpotLight/.test(code) ? 1 : 0, // 21: hasLighting
    /\brequestAnimationFrame\b/.test(code) ? 1 : 0,           // 22: hasAnimation
    measureComplexity(code),                                    // 23: codeComplexity
  ];
}

/** Extract the 8-element music feature sub-vector. */
function extractMusicFeatures(code: string): number[] {
  return [
    /oscillator/i.test(code) ? 1 : 0,                  // 24: hasOscillator
    /\bnote\s*\(/i.test(code) || /\bnotes?\b/i.test(code) ? 1 : 0, // 25: hasNotes
    /\btempo\b/i.test(code) || /\bbpm\b/i.test(code) || /\brhythm\b/i.test(code) || /\bseq(uence)?\b/i.test(code) ? 1 : 0, // 26: hasRhythm
    /\b(reverb|delay|filter|distortion|chorus|flanger|phaser|compressor)\b/i.test(code) ? 1 : 0, // 27: hasEffects
    /\bscale\s*\(/i.test(code) || /\bmajor\b|\bminor\b|\bpentatonic\b/i.test(code) ? 1 : 0, // 28: hasScales
    /\bbpm\b/i.test(code) || /\btempo\b/i.test(code) ? 1 : 0, // 29: hasTempo
    /\b(envelope|adsr|attack|release|decay|sustain)\b/i.test(code) || /linearRamp|setValueAtTime|exponentialRamp/.test(code) ? 1 : 0, // 30: hasEnvelope
    measureComplexity(code),                             // 31: codeComplexity
  ];
}

/** Extract a 32-dim behavior feature vector from code. Each value in [0, 1]. */
export function extractBehavior(code: string, domain?: Domain): number[] {
  const detected = domain ?? detectDomain(code);

  const p5Features    = detected === 'p5'    ? extractP5Features(code)    : new Array(8).fill(0);
  const glslFeatures  = detected === 'glsl'  ? extractGLSLFeatures(code)  : new Array(8).fill(0);
  const threeFeatures = detected === 'three' ? extractThreeFeatures(code) : new Array(8).fill(0);
  const musicFeatures = detected === 'music' ? extractMusicFeatures(code) : new Array(8).fill(0);

  return [...p5Features, ...glslFeatures, ...threeFeatures, ...musicFeatures];
}
