import { makeScene2D, Txt, Rect } from "@revideo/2d";
import { createRef, waitFor } from "@revideo/core";

export default makeScene2D("TitleScene", function* (view) {
  const title = createRef<Txt>();
  const subtitle = createRef<Txt>();

  view.add(
    <Rect width={1920} height={1080} fill={"#0a0a1a"}>
      <Txt
        ref={title}
        text={"Timeline Composition"}
        fill={"#e8e8f0"}
        fontSize={80}
        fontFamily={"sans-serif"}
        y={-60}
        opacity={0}
      />
      <Txt
        ref={subtitle}
        text={"Animated Title & Subtitle Fade"}
        fill={"#8888aa"}
        fontSize={40}
        fontFamily={"sans-serif"}
        y={80}
        opacity={0}
      />
    </Rect>
  );

  yield* title().opacity(1, 1.2);
  yield* subtitle().opacity(1, 1.0);
  yield* waitFor(2);
  yield* title().opacity(0, 1.0);
  yield* subtitle().opacity(0, 0.8);
  yield* waitFor(0.5);
});
