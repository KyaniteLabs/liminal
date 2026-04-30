import { LLMGenerationError } from '../errors/LLMGenerationError.js';
import { LLMError } from './errors.js';

export interface LLMErrorProvenance {
  provider?: string;
  model?: string;
  endpoint?: string;
  statusCode?: number;
  retryable?: boolean;
  responseBody?: string;
}

export function extractLLMErrorProvenance(error: unknown): LLMErrorProvenance {
  if (error instanceof LLMGenerationError) {
    return compact({
      provider: error.provider,
      model: error.model,
      endpoint: error.endpoint,
      statusCode: error.statusCode,
      retryable: error.retryable,
      responseBody: error.responseBody,
      ...extractLLMErrorProvenance(error.cause),
    });
  }
  if (error instanceof LLMError) {
    return compact({
      provider: error.provider,
      model: error.model,
      endpoint: error.endpoint,
      statusCode: error.statusCode,
      retryable: error.retryable,
      responseBody: error.responseBody,
    });
  }
  if (error instanceof Error && 'cause' in error) {
    return extractLLMErrorProvenance((error as Error & { cause?: unknown }).cause);
  }
  return {};
}

export function compactLLMErrorProvenance(
  provenance: LLMErrorProvenance,
  fallback: LLMErrorProvenance = {},
): LLMErrorProvenance {
  return compact({
    provider: provenance.provider ?? fallback.provider,
    model: provenance.model ?? fallback.model,
    endpoint: provenance.endpoint ?? fallback.endpoint,
    statusCode: provenance.statusCode ?? fallback.statusCode,
    retryable: provenance.retryable ?? fallback.retryable,
    responseBody: provenance.responseBody ?? fallback.responseBody,
  });
}

function compact(value: LLMErrorProvenance): LLMErrorProvenance {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as LLMErrorProvenance;
}
