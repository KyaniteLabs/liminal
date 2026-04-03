export interface Iteration {
  id: number;
  code: string;
  timestamp: number;
  quality?: number;
  reason?: string;
  /** Score from CreativeEvaluator (0–1); used in iteration timeline */
  score?: number;
  /** True when PromiseDetector detected completion promise in this iteration */
  promiseDetected?: boolean;
}
