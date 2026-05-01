import { LLMGenerationError } from '../errors/LLMGenerationError.js';
import { LLMError } from './errors.js';

export type LLMEndpointStyle = 'openai' | 'ollama' | 'anthropic';

export interface LLMRequestProvenance {
  provider?: string;
  model?: string;
  endpoint?: string;
  endpointStyle?: LLMEndpointStyle;
  fallbackUsed?: boolean;
  fallbackFrom?: string;
  fallbackTo?: string;
}

export interface LLMErrorProvenance extends LLMRequestProvenance {
  errorSource?: 'provider' | 'client' | 'network' | 'unknown';
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
      endpointStyle: error.endpointStyle,
      fallbackUsed: error.fallbackUsed,
      fallbackFrom: error.fallbackFrom,
      fallbackTo: error.fallbackTo,
      errorSource: error.errorSource,
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
      errorSource: 'provider',
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
    endpointStyle: provenance.endpointStyle ?? fallback.endpointStyle,
    fallbackUsed: provenance.fallbackUsed ?? fallback.fallbackUsed,
    fallbackFrom: provenance.fallbackFrom ?? fallback.fallbackFrom,
    fallbackTo: provenance.fallbackTo ?? fallback.fallbackTo,
    errorSource: provenance.errorSource ?? fallback.errorSource,
    statusCode: provenance.statusCode ?? fallback.statusCode,
    retryable: provenance.retryable ?? fallback.retryable,
    responseBody: provenance.responseBody ?? fallback.responseBody,
  });
}

function compact(value: LLMErrorProvenance): LLMErrorProvenance {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as LLMErrorProvenance;
}
