// Hydra video synth with feedback, geometric patterns, and color shifting

// Base geometric sources
const geo1 = shape(5, 0.7, 0.08).scale(1.3)
const geo2 = shape(7, 0.4, 0.12).rotate(0.5)
const geo3 = shape(3, 0.5, 0.15)
const geo4 = shape(4, 0.3, 0.2).rotate(Math.PI/4)

// Noise for feedback texture
const noise1 = noise(4, 0.8)
const noise2 = noise(2, 0.5)

// Create fractal-like geometric pattern with rotation
const fractalGeo = geo1
  .rotate(() => time * 0.2)
  .colorama(0.4)
  .modulate(noise1.scale(0.5).kaleid(3))
  .saturate(2)

// Secondary geometric layer with inverse rotation
const secondaryGeo = geo2
  .rotate(() => time * -0.15)
  .kaleid(2)
  .colorama(0.6)
  .scale(1.2)

// Triangular accent layer
const triangleLayer = geo3
  .rotate(() => time * 0.1)
  .modulateScale(fractalGeo, 0.3)
  .colorama(0.8)

// Square layer with offset timing
const squareLayer = geo4
  .rotate(() => Math.sin(time * 0.3) * 2)
  .modulate(geo1.rotate(time * 0.05), 0.4)
  .colorama(0.5)

// Feedback loop using noise modulation
const feedbackLoop = noise1
  .scale(() => 1 + Math.sin(time * 0.2) * 0.3)
  .modulate(geo2.rotate(time * 0.08).kaleid(4))
  .rotate(() => time * -0.1)
  .colorama(() => Math.sin(time * 0.5) * 0.5 + 0.5)

// Additional feedback layer
const feedbackLayer = noise2
  .modulate(feedbackLoop, 0.5)
  .scale(0.7)
  .rotate(() => time * 0.15)

// Combine all geometric layers
const combinedPattern = fractalGeo
  .add(secondaryGeo, 0.6)
  .blend(triangleLayer, 0.5)
  .mix(squareLayer, 0.4)
  .add(feedbackLayer, 0.3)

// Apply color shifting and contrast
const finalColor = combinedPattern
  .colorama(() => Math.sin(time * 0.3) * 0.4 + 0.6)
  .saturate(1.5)
  .contrast(1.2)
  .brightness(1.1)

// Final output with modulation for organic movement
const final = finalColor
  .modulate(noise1.rotate(time * 0.05), 0.2)
  .scale(() => 1 + Math.sin(time * 0.1) * 0.1)

// Render to screen
render(final)