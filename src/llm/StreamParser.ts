/**
 * StreamParser - Per-provider stream parsers for unified StreamEvent emission
 *
 * Each provider has its own streaming format:
 * - OpenAI/LM Studio/OpenRouter: SSE (Server-Sent Events)
 * - Anthropic: SSE with content_block_start/delta events
 * - Ollama: JSON lines
 * - Local R1: <think/> tags mixed in output stream
 */

import type { StreamEvent, TokenUsage } from './ProviderTypes.js';

/**
 * Parse SSE stream from OpenAI-compatible endpoints.
 * Handles: OpenAI, LM Studio, OpenRouter, any /v1/chat/completions
 */
export async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;

          if (delta) {
            // OpenRouter reasoning details
            if (delta.reasoning_details) {
              for (const detail of delta.reasoning_details) {
                if (detail.text) {
                  yield { type: 'thinking', content: detail.text };
                }
              }
            }

            // GPT-5 reasoning summary
            if (delta.reasoning_content) {
              yield { type: 'thinking', content: delta.reasoning_content };
            }

            // Standard content
            if (delta.content) {
              yield { type: 'content', content: delta.content };
            }
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done' };
}

/**
 * Parse Anthropic SSE stream.
 * Routes by content_block_start type: "thinking" vs "text"
 */
export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentBlockType: 'thinking' | 'text' | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // Track content block type
          if (parsed.type === 'content_block_start') {
            const block = parsed.content_block as { type: string } | undefined;
            if (block?.type === 'thinking') {
              currentBlockType = 'thinking';
            } else {
              currentBlockType = 'text';
            }
          }

          // Emit delta events
          if (parsed.type === 'content_block_delta') {
            const delta = parsed.delta as { thinking?: string; text?: string } | undefined;
            if (delta?.thinking && currentBlockType === 'thinking') {
              yield { type: 'thinking', content: delta.thinking };
            } else if (delta?.text) {
              yield { type: 'content', content: delta.text };
            }
          }

          // Message complete
          if (parsed.type === 'message_stop') {
            const usage = parsed.message?.usage as { input_tokens: number; output_tokens: number } | undefined;
            if (usage) {
              yield {
                type: 'done',
                usage: {
                  inputTokens: usage.input_tokens,
                  outputTokens: usage.output_tokens,
                },
              };
            } else {
              yield { type: 'done' };
            }
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done' };
}

/**
 * Parse Ollama JSON-lines stream.
 * Each line: { response: "token", thinking?: "token", done: boolean }
 */
export async function* parseOllamaStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);

          if (parsed.thinking) {
            yield { type: 'thinking', content: parsed.thinking };
          }

          if (parsed.response) {
            yield { type: 'content', content: parsed.response };
          }

          if (parsed.done) {
            const usage: TokenUsage | undefined = parsed.eval_count
              ? {
                  inputTokens: parsed.prompt_eval_count || 0,
                  outputTokens: parsed.eval_count || 0,
                }
              : undefined;
            yield { type: 'done', usage };
            return;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done' };
}

/**
 * Parse <think/> tags from a raw text stream.
 * Used for local DeepSeek-R1 models that output thinking as inline tags.
 * Splits single stream into thinking (before </think/>) and content (after).
 */
export async function* parseThinkTagStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let inThinking = false;
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process buffer for think tags
      while (true) {
        if (!inThinking) {
          // Look for opening <think/> tag
          const thinkStart = buffer.indexOf('<think');
          if (thinkStart === -1) {
            // No think tag — emit as content
            if (buffer.length > 0) {
              yield { type: 'content', content: buffer };
              buffer = '';
            }
            break;
          }

          // Emit anything before the tag as content
          if (thinkStart > 0) {
            yield { type: 'content', content: buffer.slice(0, thinkStart) };
          }

          // Find the closing > of the opening tag
          const tagEnd = buffer.indexOf('>', thinkStart);
          if (tagEnd === -1) {
            // Incomplete tag, wait for more data
            buffer = buffer.slice(thinkStart);
            break;
          }

          inThinking = true;
          buffer = buffer.slice(tagEnd + 1);
        } else {
          // Look for closing </think/> tag
          const thinkEnd = buffer.indexOf('</think');
          if (thinkEnd === -1) {
            // Still in thinking — emit as thinking
            if (buffer.length > 0) {
              yield { type: 'thinking', content: buffer };
              buffer = '';
            }
            break;
          }

          // Emit thinking content before closing tag
          if (thinkEnd > 0) {
            yield { type: 'thinking', content: buffer.slice(0, thinkEnd) };
          }

          // Find the closing > of the closing tag
          const tagEnd = buffer.indexOf('>', thinkEnd);
          if (tagEnd === -1) {
            buffer = '';
            break;
          }

          inThinking = false;
          buffer = buffer.slice(tagEnd + 1);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Flush remaining buffer
  if (buffer.length > 0) {
    if (inThinking) {
      yield { type: 'thinking', content: buffer };
    } else {
      yield { type: 'content', content: buffer };
    }
  }

  yield { type: 'done' };
}
