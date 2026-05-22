import { makeScene2D, Txt, Rect } from '@revideo/2d';
import { createRef, waitFor } from '@revideo/core';

export default makeScene2D('TitleFadeScene', function* (view) {
  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <Rect width={1920} height={1080} fill={'#0a0a1a'}>
      <Txt
        ref={title}
        text={'Timeline Composition'}
        fill={'#e8e6f0'}
        fontSize={96}
        fontWeight={700}
        fontFamily={'sans-serif'}
        opacity={0}
        y={-80}
      />
      <Txt
        ref={subtitle}
        text={'Animated Title & Subtitle Fade'}
        fill={'#7a7890'}
        fontSize={48}
        fontFamily={'sans-serif'}
        opacity={0}
        y={80}
      />
    </Rect>
  );

  yield* title().opacity(1, 1.2);
  yield* waitFor(0.4);
  yield* subtitle().opacity(1, 1.0);
  yield* waitFor(1.5);
  yield* title().opacity(0, 0.8);
  yield* subtitle().opacity(0, 0.8);
  yield* waitFor(0.5);
});
