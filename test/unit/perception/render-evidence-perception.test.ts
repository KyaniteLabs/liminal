import { describe, expect, it } from 'vitest';
import { evaluateRenderEvidencePerception } from '../../../src/perception/RenderEvidencePerception.js';
import type { RenderEvidence } from '../../../src/core/types/GenerationEvaluation.js';

describe('render evidence perception mapping', () => {
  it('treats screenshots as runtime visual visibility evidence', () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: 'abc', width: 800, height: 600 },
    };

    expect(evaluateRenderEvidencePerception(evidence, 'p5').passed).toBe(true);
    expect(evaluateRenderEvidencePerception({ timingMs: 120, infraUnavailable: false, candidateFailure: false }, 'p5').issues.map(i => i.id))
      .toContain('visual.no-visible-content');
  });

  it('maps failed audio capture in music domains to unintended silence', () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      audio: { success: false, error: 'No audio captured during render window', durationSeconds: 2 },
    };

    const result = evaluateRenderEvidencePerception(evidence, 'strudel');
    expect(result.passed).toBe(false);
    expect(result.issues.map(i => i.id)).toContain('audio.unintended-silence');
  });

  it('allows captured audible audio evidence', () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      audio: { success: true, peakAmplitude: 0.25, rmsAmplitude: 0.08, sampleRate: 44_100, durationSeconds: 2 },
    };

    expect(evaluateRenderEvidencePerception(evidence, 'tone').passed).toBe(true);
  });

  it('maps video evidence to human viewing ergonomics', () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: 'abc', width: 1280, height: 720 },
      video: { fps: 240, durationSeconds: 5 },
    };

    const result = evaluateRenderEvidencePerception(evidence, 'revideo');
    expect(result.issues.map(i => i.id)).toContain('video.fps-outside-useful-range');
  });
});
