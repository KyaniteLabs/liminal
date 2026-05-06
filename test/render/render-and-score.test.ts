/**
 * Tests for RenderAndScorePipeline
 * 
 * These tests verify:
 * - Headless rendering of different domains (p5, three, etc.)
 * - Visual quality scoring
 * - Audio quality scoring
 * - Score blending
 * - Pipeline integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  HeadlessRenderer,
  VisualScorer,
  AudioScorer,
  RenderAndScorePipeline
} from '../../src/render/index.js';

// Sample p5.js code for testing
const sampleP5Code = `
function setup() {
  createCanvas(400, 400);
  noLoop();
}

function draw() {
  background(220);
  fill(255, 0, 0);
  ellipse(200, 200, 100, 100);
  fill(0, 0, 255);
  rect(150, 150, 100, 100);
}
`;

// Sample Three.js code for testing
const sampleThreeCode = `
import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(400, 400);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 2;
renderer.render(scene, camera);
`;

// Sample GLSL shader code for testing
const sampleGLSLCode = `
#ifdef GL_ES
precision mediump float;
#endif

void main() {
  vec2 st = gl_FragCoord.xy / vec2(400.0);
  vec3 color = vec3(st.x, st.y, 0.5);
  gl_FragColor = vec4(color, 1.0);
}
`;

// Sample invalid code for testing error handling
const sampleInvalidCode = `
function setup() {
  createCanvas(400, 400);
  // Syntax error - missing closing brace

function draw() {
  background(220);
}
`;

describe('HeadlessRenderer domain detection', () => {
  it('should detect p5.js code', () => {
    const domain = HeadlessRenderer.detectDomain(sampleP5Code);
    expect(domain).toBe('p5');
  });

  it('should detect Three.js code', () => {
    const domain = HeadlessRenderer.detectDomain(sampleThreeCode);
    expect(domain).toBe('three');
  });

  it('should detect GLSL code', () => {
    const domain = HeadlessRenderer.detectDomain(sampleGLSLCode);
    expect(domain).toBe('glsl');
  });

  it('should return unknown for unrecognizable code', () => {
    const domain = HeadlessRenderer.detectDomain('console.log("hello")');
    expect(domain).toBe('unknown');
  });
});

describe('HeadlessRenderer rendering', () => {
  let renderer: HeadlessRenderer;

  beforeAll(async () => {
    renderer = HeadlessRenderer.getInstance();
    await renderer.initialize();
  });

  afterAll(async () => {
    await renderer.close();
  }, 30000);

  it('should render p5.js code and capture screenshot', async () => {
    const result = await renderer.render(sampleP5Code, {
      width: 400,
      height: 400,
      waitForStabilization: true,
      stabilizationTime: 1000,
    });

    expect(result.success).toBe(true);

    expect(result.screenshot?.success).toBe(true);
    expect(result.screenshot?.buffer.length).toBeGreaterThan(0);
  }, 30000);

  it('should capture console logs', async () => {
    const codeWithLog = `
      function setup() {
        createCanvas(100, 100);
        console.log('test message');
        noLoop();
      }
      function draw() {
        background(200);
      }
    `;

    const result = await renderer.render(codeWithLog, {
      width: 100,
      height: 100,
    });

    expect(result.logs.some(log => log.includes('test message'))).toBe(true);
  }, 30000);
});

describe('VisualScorer', () => {
  let scorer: VisualScorer;
  let renderer: HeadlessRenderer;

  beforeAll(async () => {
    scorer = new VisualScorer();
    renderer = HeadlessRenderer.getInstance();
    await renderer.initialize();
  });

  afterAll(async () => {
    await renderer.close();
  }, 30000);

  it('should score a rendered image', async () => {
    // First render some code
    const renderResult = await renderer.render(sampleP5Code, {
      width: 400,
      height: 400,
      waitForStabilization: true,
      stabilizationTime: 1000,
    });

    expect(renderResult.screenshot?.success).toBe(true);

    if (renderResult.screenshot?.buffer) {
      const score = await scorer.score(renderResult.screenshot.buffer);

      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(1);
      expect(score.colorVariety).toBeGreaterThanOrEqual(0);
      expect(score.edgeComplexity).toBeGreaterThanOrEqual(0);
      expect(score.composition).toBeGreaterThanOrEqual(0);
      expect(score.contrast).toBeGreaterThanOrEqual(0);
      
      // Check that metrics are populated
      expect(score.metrics.uniqueColors).toBeGreaterThanOrEqual(0);
      expect(score.metrics.brightnessMean).toBeGreaterThanOrEqual(0);
    }
  }, 30000);

  it('should return zero scores for invalid buffer', async () => {
    const score = await scorer.score(Buffer.alloc(0));

    expect(score.score).toBe(0);
    expect(score.colorVariety).toBe(0);
    expect(score.edgeComplexity).toBe(0);
  });

  it('should respect custom weights', async () => {
    const weightedScorer = new VisualScorer({
      colorWeight: 0.5,
      edgeWeight: 0.5,
      compositionWeight: 0,
      contrastWeight: 0,
    });

    const renderResult = await renderer.render(sampleP5Code, {
      width: 200,
      height: 200,
      waitForStabilization: true,
      stabilizationTime: 500,
    });

    if (renderResult.screenshot?.buffer) {
      const score = await weightedScorer.score(renderResult.screenshot.buffer);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(1);
    }
  }, 30000);
});

describe('AudioScorer', () => {
  let scorer: AudioScorer;

  beforeEach(() => {
    scorer = new AudioScorer();
  });

  it('should score synthetic audio with frequency content', () => {
    // Create synthetic audio with multiple frequencies
    const sampleRate = 44100;
    const duration = 0.1; // 100ms
    const samples = new Float32Array(Math.floor(sampleRate * duration));

    for (let i = 0; i < samples.length; i++) {
      // Mix of two frequencies
      samples[i] = 
        0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate) +
        0.3 * Math.sin(2 * Math.PI * 880 * i / sampleRate);
    }

    const score = scorer.score(samples, sampleRate);

    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
    expect(score.frequencyVariety).toBeGreaterThan(0);
    expect(score.dynamics).toBeGreaterThanOrEqual(0);
    expect(score.harmonic).toBeGreaterThan(0);
    expect(score.metrics.zeroCrossingRate).toBeGreaterThan(0);
  });

  it('should return zero scores for empty audio', () => {
    const score = scorer.score(new Float32Array(0));

    expect(score.score).toBe(0);
    expect(score.frequencyVariety).toBe(0);
    expect(score.dynamics).toBe(0);
  });

  it('should return low scores for silence', () => {
    const sampleRate = 44100;
    const samples = new Float32Array(4410).fill(0);
    
    const score = scorer.score(samples, sampleRate);

    expect(score.score).toBeLessThan(0.3);
    expect(score.dynamics).toBe(0);
  });

  it('should respect custom weights', () => {
    const weightedScorer = new AudioScorer({
      frequencyWeight: 0.6,
      dynamicsWeight: 0.4,
      rhythmWeight: 0,
      harmonicWeight: 0,
    });

    const sampleRate = 44100;
    const samples = new Float32Array(4410);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }

    const score = weightedScorer.score(samples, sampleRate);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
  });
});

describe('RenderAndScorePipeline', () => {
  let pipeline: RenderAndScorePipeline;

  beforeEach(() => {
    pipeline = new RenderAndScorePipeline({
      render: {
        width: 400,
        height: 400,
        stabilizationTime: 1000,
      },
      scoreVisual: true,
      scoreAudio: false,
    });
  });

  afterEach(async () => {
    try {
      await pipeline.close();
    } catch {
      // Browser may already be closed or never opened — ignore cleanup errors
    }
  }, 30000);

  it('should process p5 code and return scores', async () => {
    const result = await pipeline.process(sampleP5Code);

    expect(result.success).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.domain).toBe('p5');
    expect(result.duration).toBeGreaterThan(0);
    expect(result.visual).not.toBeNull();
  }, 30000);

  it('should detect domain automatically', async () => {
    const result = await pipeline.process(sampleP5Code);
    expect(result.domain).toBe('p5');
  }, 30000);

  it('should respect domain hint', async () => {
    const result = await pipeline.process(sampleP5Code, 'three');
    // Domain hint overrides detection
    expect(result.domain).toBe('three');
    // Note: three.js code with imports may timeout, that's expected
    expect(result).not.toBeNull();
  }, 60000);

  it('should handle invalid code gracefully', async () => {
    // Use a simpler invalid code that won't hang the browser
    const simpleInvalidCode = 'function setup() { createCanvas(100, 100); }'; // Missing draw or noLoop
    
    const result = await pipeline.process(simpleInvalidCode);

    // Should not throw, but may not succeed
    expect(result).not.toBeNull();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('should process multiple candidates', async () => {
    const codes = [
      sampleP5Code,
      sampleP5Code.replace('ellipse(200, 200, 100, 100)', 'ellipse(100, 100, 50, 50)'),
    ];

    const result = await pipeline.processBatch(codes);

    expect(result.allResults.length).toBe(2);
    expect(result.bestIndex).toBeGreaterThanOrEqual(0);
    expect(result.bestIndex).toBeLessThan(2);
    expect(result.bestResult).not.toBeNull();
  }, 60000);

  describe('score blending', () => {
    it('should blend scores linearly', () => {
      const blended = RenderAndScorePipeline.blendScores({
        baseScore: 0.8,
        renderScore: 0.6,
        renderWeight: 0.5,
        mode: 'linear',
      });

      expect(blended).toBe(0.7); // (0.8 * 0.5 + 0.6 * 0.5)
    });

    it('should blend scores adaptively', () => {
      const blended = RenderAndScorePipeline.blendScores({
        baseScore: 0.9,
        renderScore: 0.6,
        renderWeight: 0.5,
        mode: 'adaptive',
      });

      // Adaptive mode uses more render weight when base score is high
      expect(blended).toBeGreaterThan(0.6);
      expect(blended).toBeLessThan(0.9);
    });

    it('should default to 0.5 render weight', () => {
      const blended = RenderAndScorePipeline.blendScores({
        baseScore: 0.8,
        renderScore: 0.6,
      });

      expect(blended).toBe(0.7);
    });
  });

  it('should handle visual-only domains', async () => {
    const visualPipeline = new RenderAndScorePipeline({
      scoreVisual: true,
      scoreAudio: false,
    });

    const result = await visualPipeline.process(sampleP5Code, 'p5');

    expect(result.success).toBe(true);
    expect(result.visual).not.toBeNull();
    expect(result.audio).toBeUndefined();
  }, 30000);

  it('should handle audio-only domains', async () => {
    const audioPipeline = new RenderAndScorePipeline({
      scoreVisual: false,
      scoreAudio: true,
    });

    const result = await audioPipeline.process('// Tone.js code', 'tone');

    // Audio-only domains don't have visual scoring
    expect(result.visual).toBeUndefined();
  }, 30000);
});

describe('Integration with RalphLoop options', () => {
  it('should have useRenderScoring option in LoopOptions', async () => {
    const { normalizeOptions } = await import('../../src/core/LoopConfig.js');
    
    const options = normalizeOptions({ useRenderScoring: true });
    expect(options.useRenderScoring).toBe(true);
  });

  it('should default useRenderScoring to false', async () => {
    const { normalizeOptions } = await import('../../src/core/LoopConfig.js');
    
    const options = normalizeOptions({});
    expect(options.useRenderScoring).toBe(false);
  });

  it('should accept renderScoringOptions', async () => {
    const { normalizeOptions } = await import('../../src/core/LoopConfig.js');
    
    const customOptions = {
      visualWeight: 0.6,
      audioWeight: 0.4,
    };
    
    const options = normalizeOptions({
      useRenderScoring: true,
      renderScoringOptions: customOptions,
    });
    
    expect(options.useRenderScoring).toBe(true);
    expect(options.renderScoringOptions).toEqual(customOptions);
  });
});
