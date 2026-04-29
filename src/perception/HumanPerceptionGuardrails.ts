import {
  HUMAN_AUDIBLE_RANGE_HZ,
  HUMAN_PERCEPTION_LAYER,
  MAX_COMFORTABLE_LINE_LENGTH,
  MAX_SAFE_FLICKER_HZ,
  MIN_CAPTION_SECONDS,
  MIN_LEGIBLE_CONTRAST_RATIO,
  MIN_LEGIBLE_FONT_SIZE_PX,
  USEFUL_FRAME_RATE_RANGE,
  USEFUL_TEMPO_BPM_RANGE,
  type AudioPerceptionInput,
  type HumanPerceptionInput,
  type PerceptionCheckResult,
  type PerceptionIssue,
  type TextPerceptionInput,
  type VideoPerceptionInput,
  type VisualPerceptionInput,
} from './types.js';

function result(issues: PerceptionIssue[]): PerceptionCheckResult {
  return {
    layer: HUMAN_PERCEPTION_LAYER,
    passed: !issues.some(issue => issue.severity === 'error'),
    issues,
  };
}

function issue(issue: PerceptionIssue): PerceptionIssue {
  return issue;
}

function outside(value: number | undefined, min: number, max: number): boolean {
  return value !== undefined && (value < min || value > max);
}

function addFlickerIssue(issues: PerceptionIssue[], domain: 'visual' | 'video', value?: number): void {
  if (value !== undefined && value > MAX_SAFE_FLICKER_HZ) {
    issues.push(issue({
      id: `${domain}.flicker-risk`,
      message: `Flicker above ${MAX_SAFE_FLICKER_HZ}Hz can be uncomfortable or unsafe for humans.`,
      severity: 'error',
      domain,
      metric: 'flickerHz',
      value,
    }));
  }
}

export function evaluateVisualPerception(input: VisualPerceptionInput): PerceptionCheckResult {
  const issues: PerceptionIssue[] = [];

  if (input.hasVisibleContent === false) {
    issues.push(issue({
      id: 'visual.no-visible-content',
      message: 'Visual output should contain visible content for human viewers.',
      severity: 'error',
      domain: 'visual',
      metric: 'hasVisibleContent',
      value: false,
    }));
  }

  if (input.contrastRatio !== undefined && input.contrastRatio < MIN_LEGIBLE_CONTRAST_RATIO) {
    issues.push(issue({
      id: 'visual.low-contrast',
      message: `Contrast below ${MIN_LEGIBLE_CONTRAST_RATIO}:1 may be hard for humans to perceive.`,
      severity: 'warning',
      domain: 'visual',
      metric: 'contrastRatio',
      value: input.contrastRatio,
    }));
  }

  if (outside(input.frameRate, USEFUL_FRAME_RATE_RANGE.min, USEFUL_FRAME_RATE_RANGE.max)) {
    issues.push(issue({
      id: 'visual.frame-rate-outside-useful-range',
      message: `Frame rates outside ${USEFUL_FRAME_RATE_RANGE.min}-${USEFUL_FRAME_RATE_RANGE.max}fps are usually not useful for human perception.`,
      severity: 'warning',
      domain: 'visual',
      metric: 'frameRate',
      value: input.frameRate,
    }));
  }

  addFlickerIssue(issues, 'visual', input.flickerHz ?? input.motionHz);
  return result(issues);
}

