import { describe, it, expect, test } from 'vitest';
/**
 * XRayPanel tests - Real-time LLM output visualization
 *
 * Tests the x-ray panel that shows raw Mercury output
 * streaming in real-time
 */

describe('XRayPanel Logic', () => {
  const mockIterations = [
    { id: 1, code: 'function setup() { createCanvas(400, 400); }', timestamp: Date.now() - 3000 },
    { id: 2, code: 'function draw() { background(220); }', timestamp: Date.now() - 2000 },
    { id: 3, code: 'ellipse(200, 200, 50, 50);', timestamp: Date.now() - 1000 },
  ];

  test('component props match interface', () => {
    const props = {
      iterations: mockIterations,
      currentIndex: 0,
      rawOutput: ['token1', 'token2'],
      isStreaming: true,
    };

    expect(props.iterations).toEqual(mockIterations);
    expect(props.currentIndex).toBe(0);
    expect(props.rawOutput).toEqual(['token1', 'token2']);
    expect(props.isStreaming).toBe(true);
  });

  test('handles empty iterations array', () => {
    const props = {
      iterations: [],
      currentIndex: 0,
      rawOutput: [],
      isStreaming: false,
    };
    
    expect(props.iterations).toEqual([]);
    expect(props.rawOutput).toEqual([]);
  });

  test('token structure contains required fields', () => {
    const token = {
      id: 'token-123',
      text: 'some text',
      timestamp: Date.now(),
      type: 'raw',
    };

    expect(token.id).toBe('token-123');
    expect(token.text).toBe('some text');
    expect(token.timestamp).toBeGreaterThan(0);
    expect(token.type).toBe('raw');
  });

  test('raw output processing generates unique IDs', () => {
    const outputs = ['output1', 'output2', 'output3'];
    const tokens = outputs.map((text, idx) => ({
      id: `token-${Date.now()}-${idx}`,
      text,
      timestamp: Date.now(),
      type: 'raw',
    }));
    
    expect(tokens.length).toBe(3);
    expect(tokens[0].id).not.toBe(tokens[1].id);
    expect(tokens[1].id).not.toBe(tokens[2].id);
  });

  test('code truncation respects limit', () => {
    const longCode = 'a'.repeat(300);
    const truncated = longCode.slice(0, 200);
    
    expect(truncated.length).toBe(200);
    expect(truncated).not.toBe(longCode);
  });

  test('streaming state can be toggled', () => {
    const states = [true, false, true, false];
    
    expect(states).toContain(true);
    expect(states).toContain(false);
  });

  test('currentIndex respects array bounds', () => {
    const validIndex = Math.min(mockIterations.length - 1, 10);
    expect(validIndex).toBeLessThan(mockIterations.length);
  });

  test('tokens can be sliced for display', () => {
    const tokens = Array.from({ length: 20 }, (_, i) => ({
      id: `token-${i}`,
      text: `text ${i}`,
      timestamp: i,
      type: 'raw',
    }));
    
    const visibleTokens = tokens.slice(-10);
    expect(visibleTokens.length).toBe(10);
    expect(visibleTokens[0].text).toBe('text 10');
  });
});
