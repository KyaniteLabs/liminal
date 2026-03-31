<think>
The user wants a geometric pattern with a rotating grid effect in Hydra. Let me create something visually interesting with:

1. A geometric base (shapes)
2. A grid-like structure
3. Rotation animation
4. Some modulation for visual richness

I'll use multiple sources and combine them creatively. Let me make a nice rotating grid pattern with geometric elements.
</think>

osc(3, 0.1, 0.5)
  .rotate(() => time * 0.3)
  .scale(0.8)
  .modulate(noise(10, 0.5))
  .color(0.3, 0.5, 0.8)
  .out(o0)

shape(4, 0.5)
  .scale(0.3)
  .rotate(() => -time * 0.5)
  .modulate(o0, 0.2)
  .color(1, 0.6, 0.3)
  .out()

src(o0)
  .scale(1.01)
  .rotate(0.02)
  .modulate(noise(2, 0.2))
  .blend(o0)
  .out()

gradient(0.3)
  .modulate(osc(5))
  .scrollX(() => time * 0.1)
  .scrollY(() => time * 0.15)
  .out()