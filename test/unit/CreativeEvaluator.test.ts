import { describe, it, expect } from 'vitest';
/**
 * CreativeEvaluator unit tests
 */

import { CreativeEvaluator } from '../../src/core/CreativeEvaluator.js';

describe('CreativeEvaluator', () => {
  describe('assess', () => {
    it('should reject non-string input', () => {
      const result = CreativeEvaluator.assess(42);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContain('Invalid output type');
    });

    it('should reject empty string', () => {
      const result = CreativeEvaluator.assess('');
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Empty output');
    });

    it('should reject whitespace-only string', () => {
      const result = CreativeEvaluator.assess('   ');
      expect(result.passed).toBe(false);
    });

    it('should detect missing setup() and draw()', () => {
      const result = CreativeEvaluator.assess('console.log("hello")');
      expect(result.issues).toContain('Missing setup() function');
      expect(result.issues).toContain('Missing draw() function');
    });

    it('should pass valid p5.js sketch', () => {
      const code = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
  fill(255, 0, 0);
  ellipse(200, 200, 50, 50);
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
      expect(result.technicalScore).toBeGreaterThan(0);
    });

    it('should detect animation usage', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { ellipse(frameCount * 2, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.usesAnimation).toBe(true);
    });

    it('should detect color usage', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { fill(255, 0, 0); rect(0, 0, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.usesColor).toBe(true);
    });

    it('should detect interactivity', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { ellipse(mouseX, mouseY, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      expect(result.metrics.hasInteractivity).toBe(true);
    });
  });

  describe('evaluationCriteria', () => {
    it('should use default scoring when no criteria provided', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); ellipse(200, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code);
      // Default: technicalScore * 0.6 + creativeScore * 0.4
      expect(result.score).toBeGreaterThan(0);
    });

    it('should average provided criteria', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() { background(220); ellipse(200, 200, 50, 50); }`;
      const result = CreativeEvaluator.assess(code, {
        evaluationCriteria: ['technical', 'novelty'],
      });
      expect(result.score).toBeGreaterThan(0);
    });

    it('should calculate emergence score', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() {
  for (let i = 0; i < particles.length; i++) {
    particles[i].update(velocity, acceleration);
  }
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.emergenceScore).toBeGreaterThan(0);
    });

    it('should calculate interestingness score', () => {
      const code = `function setup() { createCanvas(400, 400); }
function draw() {
  fill(255, 0, 0);
  rect(0, 0, 50, 50);
  fill(0, 255, 0);
  ellipse(200, 200, 50, 50);
  triangle(100, 100, 150, 100);
}`;
      const result = CreativeEvaluator.assess(code);
      expect(result.interestingnessScore).toBeGreaterThan(0);
    });
  });

  describe('getFitness', () => {
    it('should return score and issues', () => {
      const result = CreativeEvaluator.getFitness('invalid');
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('shader detection', () => {
    it('should detect GLSL shader code', () => {
      const code = `precision highp float;
void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }`;
      expect(CreativeEvaluator.detectsShaderUsage(code)).toBe(true);
    });

    it('should detect Three.js code', () => {
      const code = `import * as THREE from 'three';
const scene = new THREE.Scene();`;
      expect(CreativeEvaluator.detectsThreeUsage(code)).toBe(true);
    });

    it('should evaluate Revideo scene code without falling back to p5 issues', () => {
      const code = `import {makeScene2D, Txt} from '@revideo/2d';
import {createRef} from '@revideo/core';

export default makeScene2D("PreviewScene", function* (view) {
  const title = createRef();
  view.add(<Txt ref={title} text="Hello Revideo" />);
  yield* title().opacity(1, 0.6);
});`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
    });

    it('should evaluate Revideo scene code with specialized video scoring', () => {
      const code = `import { makeScene, useTime, createSignal } from '@revideo/core';
import { Txt, Rect, Circle } from '@revideo/2d';

export default makeScene('TypingText', function* (view) {
  const opacity = createSignal(0);
  view.add(
    <Rect layout size={400} fill={'black'}>
      <Txt text={'Hello Video'} opacity={opacity} fontSize={48} fill={'white'} />
    </Rect>
  );
  yield* opacity(1, 1);
});`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.issues).not.toContain('Missing setup() function');
      expect(result.issues).not.toContain('Missing draw() function');
    });

    it('should keep obviously broken video-component code below the pass threshold', () => {
      const code = `import { makeScene } from '@revideo/core';

export default makeScene('BrokenComp', function* (view) {
  const frame = frame.value;
  yield* view.add(<Video />);
});`;
      const result = CreativeEvaluator.assess(code, { domain: 'revideo' });
      expect(result.score).toBeLessThan(0.7);
    });

    it('should evaluate raw multiline ASCII art as an artifact instead of code', () => {
      const art = `
        .    *         .       .    *    .          .
           *         .    *         .          .    *         .
                .          .    *         .          .    *     .
             .         *          .    *         .          .       *
                  *         .          .    *         .
                 /\\
                /  \\
               /____\\
              | [] [] |
              |  __  |
              |______|
      `;
      const result = CreativeEvaluator.assess(art, { domain: 'ascii' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.issues).not.toContain('Missing ASCII art characters');
    });

    it('should keep ascii error placeholders below the pass threshold', () => {
      const errorPlaceholder = '// LLM generation failed: LLM API error: 400 Bad Request';
      const result = CreativeEvaluator.assess(errorPlaceholder, { domain: 'ascii' });
      expect(result.score).toBeLessThan(0.7);
    });

    it('should evaluate a simple valid Strudel pattern as music', () => {
      const pattern = `s("bd hh sd hh hh hh hh hh")`;
      const result = CreativeEvaluator.assess(pattern, { domain: 'music' });
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.creativeScore).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0.6);
      expect(result.issues).not.toContain('No code detected in output');
    });

    it('should evaluate stacked Strudel patterns as music', () => {
      const pattern = `$: s("bd*4").gain(0.9)\n$: s("~ cp ~ cp").gain(0.7)`;
      const result = CreativeEvaluator.assess(pattern, { domain: 'music' });
      expect(result.score).toBeGreaterThanOrEqual(0.6);
    });

    it('should pass a richer multiline Strudel groove', () => {
      const pattern = `s("bd*4")\ns("~ ~ sn ~")\ns("hh*8")\ns("sub ~ sub ~")`;
      const result = CreativeEvaluator.assess(pattern, { domain: 'music' });
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });

    it('should keep obviously invalid Strudel placeholders below the pass threshold', () => {
      const pattern = `s(100)`;
      const result = CreativeEvaluator.assess(pattern, { domain: 'music' });
      expect(result.score).toBeLessThan(0.7);
    });

    it('should pass a substantial landing page as html', () => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Creative Code Portfolio</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; }
    header { position: sticky; top: 0; }
    .hero { min-height: 80vh; background: linear-gradient(135deg, #111, #333); }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .card { border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,.2); transition: transform .3s; }
    .card:hover { transform: translateY(-4px); }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .hero h1 { animation: fadeUp .8s ease-out both; }
  </style>
</head>
<body>
  <header><nav><a href="#work">Work</a><a href="#contact">Contact</a></nav></header>
  <main>
    <section class="hero">
      <h1>Generative Portfolio</h1>
      <p>Interactive experiments and digital art.</p>
      <button onclick="document.getElementById('work').scrollIntoView()">See Work</button>
    </section>
    <section id="work" class="grid">
      <article class="card">Sketch 1</article>
      <article class="card">Sketch 2</article>
      <article class="card">Sketch 3</article>
    </section>
  </main>
</body>
</html>`;
      const result = CreativeEvaluator.assess(html, { domain: 'html' });
      expect(result.technicalScore).toBeGreaterThan(0.6);
      expect(result.creativeScore).toBeGreaterThan(0.5);
      expect(result.score).toBeGreaterThanOrEqual(0.7);
      expect(result.issues).not.toContain('Missing <body> tag');
    });

    it('should keep html error placeholders below the pass threshold', () => {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Generated Page</title>
  <style>body { font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <h1>Generated Page</h1>
  <p>// LLM generation failed: LLM API error: 404 Not Found</p>
</body>
</html>`;
      const result = CreativeEvaluator.assess(html, { domain: 'html' });
      expect(result.score).toBeLessThan(0.7);
    });

    it('should pass a valid Tone.js synth patch', () => {
      const code = `const reverb = new Tone.Reverb({ decay: 12, wet: 0.8 }).toDestination();
const filter = new Tone.Filter(800, 'lowpass').connect(reverb);
const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sine' },
  envelope: { attack: 2, decay: 1, sustain: 0.6, release: 8 }
}).connect(filter);

Tone.Transport.start();
synth.triggerAttackRelease(['C2', 'G2', 'D3'], '4n');`;
      const result = CreativeEvaluator.assess(code, { domain: 'tone' });
      expect(result.technicalScore).toBeGreaterThan(0.6);
      expect(result.creativeScore).toBeGreaterThan(0.4);
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });

    it('should pass a valid Tone.js HTML wrapper page', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Ambient Drone</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
</head>
<body>
  <button id="start">Start Drone</button>
  <script>
    document.getElementById("start").addEventListener("click", async () => {
      await Tone.start();
      Tone.Transport.start();
      const reverb = new Tone.Reverb({ decay: 12, wet: 0.8 }).toDestination();
      const chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 10, depth: 1, wet: 0.3 }).start().connect(reverb);
      const drone = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 4, decay: 1, sustain: 0.8, release: 10 }
      }).connect(chorus);
      drone.triggerAttackRelease(["C1","G1","D2"], "8n");
    });
  </script>
</body>
</html>`;
      const result = CreativeEvaluator.assess(html, { domain: 'tone' });
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });

    it('should pass an ambient drone Tone.js page driven by oscillators and LFOs', () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <title>Ambient Drone</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
</head>
<body>
<script>
(async () => {
  await Tone.start();
  const reverb = new Tone.Reverb({ decay: 15, wet: 0.9 }).toDestination();
  const filter = new Tone.Filter(300, 'lowpass').toDestination();
  const osc1 = new Tone.Oscillator('C2', 'sine').connect(filter);
  const osc2 = new Tone.Oscillator('G2', 'sine').connect(filter);
  const osc3 = new Tone.Oscillator('C3', 'sine').connect(filter);
  const gain = new Tone.Gain(0.4).connect(reverb);
  const lfo = new Tone.LFO({ frequency: 0.1, min: 0.3, max: 1 }).start();
  lfo.connect(gain.gain);
  osc1.connect(gain); osc2.connect(gain); osc3.connect(gain);
  osc1.start(); osc2.start(); osc3.start();
})();
</script>
</body>
</html>`;
      const result = CreativeEvaluator.assess(html, { domain: 'tone' });
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });

    it('should keep tone error placeholders below the pass threshold', () => {
      const html = `<!DOCTYPE html><html><head><title>ERROR</title></head><body><h1>❌ tone × model</h1><p>ToneGenerator: Generated code does not use Tone.js</p></body></html>`;
      const result = CreativeEvaluator.assess(html, { domain: 'tone' });
      expect(result.score).toBeLessThan(0.7);
    });
  });
});
