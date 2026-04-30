// ── LLM Error Hierarchy ──

export interface LLMErrorDetails {
  model?: string;
  endpoint?: string;
  statusText?: string;
  responseBody?: string;
}

const ERROR_BODY_LIMIT = 1200;

export function sanitizeLLMErrorBody(body: string, maxLength = ERROR_BODY_LIMIT): string {
  return body
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/("(?:api[_-]?key|authorization|token|secret)"\s*:\s*")[^"]+/gi, '$1[REDACTED]')
    .slice(0, maxLength);
}

export function sanitizeLLMEndpoint(endpoint: string): string {
  return endpoint.replace(/([?&](?:key|api[_-]?key|token|secret)=)[^&]+/gi, '$1[REDACTED]');
}

export class LLMError extends Error {
  public readonly model?: string;
  public readonly endpoint?: string;
  public readonly statusText?: string;
  public readonly responseBody?: string;

  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
    details: LLMErrorDetails = {},
  ) {
    super(message);
    this.name = 'LLMError';
    this.model = details.model;
    this.endpoint = details.endpoint;
    this.statusText = details.statusText;
    this.responseBody = details.responseBody;
  }
}

export async function createLLMHttpError(args: {
  provider: string;
  model: string;
  endpoint: string;
  response: Response;
  label?: string;
}): Promise<LLMError> {
  const responseBody = sanitizeLLMErrorBody(await args.response.text().catch(() => args.response.statusText));
  const retryable = args.response.status === 429 || args.response.status >= 500;
  const label = args.label ?? `${args.provider} API error`;
  return new LLMError(
    `${label} ${args.response.status}: ${responseBody}`,
    args.provider,
    args.response.status,
    retryable,
    {
      model: args.model,
      endpoint: sanitizeLLMEndpoint(args.endpoint),
      statusText: args.response.statusText,
      responseBody,
    },
  );
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string) {
    super(`Timeout calling ${provider} API`, provider, undefined, true);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(`Rate limited by ${provider} API`, provider, 429, true);
    this.name = 'LLMRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
  retryAfterSeconds?: number;
}

export class LLMAuthError extends LLMError {
  constructor(provider: string) {
    super(`Authentication failed for ${provider}`, provider, 401, false);
    this.name = 'LLMAuthError';
  }
}
