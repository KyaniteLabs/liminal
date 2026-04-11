import { describe, it, expect } from 'vitest';
import {
  shaderConfidence,
  threeConfidence,
  htmlConfidence,
  asciiConfidence,
  textgenConfidence,
  strudelConfidence,
  hydraConfidence,
  toneConfidence,
  p5Confidence,
} from '../../../src/generators/registerGenerators.js';

// ---------------------------------------------------------------------------
// shaderConfidence
// ---------------------------------------------------------------------------
describe('shaderConfidence', () => {
  it('returns 0.9 for ray march keyword', () => {
    expect(shaderConfidence('create a ray march shader')).toBe(0.9);
  });

  it('returns 0.9 for sdf keyword', () => {
    expect(shaderConfidence('sdf sphere rendering')).toBe(0.9);
  });

  it('returns 0.9 for fragment keyword', () => {
    expect(shaderConfidence('fragment shader with glow')).toBe(0.9);
  });

  it('returns 0.7 for generic shader keyword', () => {
    expect(shaderConfidence('a cool shader effect')).toBe(0.7);
  });

  it('returns 0.7 for GLSL keyword', () => {
    expect(shaderConfidence('GLSL noise texture')).toBe(0.7);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(shaderConfidence('draw a circle with p5')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(shaderConfidence('')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(shaderConfidence('SHADER')).toBe(0.7);
    expect(shaderConfidence('Ray March')).toBe(0.9);
  });
});

// ---------------------------------------------------------------------------
// threeConfidence
// ---------------------------------------------------------------------------
describe('threeConfidence', () => {
  it('returns 0.95 for "three.js" explicit mention', () => {
    expect(threeConfidence('build a three.js scene')).toBe(0.95);
  });

  it('returns 0.95 for "threejs" without dot', () => {
    expect(threeConfidence('threejs cube rotation')).toBe(0.95);
  });

  it('returns 0.95 for standalone "three" word', () => {
    expect(threeConfidence('render something with three')).toBe(0.95);
  });

  it('returns 0.90 for 3D with specific keywords like scene/cube/sphere', () => {
    expect(threeConfidence('3d cube with lighting')).toBe(0.90);
    expect(threeConfidence('a 3d scene with camera')).toBe(0.90);
    expect(threeConfidence('3d model import with webgl')).toBe(0.90);
  });

  it('returns 0.75 for generic 3D without specifics', () => {
    expect(threeConfidence('cool 3d effect')).toBe(0.75);
  });

  it('returns 0.75 for webgl keyword', () => {
    expect(threeConfidence('webgl rendering')).toBe(0.75);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(threeConfidence('html landing page')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(threeConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// htmlConfidence
// ---------------------------------------------------------------------------
describe('htmlConfidence', () => {
  it('returns 0.95 for portfolio keyword', () => {
    expect(htmlConfidence('portfolio site for an artist')).toBe(0.95);
  });

  it('returns 0.95 for landing page keyword', () => {
    expect(htmlConfidence('a landing page for a product')).toBe(0.95);
  });

  it('returns 0.95 for dashboard keyword', () => {
    expect(htmlConfidence('analytics dashboard')).toBe(0.95);
  });

  it('returns 0.95 for web app keyword', () => {
    expect(htmlConfidence('interactive web app')).toBe(0.95);
  });

  it('returns 0.90 for explicit HTML/CSS mention', () => {
    expect(htmlConfidence('html form with validation')).toBe(0.90);
    expect(htmlConfidence('css design system')).toBe(0.90);
  });

  it('returns 0.90 for web component/web page/web widget', () => {
    expect(htmlConfidence('web component for ratings')).toBe(0.90);
    expect(htmlConfidence('web page layout')).toBe(0.90);
    expect(htmlConfidence('web widget calendar')).toBe(0.90);
  });

  it('returns 0.75 for website/webpage/css design', () => {
    expect(htmlConfidence('a website for my band')).toBe(0.75);
  });

  it('returns 0.65 for web dev / ui component / form / spa', () => {
    expect(htmlConfidence('web dev project')).toBe(0.65);
    expect(htmlConfidence('ui component library')).toBe(0.65);
    expect(htmlConfidence('contact form')).toBe(0.65);
    expect(htmlConfidence('spa with routing')).toBe(0.65);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(htmlConfidence('glsl shader noise')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(htmlConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// asciiConfidence
// ---------------------------------------------------------------------------
describe('asciiConfidence', () => {
  it('returns 0.95 for "ascii art" exact phrase', () => {
    expect(asciiConfidence('ascii art landscape')).toBe(0.95);
  });

  it('returns 0.90 for standalone "ascii"', () => {
    expect(asciiConfidence('ascii renderer')).toBe(0.90);
  });

  it('returns 0.75 for text art / character art / glyph / symbol art', () => {
    expect(asciiConfidence('text art pattern')).toBe(0.75);
    expect(asciiConfidence('character art banner')).toBe(0.75);
    expect(asciiConfidence('glyph composition')).toBe(0.75);
    expect(asciiConfidence('symbol art frame')).toBe(0.75);
  });

  it('returns 0.65 for art+text and text+pattern', () => {
    expect(asciiConfidence('art made of text')).toBe(0.65);
    expect(asciiConfidence('text pattern design')).toBe(0.65);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(asciiConfidence('shader with glow')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(asciiConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// textgenConfidence
// ---------------------------------------------------------------------------
describe('textgenConfidence', () => {
  it('returns 0.95 for concrete poetry', () => {
    expect(textgenConfidence('concrete poetry layout')).toBe(0.95);
  });

  it('returns 0.95 for word art', () => {
    expect(textgenConfidence('word art generator')).toBe(0.95);
  });

  it('returns 0.95 for typographic art', () => {
    expect(textgenConfidence('typographic art piece')).toBe(0.95);
  });

  it('returns 0.95 for text generative', () => {
    expect(textgenConfidence('text generative composition')).toBe(0.95);
  });

  it('returns 0.95 for experimental poetry', () => {
    expect(textgenConfidence('experimental poetry visual')).toBe(0.95);
  });

  it('returns 0.90 for poem+visual/poetry+shape', () => {
    expect(textgenConfidence('a poem with visual shape')).toBe(0.90);
    expect(textgenConfidence('poetry in shape form')).toBe(0.90);
  });

  it('returns 0.90 for words+arranged/scattered/cascade/flow/drip', () => {
    expect(textgenConfidence('words arranged in a spiral')).toBe(0.90);
    expect(textgenConfidence('words scattered across canvas')).toBe(0.90);
    expect(textgenConfidence('words cascade animation')).toBe(0.90);
    expect(textgenConfidence('words flow pattern')).toBe(0.90);
    expect(textgenConfidence('words drip effect')).toBe(0.90);
  });

  it('returns 0.85 for typography followed by experimental/creative/art', () => {
    expect(textgenConfidence('typography experimental design')).toBe(0.85);
    expect(textgenConfidence('typography creative poster')).toBe(0.85);
    expect(textgenConfidence('typography art wall')).toBe(0.85);
  });

  it('returns 0.80 for text only/based art', () => {
    expect(textgenConfidence('text only art composition')).toBe(0.80);
    expect(textgenConfidence('text based art composition')).toBe(0.80);
  });

  it('returns 0.75 for letter+form/shape/pattern', () => {
    expect(textgenConfidence('letter form design')).toBe(0.75);
    expect(textgenConfidence('letters in a pattern')).toBe(0.75);
  });

  it('returns 0 when prompt contains ascii (defers to ascii generator)', () => {
    expect(textgenConfidence('ascii art letters')).toBe(0);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(textgenConfidence('shader noise texture')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(textgenConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// p5Confidence
// ---------------------------------------------------------------------------
describe('p5Confidence', () => {
  it('returns 0.95 for explicit p5 mentions', () => {
    expect(p5Confidence('build a p5.js sketch')).toBe(0.95);
    expect(p5Confidence('p5js particle sketch')).toBe(0.95);
  });

  it('returns 0.95 for processing mention', () => {
    expect(p5Confidence('processing sketch with noise')).toBe(0.95);
  });

  it('returns 0.9 for explicit lifecycle api mentions', () => {
    expect(p5Confidence('use createCanvas and draw()')).toBe(0.9);
  });

  it('returns 0.75 for explicit sketch/canvas art prompts', () => {
    expect(p5Confidence('interactive sketch art')).toBe(0.75);
    expect(p5Confidence('canvas generative art')).toBe(0.75);
  });

  it('returns 0 for vague requests so ambiguity handling can run', () => {
    expect(p5Confidence('make it cooler')).toBe(0);
    expect(p5Confidence('something interesting')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// strudelConfidence
// ---------------------------------------------------------------------------
describe('strudelConfidence', () => {
  it('returns 0.95 for strudel keyword', () => {
    expect(strudelConfidence('strudel pattern')).toBe(0.95);
  });

  it('returns 0.95 for tidal keyword', () => {
    expect(strudelConfidence('tidal cycles rhythm')).toBe(0.95);
  });

  it('returns 0.95 for live coding music', () => {
    expect(strudelConfidence('live coding music session')).toBe(0.95);
  });

  it('returns 0.85 for techno/drum/beat/rhythm/sequencer/pattern + music', () => {
    expect(strudelConfidence('techno music pattern')).toBe(0.85);
    expect(strudelConfidence('drum music loop')).toBe(0.85);
    expect(strudelConfidence('beat music generator')).toBe(0.85);
    expect(strudelConfidence('rhythm music sequencer')).toBe(0.85);
    expect(strudelConfidence('sequencer music app')).toBe(0.85);
    expect(strudelConfidence('pattern music generator')).toBe(0.85);
  });

  it('returns 0.75 for cycle/note/chord/melody+sequence', () => {
    expect(strudelConfidence('cycle sequence')).toBe(0.75);
    expect(strudelConfidence('note sequence pattern')).toBe(0.75);
    expect(strudelConfidence('chord sequence')).toBe(0.75);
    expect(strudelConfidence('melody sequence generator')).toBe(0.75);
  });

  it('returns 0.65 for pattern/beat/drum/bass/synth+sequence', () => {
    expect(strudelConfidence('a cool pattern')).toBe(0.65);
    expect(strudelConfidence('heavy beat')).toBe(0.65);
    expect(strudelConfidence('drum pattern')).toBe(0.65);
    expect(strudelConfidence('bass line')).toBe(0.65);
    expect(strudelConfidence('synth sequence loop')).toBe(0.65);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(strudelConfidence('html portfolio page')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(strudelConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// hydraConfidence
// ---------------------------------------------------------------------------
describe('hydraConfidence', () => {
  it('returns 0.95 for hydra keyword', () => {
    expect(hydraConfidence('hydra visual synth')).toBe(0.95);
  });

  it('returns 0.95 for video synth keyword', () => {
    expect(hydraConfidence('video synth patch')).toBe(0.95);
  });

  it('returns 0.95 for visual synthesis', () => {
    expect(hydraConfidence('visual synthesis experiment')).toBe(0.95);
  });

  it('returns 0.7 for kaleid keyword', () => {
    expect(hydraConfidence('kaleid pattern')).toBe(0.7);
  });

  it('returns 0.7 for oscillator keyword', () => {
    expect(hydraConfidence('oscillator feedback')).toBe(0.7);
  });

  it('returns 0.7 for modulate+video', () => {
    expect(hydraConfidence('modulate video effect')).toBe(0.7);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(hydraConfidence('three.js scene')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(hydraConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toneConfidence
// ---------------------------------------------------------------------------
describe('toneConfidence', () => {
  it('returns 0.95 for "tone.js" explicit mention', () => {
    expect(toneConfidence('tone.js synth pad')).toBe(0.95);
  });

  it('returns 0.95 for tonejs without dot', () => {
    expect(toneConfidence('tonejs oscillator')).toBe(0.95);
  });

  it('returns 0.95 for web audio api', () => {
    expect(toneConfidence('web audio api effect')).toBe(0.95);
  });

  it('returns 0.90 for synth+js', () => {
    expect(toneConfidence('synthesizer js library')).toBe(0.90);
    expect(toneConfidence('synth js module')).toBe(0.90);
  });

  it('returns 0.80 for bass/drone/arp/sequencer/delay/reverb', () => {
    expect(toneConfidence('bass generator')).toBe(0.80);
    expect(toneConfidence('drone ambient')).toBe(0.80);
    expect(toneConfidence('arp pattern')).toBe(0.80);
    expect(toneConfidence('sequencer step')).toBe(0.80);
    expect(toneConfidence('delay effect')).toBe(0.80);
    expect(toneConfidence('reverb tail')).toBe(0.80);
  });

  it('returns 0.90 for standalone synth (matches "synth" regex before generic)', () => {
    // "synth patch" matches /\bsynth\b/ which hits 0.90 line, not 0.70
    expect(toneConfidence('synth patch')).toBe(0.90);
  });

  it('returns 0.80 for bass/drone/arp/sequencer/delay/reverb', () => {
    expect(toneConfidence('bass generator')).toBe(0.80);
    expect(toneConfidence('drone ambient')).toBe(0.80);
    expect(toneConfidence('arp pattern')).toBe(0.80);
    expect(toneConfidence('sequencer step')).toBe(0.80);
    expect(toneConfidence('delay effect')).toBe(0.80);
    expect(toneConfidence('reverb tail')).toBe(0.80);
  });

  it('returns 0 for unrelated prompt', () => {
    expect(toneConfidence('ascii art banner')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(toneConfidence('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all functions are pure and return numbers in [0, 1]
// ---------------------------------------------------------------------------
describe('confidence functions return valid numeric ranges', () => {
  const functions = [
    { name: 'shader', fn: shaderConfidence },
    { name: 'three', fn: threeConfidence },
    { name: 'html', fn: htmlConfidence },
    { name: 'ascii', fn: asciiConfidence },
    { name: 'textgen', fn: textgenConfidence },
    { name: 'strudel', fn: strudelConfidence },
    { name: 'hydra', fn: hydraConfidence },
    { name: 'tone', fn: toneConfidence },
  ];

  const diversePrompts = [
    'shader GLSL fragment',
    'three.js 3d cube',
    'html portfolio dashboard',
    'ascii art text art',
    'concrete poetry word art',
    'strudel tidal music',
    'hydra video synth',
    'tone.js synth audio',
    '',
    'random unrelated prompt xyz',
    'MAKE IT LOUD AND VISUAL',
  ];

  for (const { name, fn } of functions) {
    for (const prompt of diversePrompts) {
      it(`${name}Confidence returns [0,1] for "${prompt}"`, () => {
        const result = fn(prompt);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      });
    }
  }
});
