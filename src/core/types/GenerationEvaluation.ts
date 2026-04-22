export interface RenderEvidence {
  screenshotRef?: string;
  screenshot?: {
    mimeType: string;
    dataBase64: string;
    width?: number;
    height?: number;
  };
  logRef?: string;
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
