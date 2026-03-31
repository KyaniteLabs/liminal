<think>
The user wants liquid morphing shapes with feedback trails. I'll create a visual using:
1. A base shape that morphs/rotates
2. Feedback loop using .modulate() with the output
3. Liquid feel through noise modulation and smooth color gradients

Let me create something with:
- A shape or osc as the base
- Noise for liquid distortion
- Feedback for trails
- Color gradients for visual interest

I'll use the pattern of modulating something with a scaled version of the output for the feedback trail effect.
</think>

osc(20, 0.1, 1.5).modulate(noise(3, 0.5)).rotate(0.5).scale(1.01).modulate(src(o0).scale(1.05)).color(0.5, 0.8, 1.0).out(o0)
src(o0).modulate(noise(2, 0.3)).color(1.0, 0.6, 0.8).out(o1)
render({mode: "index"})

src(o0).scale(1.2).blend(shape(4).rotate(0.3).color(0.3, 0.9, 0.7)).out(o2)
src(o2).modulate(o0).scale(1.02).out(o0)
gradient().modulate(noise(4)).out(o3)
src(o3).blend(o0).out()