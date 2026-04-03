/**
 * Behavior feature vector extraction for MAP-Elites grid placement.
 * Extracts ~32-dim behavior feature vectors from code strings.
 */

export type Domain = 'p5' | 'glsl' | 'three' | 'music' | 'html' | 'ascii' | 'remotion' | 'hydra' | 'strudel';

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

  // 3. Remotion: React video components
  if (/useCurrentFrame|useVideoConfig|AbsoluteFill|Sequence/.test(code) || /from\s+['"]remotion/.test(code)) {
    return 'remotion';
  }

  // 4. Hydra: video synth patterns
  if (/\.out\(|osc\(|shape\(|kaleid\(|scrollX|scrollY/.test(code)) {
    return 'hydra';
  }

  // 5. Strudel: pattern language
  if (/\bs\s+\(|stack\s*\(|seq\s*\(|note\s*\(|sound\s*\(|\.cpm\b/.test(code)) {
    return 'strudel';
  }

  // 6. ASCII Art: box-drawing and block characters
  if (/[\u2580-\u259F\u2500-\u257F]/.test(code) || (/[█▓▒░@#%*]/.test(code) && code.length < 5000)) {
    return 'ascii';
  }

  // 7. HTML: markup structure
  if (/<!DOCTYPE\s+html>|<html[\s>]/i.test(code) || (/<(div|section|header|footer|main|article)/i.test(code) && /<\/html>/i.test(code))) {
    return 'html';
  }

  // 8. Music: audio-specific patterns
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

  // 9. p5: setup, draw, createCanvas
  if (/\bsetup\s*\(\s*\)/.test(code) || /\bdraw\s*\(\s*\)/.test(code) || /\bcreateCanvas\s*\(/.test(code)) {
    return 'p5';
  }

  // 10. Default to p5 (most common domain)
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

/** Extract the 8-element HTML feature sub-vector. */
function extractHTMLFeatures(code: string): number[] {
  return [
    /<header|hero|banner/i.test(code) ? 1 : 0,          // 0: hasHeader
    /<nav|navigation|menu/i.test(code) ? 1 : 0,         // 1: hasNav
    /<section|article|main/i.test(code) ? 1 : 0,        // 2: hasSections
    /<button|cta|call-to-action/i.test(code) ? 1 : 0,   // 3: hasCTA
    /<footer/i.test(code) ? 1 : 0,                      // 4: hasFooter
    /style=|class=|css/i.test(code) ? 1 : 0,            // 5: hasStyling
    /responsive|@media|viewport/i.test(code) ? 1 : 0,   // 6: isResponsive
    measureComplexity(code),                             // 7: codeComplexity
  ];
}

/** Extract the 8-element ASCII art feature sub-vector. */
function extractASCIIFeatures(code: string): number[] {
  const blockChars = (code.match(/[\u2580-\u259F]/g) || []).length;
  const lineChars = (code.match(/[\u2500-\u257F]/g) || []).length;
  return [
    Math.min(blockChars / 50, 1),                       // 0: blockDensity
    Math.min(lineChars / 50, 1),                        // 1: lineDensity
    /[█▓▒░]/.test(code) ? 1 : 0,                        // 2: hasShading
    /[┌┐└┘├┤┬┴┼]/.test(code) ? 1 : 0,                   // 3: hasBoxDrawing
    /[@#%*+=\-:]/.test(code) ? 1 : 0,                   // 4: hasASCIIChars (hyphen escaped)
    code.split('\n').length > 10 ? 1 : 0,               // 5: hasMultipleLines
    code.length > 200 ? 1 : 0,                          // 6: hasContent
    measureComplexity(code),                             // 7: codeComplexity
  ];
}

/** Extract the 8-element Remotion feature sub-vector. */
function extractRemotionFeatures(code: string): number[] {
  return [
    /useCurrentFrame/.test(code) ? 1 : 0,               // 0: usesFrame
    /useVideoConfig/.test(code) ? 1 : 0,                // 1: usesVideoConfig
    /AbsoluteFill/.test(code) ? 1 : 0,                  // 2: usesAbsoluteFill
    /Sequence/.test(code) ? 1 : 0,                      // 3: usesSequence
    /interpolate|spring/.test(code) ? 1 : 0,            // 4: usesAnimation
    /from\s+['"]remotion/.test(code) ? 1 : 0,           // 5: importsRemotion
    /export\s+default\s+function/.test(code) ? 1 : 0,   // 6: hasComponent
    measureComplexity(code),                             // 7: codeComplexity
  ];
}

/** Extract the 8-element Hydra feature sub-vector. */
function extractHydraFeatures(code: string): number[] {
  return [
    /\.out\(/.test(code) ? 1 : 0,                       // 0: hasOutput
    /osc\(/.test(code) ? 1 : 0,                         // 1: usesOscillator
    /shape\(/.test(code) ? 1 : 0,                       // 2: usesShape
    /kaleid\(/.test(code) ? 1 : 0,                      // 3: usesKaleidoscope
    /scrollX|scrollY/.test(code) ? 1 : 0,               // 4: usesScroll
    /src\(/.test(code) ? 1 : 0,                         // 5: usesSource
    /modulate|blend|mult|add/.test(code) ? 1 : 0,       // 6: usesEffects
    measureComplexity(code),                             // 7: codeComplexity
  ];
}

/** Extract the 8-element Strudel feature sub-vector. */
function extractStrudelFeatures(code: string): number[] {
  return [
    /\bs\s+\(/.test(code) ? 1 : 0,                      // 0: usesPattern
    /stack\s*\(/.test(code) ? 1 : 0,                    // 1: usesStack
    /seq\s*\(/.test(code) ? 1 : 0,                      // 2: usesSequence
    /note\s*\(/.test(code) ? 1 : 0,                     // 3: usesNotes
    /sound\s*\(/.test(code) ? 1 : 0,                    // 4: usesSound
    /\.cpm\b|bpm/.test(code) ? 1 : 0,                   // 5: usesTempo
    /\.|\*|\//.test(code) ? 1 : 0,                      // 6: usesRhythmOps
    measureComplexity(code),                             // 7: codeComplexity
  ];
}

/** Extract a 32-dim behavior feature vector from code. Each value in [0, 1]. */
export function extractBehavior(code: string, domain?: Domain): number[] {
  const detected = domain ?? detectDomain(code);

  const p5Features       = detected === 'p5'       ? extractP5Features(code)       : new Array(8).fill(0);
  const glslFeatures     = detected === 'glsl'     ? extractGLSLFeatures(code)     : new Array(8).fill(0);
  const threeFeatures    = detected === 'three'    ? extractThreeFeatures(code)    : new Array(8).fill(0);
  const musicFeatures    = detected === 'music'    ? extractMusicFeatures(code)    : new Array(8).fill(0);
  const htmlFeatures     = detected === 'html'     ? extractHTMLFeatures(code)     : new Array(8).fill(0);
  const asciiFeatures    = detected === 'ascii'    ? extractASCIIFeatures(code)    : new Array(8).fill(0);
  const remotionFeatures = detected === 'remotion' ? extractRemotionFeatures(code) : new Array(8).fill(0);
  const hydraFeatures    = detected === 'hydra'    ? extractHydraFeatures(code)    : new Array(8).fill(0);
  const strudelFeatures  = detected === 'strudel'  ? extractStrudelFeatures(code)  : new Array(8).fill(0);

  return [...p5Features, ...glslFeatures, ...threeFeatures, ...musicFeatures, 
          ...htmlFeatures, ...asciiFeatures, ...remotionFeatures, ...hydraFeatures, ...strudelFeatures];
}