export function evaluateAudioPerception(input: AudioPerceptionInput): PerceptionCheckResult {
  const issues: PerceptionIssue[] = [];
  const frequencies = [input.frequencyHz, input.minFrequencyHz, input.maxFrequencyHz].filter(
    (value): value is number => value !== undefined,
  );

  if (input.isSilent === true && input.allowSilence !== true) {
    issues.push(issue({
      id: 'audio.unintended-silence',
      message: 'Audio output is silent without an explicit silence intent.',
      severity: 'error',
      domain: 'audio',
      metric: 'isSilent',
      value: true,
    }));
  }

  if (frequencies.some(value => outside(value, HUMAN_AUDIBLE_RANGE_HZ.min, HUMAN_AUDIBLE_RANGE_HZ.max))) {
    issues.push(issue({
      id: 'audio.frequency-outside-human-range',
      message: `Audio frequencies should stay within the human-audible ${HUMAN_AUDIBLE_RANGE_HZ.min}-${HUMAN_AUDIBLE_RANGE_HZ.max}Hz range unless intentionally silent or inaudible.`,
      severity: 'error',
      domain: 'audio',
      metric: 'frequencyHz',
      value: frequencies.join(','),
    }));
  }

  if (outside(input.tempoBpm, USEFUL_TEMPO_BPM_RANGE.min, USEFUL_TEMPO_BPM_RANGE.max)) {
    issues.push(issue({
      id: 'audio.tempo-outside-human-useful-range',
      message: `Tempo outside ${USEFUL_TEMPO_BPM_RANGE.min}-${USEFUL_TEMPO_BPM_RANGE.max} BPM is usually not musically interpretable by humans.`,
      severity: 'warning',
      domain: 'audio',
      metric: 'tempoBpm',
      value: input.tempoBpm,
    }));
  }

  if (input.peakAmplitude !== undefined && input.peakAmplitude > 1) {
    issues.push(issue({
      id: 'audio.clipping-risk',
      message: 'Peak amplitude above 1.0 can clip and become uncomfortable.',
      severity: 'warning',
      domain: 'audio',
      metric: 'peakAmplitude',
      value: input.peakAmplitude,
    }));
  }

  return result(issues);
}

export function evaluateTextPerception(input: TextPerceptionInput): PerceptionCheckResult {
  const issues: PerceptionIssue[] = [];

  if (input.contrastRatio !== undefined && input.contrastRatio < MIN_LEGIBLE_CONTRAST_RATIO) {
    issues.push(issue({
      id: 'text.low-contrast',
      message: `Text contrast below ${MIN_LEGIBLE_CONTRAST_RATIO}:1 is difficult to read.`,
      severity: 'error',
      domain: 'text',
      metric: 'contrastRatio',
      value: input.contrastRatio,
    }));
  }

  if (input.fontSizePx !== undefined && input.fontSizePx < MIN_LEGIBLE_FONT_SIZE_PX) {
    issues.push(issue({
      id: 'text.font-too-small',
      message: `Text below ${MIN_LEGIBLE_FONT_SIZE_PX}px is usually too small for comfortable reading.`,
      severity: 'warning',
      domain: 'text',
      metric: 'fontSizePx',
      value: input.fontSizePx,
    }));
  }

  if (input.captionSeconds !== undefined && input.captionSeconds < MIN_CAPTION_SECONDS) {
    issues.push(issue({
      id: 'text.caption-too-fast',
      message: `Captions shown for less than ${MIN_CAPTION_SECONDS}s can be too fast to read.`,
      severity: 'error',
      domain: 'text',
      metric: 'captionSeconds',
      value: input.captionSeconds,
    }));
  }

  if (input.lineLength !== undefined && input.lineLength > MAX_COMFORTABLE_LINE_LENGTH) {
    issues.push(issue({
      id: 'text.line-too-long',
      message: `Lines longer than ${MAX_COMFORTABLE_LINE_LENGTH} characters reduce reading comfort.`,
      severity: 'warning',
      domain: 'text',
      metric: 'lineLength',
      value: input.lineLength,
    }));
  }

  return result(issues);
}

