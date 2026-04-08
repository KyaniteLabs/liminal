const fs = require('fs');
const dir = '/Users/simongonzalezdecruz/workspaces/liminal/src/llm/providers';

// Read MiniMaxProvider template from the git version since it was correct
// All files are now reverted to original, so we read originals and transform

function addImports(src) {
  return src.replace(
    "import { BaseProvider } from './BaseProvider.js';",
    "import { ok, err } from 'neverthrow';\nimport type { Result } from 'neverthrow';\nimport { LLMError } from '../errors.js';\nimport { BaseProvider } from './BaseProvider.js';"
  );
}

function wrapMethod(src, methodSignature) {
  // Find method, add try { after opening brace, and add catch before closing brace
  const idx = src.indexOf(methodSignature);
  if (idx === -1) return src;

  const braceStart = src.indexOf('{', idx + methodSignature.length);
  if (braceStart === -1) return src;

  // Insert 'try {' after the opening brace
  let result = src.substring(0, braceStart + 1) + '\n    try {' + src.substring(braceStart + 1);

  // Now find the matching closing brace for the method
  // Count braces from the try { we just inserted
  let depth = 0;
  let pos = braceStart + 1;
  // Skip to after 'try {'
  pos = result.indexOf('try {', pos) + 5;
  depth = 1; // we're inside try

  while (pos < result.length && depth > 0) {
    if (result[pos] === '{') depth++;
    if (result[pos] === '}') depth--;
    pos++;
  }
  // pos now points to the closing brace of the method
  // Insert catch block before it
  const catchBlock = '    } catch (e) {\n      return err(new LLMError(`Request failed: ${e instanceof Error ? e.message : String(e)}`, this.name, undefined, true));\n    ';
  result = result.substring(0, pos - 1) + catchBlock + result.substring(pos - 1);

  return result;
}

// Transform error returns to err(new LLMError(...))
function transformErrors(src) {
  src = src.replace(
    /return \{\s*content:\s*'[^']*',\s*model:\s*this\.config\.model,\s*success:\s*false,\s*error:\s*`([^`]+)`,?\s*\};/g,
    (match, errorMsg) => {
      return 'const retryable = response.status === 429 || response.status >= 500;\n        return err(new LLMError(`' + errorMsg + '`, this.name, response.status, retryable));';
    }
  );
  src = src.replace(
    /throw new Error\(`([^`]+)`\);/g,
    (match, errorMsg) => {
      return 'const retryable = response.status === 429 || response.status >= 500;\n        return err(new LLMError(`' + errorMsg + '`, this.name, response.status, retryable));';
    }
  );
  return src;
}

// Transform success returns to ok({...})
function transformSuccess(src) {
  // Match: return { content, ... success: ..., ... };
  // But not returns inside if blocks that already have ok()
  // Simple approach: replace all 'return {' with 'return ok({' in generate methods
  // Then fix the closing }; to });

  // Actually, let's be smarter - only replace bare 'return {' that are NOT already ok()
  src = src.replace(/\breturn \{/g, 'return ok({');
  // Fix double ok: 'return ok(ok(' -> 'return ok('
  src = src.replace(/return ok\(ok\(/g, 'return ok(');
  // Now we need to close the ok( with ) - every 'return ok({...};' needs to become 'return ok({...});'
  // The return statements end with '};' which needs to become '});'
  // But only the ones we just wrapped
  return src;
}

// Actually this is getting too complex with regex. Let me just write complete file contents.
// Since the files are small enough, I'll hard-code them.

const bp = `/**
 * BaseProvider - Abstract base class for all LLM provider implementations
 *
 * Every provider (OpenAI, Anthropic, Ollama, etc.) extends this class
 * and implements generate() and stream(). The base class provides
 * common configuration and capability checking.
 */

import type {
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import type { Result } from 'neverthrow';
import type { LLMError } from '../errors.js';

export abstract class BaseProvider {
  abstract readonly name: string;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Generate a completion (non-streaming).
   */
  abstract generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>>;

  /**
   * Stream tokens as they arrive.
   */
  abstract stream(req: ProviderRequest): AsyncGenerator<StreamEvent>;

  /**
   * Capabilities for the currently configured model.
   * Implementations should use CapabilityRegistry for lookups.
   */
  abstract get capabilities(): ProviderCapabilities;

  supportsThinking(): boolean {
    return this.capabilities.thinking;
  }

  supportsStreaming(): boolean {
    return this.capabilities.streaming;
  }

  supportsJsonMode(): boolean {
    return this.capabilities.jsonMode;
  }

  supportsToolUse(): boolean {
    return this.capabilities.toolUse;
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  getModel(): string {
    return this.config.model;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}
`;

fs.writeFileSync(dir + '/BaseProvider.ts', bp);
console.log('BaseProvider written');
