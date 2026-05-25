import { makeScene2D, Txt, Rect } from '@revideo/2d';
import { createRef, waitFor } from '@revideo/core';

export default makeScene2D('TitleScene', function* (view) {
  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <Rect width={1920} height={1080} fill={'#0a0a1a'}>
      <Txt
        ref={title}
        text={'Timeline Composition'}
        fill={'#e8e6f0'}
        fontSize={80}
        fontFamily={'sans-serif'}
        fontWeight={700}
        opacity={0}
      />
      <Txt
        ref={subtitle}
        text={'Animated Title & Subtitle Fade'}
        fill={'#7b79a0'}
        fontSize={36}
        fontFamily={'sans-serif'}
        y={100}
        opacity={0}
      />
    </Rect>
  );

  yield* title().opacity(1, 1.2);
  yield* waitFor(0.4);
  yield* subtitle().opacity(1, 1.0);
  yield* waitFor(2.0);
  yield* subtitle().opacity(0, 0.8);
  yield* title().opacity(0, 1.0);
  yield* waitFor(0.5);
});
