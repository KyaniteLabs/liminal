import { describe, it, expect, vi } from 'vitest';
import { reflectOnSessionTurns } from '../../../src/learning/StudioReflection.js';
import type { SessionTurnRecord } from '../../../src/agent/SessionGraph.js';

function turn(input: string, response: string, artifact = false): SessionTurnRecord {
  return {
    turnId: `t-${input}`,
    input,
    intent: 'create',
    delegatedTo: 'generator',
    response,
    durationMs: 100,
    artifactRefs: artifact ? ['artifact/ref'] : [],
    timestamp: '2026-06-13T00:00:00Z',
  };
}

describe('reflectOnSessionTurns', () => {
  it('distills the studio model JSON into a structured taste signal', async () => {
    const llm = {
      generate: vi.fn().mockResolvedValue({
        code:
          'Here is the analysis: {"likes":["warm palettes","slow motion"],' +
          '"dislikes":["busy compositions"],"intentSummary":"calm moonlit scenes","satisfaction":0.85}',
      }),
    };
    const signal = await reflectOnSessionTurns('s1', [turn('moonlit garden', 'rendered', true)], llm);
    expect(signal).toEqual({
      sessionId: 's1',
      likes: ['warm palettes', 'slow motion'],
      dislikes: ['busy compositions'],
      intentSummary: 'calm moonlit scenes',
      satisfaction: 0.85,
    });
  });

  it('passes the user input and assistant response into the prompt the model sees', async () => {
    const llm = { generate: vi.fn().mockResolvedValue({ code: '{"satisfaction":0.5}' }) };
    await reflectOnSessionTurns('s2', [turn('make it bluer', 'adjusted to blue')], llm);
    const userPrompt = llm.generate.mock.calls[0][1] as string;
    expect(userPrompt).toContain('make it bluer');
    expect(userPrompt).toContain('adjusted to blue');
  });

  it('returns null on an empty session without calling the model', async () => {
    const llm = { generate: vi.fn() };
    expect(await reflectOnSessionTurns('s3', [], llm)).toBeNull();
    expect(llm.generate).not.toHaveBeenCalled();
  });

  it('returns null when the model output contains no JSON object', async () => {
    const llm = { generate: vi.fn().mockResolvedValue({ code: 'I cannot analyze this session.' }) };
    expect(await reflectOnSessionTurns('s4', [turn('x', 'y')], llm)).toBeNull();
  });

  it('returns null when the model output is malformed JSON', async () => {
    const llm = { generate: vi.fn().mockResolvedValue({ code: '{"likes": [unclosed array' }) };
    expect(await reflectOnSessionTurns('s5', [turn('x', 'y')], llm)).toBeNull();
  });

  it('returns null (never throws) when the LLM call rejects', async () => {
    const llm = { generate: vi.fn().mockRejectedValue(new Error('timeout')) };
    await expect(reflectOnSessionTurns('s6', [turn('x', 'y')], llm)).resolves.toBeNull();
  });

  it('clamps out-of-range satisfaction and defaults missing fields', async () => {
    const llm = { generate: vi.fn().mockResolvedValue({ code: '{"satisfaction":1.7}' }) };
    const signal = await reflectOnSessionTurns('s7', [turn('x', 'y')], llm);
    expect(signal).toEqual({
      sessionId: 's7',
      likes: [],
      dislikes: [],
      intentSummary: '',
      satisfaction: 1,
    });
  });
});
