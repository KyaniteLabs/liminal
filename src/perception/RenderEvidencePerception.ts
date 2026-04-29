import type { RenderEvidence } from '../core/types/GenerationEvaluation.js';
import {
  evaluateAudioPerception,
  evaluateTextPerception,
  evaluateVideoPerception,
  evaluateVisualPerception,
} from './HumanPerceptionGuardrails.js';
import type { PerceptionCheckResult } from './types.js';

function isAudioDomain(domain: string): boolean {
  return /audio|music|tone|strudel/i.test(domain);
}

function isVideoDomain(domain: string): boolean {
  return /video|revideo|hyperframes|cinematic/i.test(domain);
}

function isTextDomain(domain: string): boolean {
  return /text|ascii|caption|creative-writing/i.test(domain);
}

function hasVisibleScreenshot(evidence: RenderEvidence): boolean {
  return !!(evidence.screenshot && (evidence.screenshot.width ?? 0) > 0 && (evidence.screenshot.height ?? 0) > 0);
}

export function evaluateRenderEvidencePerception(
  evidence: RenderEvidence,
  domain: string,
): PerceptionCheckResult {
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
      hasVisibleFrames: hasVisibleScreenshot(evidence),
      fps: evidence.video?.fps,
      durationSeconds: evidence.video?.durationSeconds,
    });
  }

  if (isTextDomain(domain)) {
    return evaluateTextPerception({
      kind: 'text',
      text: evidence.screenshot ? 'rendered text evidence available' : '',
    });
  }

  return evaluateVisualPerception({
    kind: 'visual',
    hasVisibleContent: hasVisibleScreenshot(evidence),
  });
}
