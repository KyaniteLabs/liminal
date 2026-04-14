import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/llm/LLMClient.js', () => {
  class MockLLMClient {
    generateWithToolLoop = vi.fn();
    getConfig = vi.fn().mockReturnValue({ model: 'test-model', baseUrl: 'http://localhost:1234/v1' });
  }
  (MockLLMClient as any).isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { StrudelGenerator } from '../../../src/generators/strudel/StrudelGenerator.js';

describe('StrudelGenerator', () => {
  it('extracts a balanced Strudel expression from accidental HTML wrapper chrome', () => {
    const mixed = `<!DOCTYPE html>
<html>
<body>
<script>
stack(
  // Kick drum
  s("bd*4"),
  // Bassline
  note("c2 eb2 g2").s("sawtooth")
).out()
</script>
</body>
</html>`;

    const gen = new StrudelGenerator();
    const sanitized = (gen as any).sanitizeCode(mixed);

    expect(sanitized).toBe(`stack(
  s("bd*4"),
  note("c2 eb2 g2").s("sawtooth")
).out()`);
  });
});
