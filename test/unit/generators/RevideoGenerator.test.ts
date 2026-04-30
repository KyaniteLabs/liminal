import { describe, expect, it, vi } from 'vitest';
import { RevideoGenerator } from '../../../src/generators/revideo/RevideoGenerator.js';
import { LLMClient } from '../../../src/llm/LLMClient.js';

describe('RevideoGenerator', () => {
  it('falls back to a compact direct prompt when tool-assisted generation is empty', async () => {
    vi.spyOn(LLMClient, 'isConfigured').mockReturnValue(true);
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'revideo-test-model' });
    vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValueOnce({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: true,
    });
    const complete = vi.spyOn(llm, 'complete')
      .mockResolvedValueOnce({ text: '', success: true })
      .mockResolvedValueOnce({
        text: [
          'import { makeScene2D, Txt, Rect } from "@revideo/2d";',
          'import { createRef, waitFor } from "@revideo/core";',
          'export default makeScene2D("TitleCard", function* (view) {',
          '  const title = createRef<Txt>();',
          '  view.add(<Rect width={1920} height={1080} fill={"#050a18"}><Txt ref={title} text={"Liminal"} fill={"#fff"} /></Rect>);',
          '  yield* title().opacity(1, 0.8);',
          '  yield* waitFor(1);',
          '});',
        ].join('\n'),
        success: true,
      });

    const gen = new RevideoGenerator(llm);
    const code = await gen.generate('animated title card');

    expect(code).toContain('export default makeScene2D');
    expect(code).toContain('@revideo/2d');
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
