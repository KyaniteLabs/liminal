// Hydra Video Synth Patch - Feedback, Color Shift & Geometric Patterns

s0.initVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
s1.initVideo("https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png")

// Main composition with feedback loop
const feedback = (src, amt=0.5) => src.modulate(src, amt)

hydra.onFrame(() => {
  const time = Date.now() * 0.001
  
  // Output
  o0.play(
    // Base layer with feedback
    feedback(s0.color(1.2, 0.8, 1.5))
      .rotate(time * 0.3)
      .scale(1.2 + Math.sin(time * 0.5) * 0.3)
      // Add geometric pattern overlay
      .add(s1.kaleid(0.5 + Math.sin(time * 0.7) * 0.3)
        .color(0.3, 0.9, 0.7)
        .rotate(-time * 0.2)
        .scale(0.8)
      )
      // Color shifting layer
      .layer(src("video", 2)
        .color(0.5 + Math.sin(time * 0.3) * 0.3, 0.5 + Math.sin(time * 0.4) * 0.3, 0.5 + Math.sin(time * 0.5) * 0.3)
        .modulate(noise(3, 0.5).color(1, 0.5, 0.8))
        .scale(1.1)
      )
      // Geometric grid pattern
      .add(noise(10, 0.1)
        .thresh(0.6 + Math.sin(time * 0.2) * 0.2)
        .color(1.3, 0.8, 1.1)
        .mult(src("noise").scale(0.5).kaleid(4).rotate(time * 0.5))
      )
  )
})

// Secondary output - rotating voronoi
o1.play(
  feedback(src("video", 0).scale(1.5), 0.4)
    .voronoi(3, 0.8)
    .color(0.8, 1.2, 0.6)
    .rotate(time * 0.5)
)

.out(o0)