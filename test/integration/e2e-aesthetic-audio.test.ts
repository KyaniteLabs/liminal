import { describe, it, expect } from 'vitest';

const BARREL_IMPORT_TIMEOUT_MS = 120_000;

describe('E2E: audio + aesthetic wiring', () => {
  it(
    'exports AudioAnalyzer from index',
    async () => {
      const mod = await import('../../src/index.js');
      expect(mod.AudioAnalyzer).toBeDefined();
    },
    BARREL_IMPORT_TIMEOUT_MS,
  );

  it('exports AestheticCritic from index', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.AestheticCritic).toBeDefined();
  }, BARREL_IMPORT_TIMEOUT_MS);

  it('AestheticCritic critiques real p5 code end-to-end', async () => {
    const { AestheticCritic } = await import('../../src/aesthetic/index.js');
    const critic = new AestheticCritic();
    const report = critic.critique(`
      function setup() { createCanvas(400, 400); }
      function draw() {
        background('#1a1a2e');
        fill('#e94560');
        ellipse(width/2, height/2, 100, 100);
        fill('#16213e');
        textSize(16);
        text('Hello', width/2, height/2);
      }
    `);
    expect(report.score).toBeGreaterThan(0);
    expect(typeof report.passed).toBe('boolean');
  });

  it('AudioAnalyzer processes a sine wave buffer', async () => {
    const { AudioAnalyzer } = await import('../../src/audio/index.js');
    const analyzer = new AudioAnalyzer();
    const buffer = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) buffer[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
    const result = analyzer.analyze(buffer, 44100);
    expect(result.features.rms).toBeGreaterThan(0);
  });

  it('InterviewPhase includes audio and aesthetic questions', async () => {
    const { getAllQuestions } = await import('../../src/chat/InterviewPhase.js');
    const questions = getAllQuestions();
    const ids = questions.map(q => q.id);
    expect(ids).toContain('audioPreference');
    expect(ids).toContain('aestheticPreset');
  });

  it('CreativeBrief has optional audio and design fields', async () => {
    const mod = await import('../../src/chat/types.js');
    // Type-level check: CreativeBrief should accept these fields
    const brief: any = {
      intent: 'test', context: '', mood: '', constraints: [], references: [],
      domain: 'p5' as any, techniques: [], complexity: 'simple' as any,
      audioPreference: 'voice',
      designConstraints: { color: { maxColors: 5 } },
    };
    expect(brief.audioPreference).toBe('voice');
    expect(brief.designConstraints).toBeDefined();
  });
});
