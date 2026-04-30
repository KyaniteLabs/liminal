import { describe, expect, it } from 'vitest';

import { RevideoValidator } from '../../../src/core/validators/RevideoValidator.js';

describe('RevideoValidator', () => {
  it('rejects p5.js contamination', () => {
    const result = RevideoValidator.validate(`
      function setup() { createCanvas(1920, 1080); }
      function draw() { background(0); }
    `);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Revideo code must not use p5.js APIs such as createCanvas, setup(), or draw()');
  });
  it('accepts canonical makeScene2D Revideo scenes', () => {
    const result = RevideoValidator.validate(`
      import { makeScene2D, Rect, Txt } from '@revideo/2d';
      import { createRef, waitFor } from '@revideo/core';

      export default makeScene2D("TitleCard", function* (view) {
        const title = createRef<Txt>();
        view.add(<Rect width={1920} height={1080} fill={'#050816'}><Txt ref={title} text={'Liminal'} /></Rect>);
        yield* title().opacity(1, 0.5);
        yield* waitFor(1);
      });
    `);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });


  it('accepts single-argument makeScene2D scenes and lets renderer name them', () => {
    const result = RevideoValidator.validate(`
      import { makeScene2D, Rect } from '@revideo/2d';
      import { waitFor } from '@revideo/core';

      export default makeScene2D(function* (view) {
        view.add(<Rect width={1920} height={1080} fill={'#050816'} />);
        yield* waitFor(1);
      });
    `);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

});
