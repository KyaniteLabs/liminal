export interface ClarifyingQuestion {
  /** The question text to ask the user */
  question: string;
  /** Available options (null for free-text answer) */
  options: string[] | null;
  /** Default selection if user just hits enter */
  default: string;
}

/**
 * Result returned when generation cannot proceed without user clarification.
 */
export interface ClarifyResult {
  /** True when the prompt needs clarification before generation */
  needsClarification: true;
  clarifyingQuestions: ClarifyingQuestion[];
  /** Suggested domain names to pre-populate generator confidence */
  suggestions: string[];
}

/**
 * Successful generation result (mutually exclusive with ClarifyResult).
 */
export interface GenerationSuccess {
  needsClarification: false;
  code: string;
  thinking?: string;
  model?: string;
  recoveredFromThinking?: boolean;
  warnings?: string[];
}

/** Union type for all generation results */
export type GenerationOutcome = ClarifyResult | GenerationSuccess;
