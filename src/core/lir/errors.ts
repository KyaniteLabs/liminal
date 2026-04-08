/**
 * LIR-specific error classes.
 *
 * These errors follow the same pattern as LLM errors in src/llm/LLMClient.ts,
 * with public readonly properties for error details.
 */

/**
 * Base error for LIR parsing issues.
 */
export class LIRParseError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly line?: number,
    options?: { cause?: Error },
  ) {
    super(message, options);
    this.name = 'LIRParseError';
  }
}

/**
 * Error for failures during LIR summary operations.
 */
export class LIRSummaryError extends Error {
  constructor(
    message: string,
    public readonly tokenIds: number[],
  ) {
    super(message);
    this.name = 'LIRSummaryError';
  }
}