export function evaluateVideoPerception(input: VideoPerceptionInput): PerceptionCheckResult {
  const issues: PerceptionIssue[] = [];

  if (input.hasVisibleFrames === false) {
    issues.push(issue({
      id: 'video.no-visible-frames',
      message: 'Video output should contain visible frames for human viewers.',
      severity: 'error',
      domain: 'video',
      metric: 'hasVisibleFrames',
      value: false,
    }));
  }

  if (outside(input.fps, USEFUL_FRAME_RATE_RANGE.min, USEFUL_FRAME_RATE_RANGE.max)) {
    issues.push(issue({
      id: 'video.fps-outside-useful-range',
      message: `FPS outside ${USEFUL_FRAME_RATE_RANGE.min}-${USEFUL_FRAME_RATE_RANGE.max} is usually not useful for human viewing.`,
      severity: 'warning',
      domain: 'video',
      metric: 'fps',
      value: input.fps,
    }));
  }

  if (input.durationSeconds !== undefined && input.durationSeconds <= 0) {
    issues.push(issue({
      id: 'video.non-positive-duration',
      message: 'Video duration must be positive to be perceivable.',
      severity: 'error',
      domain: 'video',
      metric: 'durationSeconds',
      value: input.durationSeconds,
    }));
  }

  if (input.captionSeconds !== undefined && input.captionSeconds < MIN_CAPTION_SECONDS) {
    issues.push(issue({
      id: 'video.caption-too-fast',
      message: `Captions shown for less than ${MIN_CAPTION_SECONDS}s can be too fast to read.`,
      severity: 'error',
      domain: 'video',
      metric: 'captionSeconds',
      value: input.captionSeconds,
    }));
  }

  addFlickerIssue(issues, 'video', input.flickerHz);
  return result(issues);
}

function extractNumber(code: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(code);
    if (match?.[1]) return Number(match[1]);
  }
  return undefined;
}

function extractTempoBpm(code: string): number | undefined {
  const explicitBpm = extractNumber(code, [/(?:tempo|bpm)\s*[:=]\s*(\d+(?:\.\d+)?)/i]);
  if (explicitBpm !== undefined) return explicitBpm;

  const cyclesPerSecond = extractNumber(code, [/setcps\s*\(\s*(\d+(?:\.\d+)?)/i]);
  return cyclesPerSecond === undefined ? undefined : cyclesPerSecond * 60;
}

function isAudioDomain(domain?: string): boolean {
  return /audio|music|tone|strudel/i.test(domain ?? '');
}

function isVideoDomain(domain?: string): boolean {
  return /video|revideo|hyperframes|cinematic/i.test(domain ?? '');
}

export function evaluateCodePerception(code: string, domain?: string): PerceptionCheckResult {
  const text = code.trim();
  if (isAudioDomain(domain)) {
    return evaluateAudioPerception({
      kind: 'audio',
      isSilent: text.length === 0,
      frequencyHz: extractNumber(text, [
        /(?:frequency|freq|hz)\s*[:=]\s*(\d+(?:\.\d+)?)/i,
        /(?:sine|saw|square|triangle)\s*\(\s*(\d+(?:\.\d+)?)/i,
      ]),
      tempoBpm: extractTempoBpm(text),
    });
  }

  if (isVideoDomain(domain)) {
    return evaluateVideoPerception({
      kind: 'video',
      hasVisibleFrames: text.length > 0,
      fps: extractNumber(text, [/fps\s*[:=]\s*(\d+(?:\.\d+)?)/i]),
      flickerHz: extractNumber(text, [/flicker(?:Hz)?\s*[:=]\s*(\d+(?:\.\d+)?)/i]),
    });
  }

  return evaluateVisualPerception({
    kind: 'visual',
    hasVisibleContent: text.length > 0,
    frameRate: extractNumber(text, [/frameRate\s*\(\s*(\d+(?:\.\d+)?)/i]),
    flickerHz: extractNumber(text, [/flicker(?:Hz)?\s*[:=]\s*(\d+(?:\.\d+)?)/i]),
  });
}


export function evaluateHumanPerception(input: HumanPerceptionInput): PerceptionCheckResult {
  switch (input.kind) {
    case 'visual':
      return evaluateVisualPerception(input);
    case 'audio':
      return evaluateAudioPerception(input);
    case 'text':
      return evaluateTextPerception(input);
    case 'video':
      return evaluateVideoPerception(input);
  }
}
