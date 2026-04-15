export interface RenderEvidence {
  screenshotRef?: string;
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
}
