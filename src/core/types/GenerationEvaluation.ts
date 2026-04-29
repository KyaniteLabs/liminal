export interface RenderEvidence {
  screenshotRef?: string;
  screenshot?: {
    mimeType: string;
    dataBase64: string;
    width?: number;
    height?: number;
  };
  logRef?: string;
  audio?: {
    success: boolean;
    sampleRate?: number;
    durationSeconds?: number;
    peakAmplitude?: number;
    rmsAmplitude?: number;
    error?: string;
    warningCount?: number;
  };
  video?: {
    fps?: number;
    durationSeconds?: number;
  };
  timingMs: number;
  infraUnavailable: boolean;
  candidateFailure: boolean;
}

export interface ConcreteRepairAdvice {
  issue: string;
  fix: string;
  constraint: string;
}

export interface GenerationEvaluation {
  score: number;
  confidence: number;
  failureClass: 'none' | 'render' | 'validator' | 'scorer' | 'infra';
  repairAdvice?: ConcreteRepairAdvice;
  reasoning?: string;
}
