import type { RenderEvidence } from '../core/types/GenerationEvaluation.js';
import {
  evaluateAudioPerception,
  evaluateTextPerception,
  evaluateVideoPerception,
  evaluateVisualPerception,
} from './HumanPerceptionGuardrails.js';
import type { PerceptionCheckResult } from './types.js';
import { analyzeScreenshotBase64 } from '../render/DecodedImageVisibility.js';

function isAudioDomain(domain: string): boolean {
  return /audio|music|tone|strudel/i.test(domain);
}

function isVideoDomain(domain: string): boolean {
  return /video|revideo|hyperframes|cinematic/i.test(domain);
}

function isTextDomain(domain: string): boolean {
  return /text|ascii|caption|creative-writing/i.test(domain);
}

async function hasVisibleScreenshot(evidence: RenderEvidence): Promise<boolean> {
  if (!evidence.screenshot || (evidence.screenshot.width ?? 0) <= 0 || (evidence.screenshot.height ?? 0) <= 0) {
    return false;
  }
  const visibility = await analyzeScreenshotBase64(evidence.screenshot.dataBase64);
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
