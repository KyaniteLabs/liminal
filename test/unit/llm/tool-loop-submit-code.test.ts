import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LLMClient } from '../../../src/llm/LLMClient.js';

describe('generateWithToolLoop — submit_code extraction', () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new LLMClient({
      baseUrl: 'https://api.kimi.com/coding/v1',
      model: 'kimi-k2p5',
      apiKey: 'test-key',
    });
  });

  it('extracts code from submit_code tool call (Kimi convention)', async () => {
    const generatedCode = 'function setup() { createCanvas(400, 400); }';

    // Simulate Kimi's response: content is empty, code is in tool_call arguments
    vi.spyOn(client, 'generateWithTools' as any).mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_abc123',
          name: 'submit_code',
          arguments: JSON.stringify({ code: generatedCode, language: 'javascript' }),
        },
      ],
      finishReason: 'tool_calls',
      success: true,
    });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'You are a creative coder.',
      userPrompt: 'Create a p5.js sketch',
      tools: [
        {
          name: 'validate_syntax',
          description: 'Validate code',
          parameters: { type: 'object', properties: { code: { type: 'string' } } },
        },
      ],
      toolExecutor: async () => '{"valid": true}',
      maxIterations: 3,
    });

    expect(result.content).toBe(generatedCode);
    expect(result.success).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.toolCallsMade).toBe(1);
  });

  it('extracts code from submit_code among multiple tool calls', async () => {
    const code = 'const x = 42;';

    vi.spyOn(client, 'generateWithTools' as any).mockResolvedValueOnce({
      content: '',
      toolCalls: [
        {
          id: 'call_validate',
          name: 'validate_syntax',
          arguments: JSON.stringify({ code: 'placeholder' }),
        },
        {
          id: 'call_submit',
          name: 'submit_code',
          arguments: JSON.stringify({ code, language: 'javascript' }),
        },
      ],
      finishReason: 'tool_calls',
      success: true,
    });

    // Provide a tool executor for the non-submit_code tool
    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: async () => '{"valid": true}',
      maxIterations: 3,
    });

    expect(result.content).toBe(code);
    expect(result.success).toBe(true);
  });

  it('falls through to normal tool execution when submit_code has no code', async () => {
    vi.spyOn(client, 'generateWithTools' as any)
      // First call: submit_code with empty code → falls through to executor
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'submit_code',
            arguments: JSON.stringify({ language: 'javascript' }), // no code field
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      // Second call: model returns content directly
      .mockResolvedValueOnce({
        content: 'const x = 1;',
        toolCalls: [],
        finishReason: 'stop',
        success: true,
      });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: async () => '{"error": "Unknown tool: submit_code"}',
      maxIterations: 3,
    });

    expect(result.content).toBe('const x = 1;');
    expect(result.iterations).toBe(2);
  });

  it('falls through when submit_code arguments are malformed JSON', async () => {
    vi.spyOn(client, 'generateWithTools' as any)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'submit_code',
            arguments: 'not-valid-json{',
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'final content',
        toolCalls: [],
        finishReason: 'stop',
        success: true,
      });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: async () => '{"error": "Unknown tool"}',
      maxIterations: 3,
    });

    expect(result.content).toBe('final content');
  });

  it('does not intercept non-submit_code tool calls', async () => {
    const executor = vi.fn().mockResolvedValue('{"valid": true}');

    vi.spyOn(client, 'generateWithTools' as any)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'validate_syntax',
            arguments: JSON.stringify({ code: 'const x = 1;' }),
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      .mockResolvedValueOnce({
        content: 'validated code here',
        toolCalls: [],
        finishReason: 'stop',
        success: true,
      });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: executor,
      maxIterations: 3,
    });

    expect(result.content).toBe('validated code here');
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith('validate_syntax', { code: 'const x = 1;' });
  });

  it('preserves content returned alongside tool calls when the final provider turn is empty', async () => {
    const artifact = 'function setup() { createCanvas(400, 400); }';
    const executor = vi.fn().mockResolvedValue('{"valid":true}');

    vi.spyOn(client, 'generateWithTools' as any)
      .mockResolvedValueOnce({
        content: artifact,
        toolCalls: [
          {
            id: 'call_1',
            name: 'validate_syntax',
            arguments: JSON.stringify({ code: artifact }),
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [],
        finishReason: 'stop',
        success: false,
        error: 'empty final turn',
      });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: executor,
      maxIterations: 1,
    });

    expect(result.content).toBe(artifact);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns validated code arguments when the final provider turn is empty', async () => {
    const artifact = 'const sketch = "ok";';

    vi.spyOn(client, 'generateWithTools' as any)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'validate_syntax',
            arguments: JSON.stringify({ code: artifact }),
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [],
        finishReason: 'stop',
        success: false,
        error: 'empty final turn',
      });

    const result = await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: async () => '{"valid":true}',
      maxIterations: 1,
    });

    expect(result.content).toBe(artifact);
    expect(result.success).toBe(true);
  });

  it('passes accumulated tool results into the forced final artifact turn', async () => {
    const artifact = 'const x = 1;';
    const spy = vi.spyOn(client, 'generateWithTools' as any)
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          {
            id: 'call_1',
            name: 'validate_syntax',
            arguments: JSON.stringify({ code: artifact }),
          },
        ],
        finishReason: 'tool_calls',
        success: true,
      })
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [],
        finishReason: 'stop',
        success: false,
      });

    await client.generateWithToolLoop({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      tools: [],
      toolExecutor: async () => '{"valid":true}',
      maxIterations: 1,
    });

    expect(spy.mock.calls[1][0].toolResults).toEqual([
      expect.objectContaining({
        toolCallId: 'call_1',
        result: '{"valid":true}',
        toolCall: expect.objectContaining({ name: 'validate_syntax' }),
      }),
    ]);
  });
});
