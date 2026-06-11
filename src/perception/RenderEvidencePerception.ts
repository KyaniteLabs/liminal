import type { RenderEvidence, RenderMeasure } from '../core/types/GenerationEvaluation.js';
import {
  evaluateAudioPerception,
  evaluateTextPerception,
  evaluateVideoPerception,
  evaluateVisualPerception,
} from './HumanPerceptionGuardrails.js';
import type { PerceptionCheckResult } from './types.js';
import { analyzeScreenshotBase64, type PixelVisibilityAnalysis } from '../render/DecodedImageVisibility.js';
import { verdictFromMeasure } from '../render/LuminanceVerdict.js';

function isAudioDomain(domain: string): boolean {
  return /audio|music|tone|strudel/i.test(domain);
}

function isVideoDomain(domain: string): boolean {
  return /video|revideo|hyperframes|cinematic/i.test(domain);
}

function isTextDomain(domain: string): boolean {
  return /text|ascii|caption|creative-writing/i.test(domain);
}

function cacheRenderMeasure(evidence: RenderEvidence, measure: RenderMeasure): RenderMeasure {
  evidence.renderMeasure = measure;
  return measure;
}

function measureFromVisibility(visibility: PixelVisibilityAnalysis): RenderMeasure | undefined {
  if (visibility.sampledPixels === 0 || visibility.reason?.startsWith('decoded image data unavailable')) return undefined;
  return {
    verdict: verdictFromMeasure(visibility),
    meanLuminance: visibility.meanLuminance,
    brightFraction: visibility.brightFraction,
    darkFraction: visibility.darkFraction,
    // LuminanceMeasure documents brightnessStd on the 0..255 luma scale — the
    // same scale verdictFromMeasure consumes above. Normalizing here (FAB-021)
    // made persisted archive measures contradict the calibrated thresholds.
    brightnessStd: visibility.brightnessStd,
  };
}

export async function measureRenderEvidence(evidence: RenderEvidence): Promise<RenderMeasure | undefined> {
  if (evidence.renderMeasure) return evidence.renderMeasure;
  if (!evidence.screenshot || (evidence.screenshot.width ?? 0) <= 0 || (evidence.screenshot.height ?? 0) <= 0) {
    return undefined;
  }
  const visibility = await analyzeScreenshotBase64(evidence.screenshot.dataBase64);
  const measure = measureFromVisibility(visibility);
  if (!measure) return undefined;

  // H13: when a late frame exists it is authoritative — it is the steady state
  // a viewer actually sees (animated shaders decay to black after capture, and
  // slow-starting sketches paint after a blank first frame). temporalDecay
  // marks the ok→non-ok transition for scoring and audits.
  if (evidence.lateScreenshot && (evidence.lateScreenshot.width ?? 0) > 0 && (evidence.lateScreenshot.height ?? 0) > 0) {
    const lateVisibility = await analyzeScreenshotBase64(evidence.lateScreenshot.dataBase64);
    const lateMeasure = measureFromVisibility(lateVisibility);
    if (lateMeasure) {
      if (lateMeasure.verdict !== 'ok' && measure.verdict === 'ok') {
        lateMeasure.temporalDecay = true;
      }
      return cacheRenderMeasure(evidence, lateMeasure);
    }
  }
  return cacheRenderMeasure(evidence, measure);
}

async function hasVisibleScreenshot(evidence: RenderEvidence): Promise<boolean> {
  if (!evidence.screenshot || (evidence.screenshot.width ?? 0) <= 0 || (evidence.screenshot.height ?? 0) <= 0) {
    return false;
  }
  const visibility = await analyzeScreenshotBase64(evidence.screenshot.dataBase64);
  const measure = measureFromVisibility(visibility);
  if (measure) cacheRenderMeasure(evidence, measure);
  return visibility.hasVisibleContent;
}

export async function evaluateRenderEvidencePerception(
  evidence: RenderEvidence,
  domain: string,
): Promise<PerceptionCheckResult> {
  if (isAudioDomain(domain)) {
    return evaluateAudioPerception({
      kind: 'audio',
      isSilent: evidence.audio ? !evidence.audio.success || (evidence.audio.rmsAmplitude ?? 0) === 0 : true,
      peakAmplitude: evidence.audio?.peakAmplitude,
    });
  }

  if (isVideoDomain(domain)) {
    return evaluateVideoPerception({
      kind: 'video',
      hasVisibleFrames: await hasVisibleScreenshot(evidence),
      fps: evidence.video?.fps,
      durationSeconds: evidence.video?.durationSeconds,
    });
  }

  if (isTextDomain(domain)) {
    const hasVisibleTextEvidence = await hasVisibleScreenshot(evidence);
    return evaluateTextPerception({
      kind: 'text',
      text: hasVisibleTextEvidence ? 'rendered text evidence available' : '',
    });
  }

  return evaluateVisualPerception({
    kind: 'visual',
    hasVisibleContent: await hasVisibleScreenshot(evidence),
  });
}
