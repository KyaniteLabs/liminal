import { describe, expect, it } from 'vitest';
import { evaluateRenderEvidencePerception } from '../../../src/perception/RenderEvidencePerception.js';
import type { RenderEvidence } from '../../../src/core/types/GenerationEvaluation.js';

async function getSharp() {
  const mod = await import('sharp');
  return (mod.default ?? mod) as unknown as {
    (input: unknown, options?: unknown): {
      png(): { toBuffer(): Promise<Buffer> };
    };
  };
}

async function createPngBase64(kind: 'varied' | 'solid' | 'transparent'): Promise<string> {
  const sharp = await getSharp();
  const width = 8;
  const height = 8;

  if (kind === 'solid' || kind === 'transparent') {
    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: kind === 'transparent'
          ? { r: 0, g: 0, b: 0, alpha: 0 }
          : { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    return buffer.toString('base64');
  }

  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = x * 32;
      data[idx + 1] = y * 32;
      data[idx + 2] = (x + y) * 16;
      data[idx + 3] = 255;
    }
  }
  const buffer = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return buffer.toString('base64');
}

describe('render evidence perception mapping', () => {
  it('treats decoded varied screenshots as runtime visual visibility evidence', async () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: await createPngBase64('varied'), width: 8, height: 8 },
    };

    await expect(evaluateRenderEvidencePerception(evidence, 'p5')).resolves.toMatchObject({ passed: true });
    const noScreenshot = await evaluateRenderEvidencePerception({ timingMs: 120, infraUnavailable: false, candidateFailure: false }, 'p5');
    expect(noScreenshot.issues.map(i => i.id))
      .toContain('visual.no-visible-content');
  });

  it('rejects solid and transparent screenshots as invisible visual evidence', async () => {
    const solid: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: await createPngBase64('solid'), width: 8, height: 8 },
    };
    const transparent: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: await createPngBase64('transparent'), width: 8, height: 8 },
    };

    const solidResult = await evaluateRenderEvidencePerception(solid, 'p5');
    const transparentResult = await evaluateRenderEvidencePerception(transparent, 'p5');

    expect(solidResult.passed).toBe(false);
    expect(solidResult.issues.map(i => i.id)).toContain('visual.no-visible-content');
    expect(transparentResult.passed).toBe(false);
    expect(transparentResult.issues.map(i => i.id)).toContain('visual.no-visible-content');
  });

  it('maps failed audio capture in music domains to unintended silence', async () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      audio: { success: false, error: 'No audio captured during render window', durationSeconds: 2 },
    };

    const result = await evaluateRenderEvidencePerception(evidence, 'strudel');
    expect(result.passed).toBe(false);
    expect(result.issues.map(i => i.id)).toContain('audio.unintended-silence');
  });

  it('allows captured audible audio evidence', async () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      audio: { success: true, peakAmplitude: 0.25, rmsAmplitude: 0.08, sampleRate: 44_100, durationSeconds: 2 },
    };

    await expect(evaluateRenderEvidencePerception(evidence, 'tone')).resolves.toMatchObject({ passed: true });
  });

  it('maps video evidence to human viewing ergonomics', async () => {
    const evidence: RenderEvidence = {
      timingMs: 120,
      infraUnavailable: false,
      candidateFailure: false,
      screenshot: { mimeType: 'image/png', dataBase64: await createPngBase64('varied'), width: 8, height: 8 },
      video: { fps: 240, durationSeconds: 5 },
    };

    const result = await evaluateRenderEvidencePerception(evidence, 'revideo');
    expect(result.issues.map(i => i.id)).toContain('video.fps-outside-useful-range');
  });
});
