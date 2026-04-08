import { vi } from 'vitest';
import type { LLMResponse } from '../../src/llm/LLMClient.js';

export interface MockLLMOptions {
  defaultResponse?: Partial<LLMResponse>;
  responsesByPrompt?: Record<string, Partial<LLMResponse>>;
}

export function createLLMMock(options: MockLLMOptions = {}) {
  const mockIsConfigured = vi.fn().mockReturnValue(true);

  const mockGenerate = vi.fn(async (_system: string, user: string) => {
    // Check for prompt-specific responses
    for (const [keyword, response] of Object.entries(options.responsesByPrompt || {})) {
      if (user.toLowerCase().includes(keyword.toLowerCase())) {
        return { code: 'mock code', success: true, ...response };
      }
    }
    // Return default
    return {
      code: options.defaultResponse?.code || 'function setup() { createCanvas(400, 400); }',
      success: true,
      ...options.defaultResponse
    };
  });

  const mockGenerateP5Sketch = vi.fn(async (prompt: string) => {
    return mockGenerate('', prompt);
  });

  const mockComplete = vi.fn(async () => ({
    text: 'mock response',
    success: true
  }));

  const mockStreamWithThinking = vi.fn(async function* () {
    yield { type: 'content' as const, content: 'mock stream response' };
  });

  const mockGetConfig = vi.fn(() => ({
    model: 'test-model',
    baseUrl: 'http://test',
    role: 'generator' as const
  }));

  // Constructor mock
  const LLMClientMock = vi.fn(function(this: any) {
    this.generate = mockGenerate;
    this.generateP5Sketch = mockGenerateP5Sketch;
    this.complete = mockComplete;
    this.streamWithThinking = mockStreamWithThinking;
    this.getConfig = mockGetConfig;
  });
  (LLMClientMock as any).isConfigured = mockIsConfigured;

  return {
    mockIsConfigured,
    mockGenerate,
    mockGenerateP5Sketch,
    mockComplete,
    mockStreamWithThinking,
    mockGetConfig,
    LLMClientMock,
    // Helper to reset all mocks
    resetMocks: () => {
      vi.clearAllMocks();
    }
  };
}

// Pre-built mocks for common scenarios
export const defaultLLMMock = createLLMMock();

export const p5GeneratorMock = createLLMMock({
  defaultResponse: {
    code: `function setup() {
  createCanvas(800, 600);
  background(20);
}

function draw() {
  background(20, 10);
  fill(100, 150, 255);
  ellipse(width/2, height/2, 50);
}`,
    success: true
  }
});

// Export individual mock functions for direct use in tests
export const mockLLMFunctions = {
  createMockGenerate: (defaultCode: string = 'function setup() { createCanvas(400, 400); }') =>
    vi.fn(async (_system: string, _user: string) => ({
      code: defaultCode,
      success: true
    })),

  createMockComplete: (defaultText: string = 'mock response') =>
    vi.fn(async () => ({
      text: defaultText,
      success: true
    })),

  createMockStreamWithThinking: (chunks: Array<{type: 'thinking' | 'content', content: string}> = [
    { type: 'content' as const, content: 'mock response' }
  ]) =>
    vi.fn(async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })
};
