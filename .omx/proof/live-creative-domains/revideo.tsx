import { makeScene2D, Txt, Rect } from '@revideo/2d';
import { createRef, waitFor } from '@revideo/core';

export default makeScene2D('TitleComposition', function* (view) {
  const bg = createRef<Rect>();
  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <Rect ref={bg} width={1920} height={1080} fill={'#0a0a1a'}>
      <Txt
        ref={title}
        text={'Timeline Composition'}
        fill={'#e8e6f0'}
        fontSize={96}
        fontFamily={'sans-serif'}
        fontWeight={700}
        y={-80}
        opacity={0}
      />
      <Txt
        ref={subtitle}
        text={'Animated Title & Subtitle Fade'}
        fill={'#7b79a0'}
        fontSize={48}
        fontFamily={'sans-serif'}
        y={80}
        opacity={0}
      />
    </Rect>
  );

  yield* title().opacity(1, 1.2);
  yield* waitFor(0.4);
  yield* subtitle().opacity(1, 1.2);
  yield* waitFor(2.0);

  yield* title().opacity(0, 1.0);
  yield* subtitle().opacity(0, 1.0);
  yield* waitFor(0.5);
});
