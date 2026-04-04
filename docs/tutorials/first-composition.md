# First Composition Tutorial

> A step-by-step guide to creating your first generative art composition with Liminal.

---

## Prerequisites

Before starting this tutorial, ensure you have:

### 1. LLM Configuration

Liminal requires a configured LLM backend to generate code. You have several options:

**Option A: LM Studio (Recommended for Beginners)**
```bash
# Install LM Studio from https://lmstudio.ai
# Download a model like Qwen2.5-Coder-7B
# Start the local server (default: localhost:1234)

liminal --configure  # Auto-detects LM Studio
```

**Option B: Ollama**
```bash
# Install Ollama from https://ollama.ai
ollama pull qwen2.5-coder:7b

# Configure Liminal
export LIMINAL_LLM_PROVIDER=ollama
export LIMINAL_LLM_BASE_URL=http://localhost:11434
export LIMINAL_LLM_MODEL=qwen2.5-coder:7b
```

**Option C: OpenAI/Cloud Provider**
```bash
export LIMINAL_LLM_PROVIDER=openai
export LIMINAL_LLM_MODEL=gpt-4
export OPENAI_API_KEY=sk-your-key-here
```

### 2. Basic Knowledge

You should be familiar with:
- **TypeScript/JavaScript basics**: Variables, functions, objects
- **p5.js fundamentals** (helpful but not required): Setup/draw loops, basic shapes
- **Command line**: Running commands in your terminal

### 3. Verify Installation

```bash
# Check Liminal is installed
liminal --version

# Verify LLM connection
liminal --prompt "test" --max-iterations 1
```

---

## Part 1: Hello World Composition

Let's create a simple p5.js composition—a breathing circle that pulses gently.

### Step 1: Create the Composition

```bash
liminal --prompt "Create a simple p5.js sketch with a circle in the center that slowly pulses in size using sine wave. Use calming blue colors." \
        --output ./my-first-composition
```

### Step 2: Understanding the Output

Liminal generates several files:

```
my-first-composition/
├── index.html          # Main HTML file with embedded sketch
├── sketch.js           # The p5.js code
└── metadata.json       # Generation details and scores
```

**[Screenshot Placeholder: Generated files in directory]**
*Expected: Screenshot showing the folder structure with 3 files*

### Step 3: View Your Composition

```bash
# Start the preview server
liminal serve ./my-first-composition

# Or open directly in browser
open ./my-first-composition/index.html
```

You should see a blue pulsing circle on a dark background.

**[Screenshot Placeholder: Browser showing pulsing blue circle]**
*Expected: Centered blue circle with subtle size animation*

### Step 4: Export HTML

The generated `index.html` is self-contained and ready to share:

```bash
# The HTML is already complete with embedded p5.js
# Just copy it wherever you need
cp ./my-first-composition/index.html ./my-website/
```

The HTML includes:
- p5.js library (CDN link)
- Your sketch code
- Canvas sizing and styling
- No external dependencies

---

## Part 2: Adding Audio

Now let's add a Tone.js audio layer that responds to mouse movement.

### Step 1: Generate the Audio Layer

```bash
liminal --prompt "Create a Tone.js synthesizer that changes pitch based on mouse X position. Map mouseX from 200Hz to 800Hz. Add a subtle reverb effect." \
        --domain music \
        --output ./audio-layer
```

### Step 2: Understanding Cross-Layer Communication

Liminal supports cross-layer communication where visual and audio layers can interact. Here's how it works:

```javascript
// Visual layer (p5.js) exports values
export const mousePosition = { x: 0, y: 0 };

// Audio layer (Tone.js) imports and uses them
import { mousePosition } from '../visual-layer/sketch.js';

// Use mousePosition.x to control frequency
oscillator.frequency.value = map(mousePosition.x, 0, width, 200, 800);
```

### Step 3: Combined Composition Structure

Create a project with both layers:

```
my-composition/
├── visual/              # p5.js layer
│   ├── index.html
│   └── sketch.js
├── audio/               # Tone.js layer
│   ├── index.html
│   └── synth.js
└── shared/              # Communication bridge
    └── state.js
```

### Step 4: Working Example

Here's a complete example combining both layers:

```javascript
// visual/sketch.js - Visual layer with mouse tracking
function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(220, 20, 10);
  
  // Visual representation of audio frequency
  let freq = map(mouseX, 0, width, 200, 800);
  let hue = map(freq, 200, 800, 200, 280);
  
  fill(hue, 80, 90);
  noStroke();
  
  // Circle size based on "amplitude"
  let size = 100 + sin(frameCount * 0.05) * 30;
  circle(mouseX, height/2, size);
  
  // Display frequency
  fill(255);
  textAlign(CENTER);
  text(`Frequency: ${Math.round(freq)}Hz`, width/2, height - 50);
}
```

```javascript
// audio/synth.js - Audio layer responding to mouse
import * as Tone from 'tone';

let synth, reverb;
let isStarted = false;

export async function initAudio() {
  // Initialize audio context on user interaction
  await Tone.start();
  
  // Create synth with reverb
  reverb = new Tone.Reverb(2).toDestination();
  synth = new Tone.Synth().connect(reverb);
  
  isStarted = true;
}

export function updateFrequency(mouseX, width) {
  if (!isStarted) return;
  
  // Map mouse X to frequency
  const freq = Tone.Frequency(map(mouseX, 0, width, 200, 800), "hz");
  synth.triggerAttack(freq);
}

export function stopAudio() {
  if (synth) synth.triggerRelease();
}
```

```html
<!-- combined/index.html -->
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #1a1a2e; }
    #start-btn {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      padding: 20px 40px;
      font-size: 18px;
      cursor: pointer;
      z-index: 100;
    }
  </style>
</head>
<body>
  <button id="start-btn">Click to Start Audio</button>
  <script>
    let synth, reverb;
    let audioStarted = false;
    
    function setup() {
      createCanvas(windowWidth, windowHeight);
      colorMode(HSB, 360, 100, 100);
      
      document.getElementById('start-btn').addEventListener('click', async () => {
        await Tone.start();
        
        reverb = new Tone.Reverb(2).toDestination();
        synth = new Tone.Synth().connect(reverb);
        synth.volume.value = -10;
        
        audioStarted = true;
        document.getElementById('start-btn').style.display = 'none';
      });
    }
    
    function draw() {
      background(240, 30, 10);
      
      // Map mouse to frequency and color
      let freq = map(mouseX, 0, width, 200, 800);
      let hue = map(freq, 200, 800, 200, 280);
      
      // Update audio
      if (audioStarted && synth) {
        synth.frequency.rampTo(freq, 0.1);
        if (Tone.context.state === 'running') {
          synth.triggerAttack(freq);
        }
      }
      
      // Visual feedback
      fill(hue, 80, 90);
      noStroke();
      let size = map(freq, 200, 800, 50, 150);
      circle(mouseX, height/2, size);
      
      // Instructions
      fill(255);
      textAlign(CENTER);
      textSize(16);
      text(`Move mouse horizontally to change pitch (${Math.round(freq)}Hz)`, width/2, height - 50);
    }
    
    function windowResized() {
      resizeCanvas(windowWidth, windowHeight);
    }
  </script>
</body>
</html>
```

**[Screenshot Placeholder: Composition with visual circle and frequency display]**
*Expected: Circle changing color/size with mouse movement, frequency text updating*

---

## Part 3: Working with Groups

Groups allow you to organize layers and apply effects to multiple layers at once.

### Step 1: Understanding Groups

In Liminal, groups are logical collections of layers:

```
Composition
├── Group: "Background"
│   ├── Layer: Gradient
│   └── Layer: Noise texture
├── Group: "Foreground"
│   ├── Layer: Particles
│   └── Layer: Main shape
└── Group: "Effects"
    └── Layer: Bloom overlay
```

### Step 2: Creating Groups

When generating with Liminal, you can specify groups in your prompt:

```bash
liminal --prompt "Create a composition with:
  - Background group: gradient sky with moving clouds
  - Midground group: particle system with 50 particles
  - Foreground group: large central orb with glow effect
  Make the background group opacity 0.8, others at 1.0" \
        --output ./grouped-composition
```

### Step 3: Group Operations Code Example

```javascript
// Group configuration in your sketch
const groups = {
  background: {
    opacity: 0.8,
    blendMode: BLEND,
    layers: ['gradient', 'clouds']
  },
  midground: {
    opacity: 1.0,
    blendMode: ADD,
    layers: ['particles']
  },
  foreground: {
    opacity: 1.0,
    blendMode: BLEND,
    layers: ['orb', 'glow']
  }
};

function draw() {
  // Draw each group in order
  for (const [name, group] of Object.entries(groups)) {
    push();
    
    // Apply group opacity
    const alpha = group.opacity * 255;
    
    // Apply blend mode
    blendMode(group.blendMode);
    
    // Draw layers in this group
    group.layers.forEach(layerName => {
      drawLayer(layerName, alpha);
    });
    
    pop();
  }
}

function drawLayer(layerName, groupAlpha) {
  switch(layerName) {
    case 'gradient':
      drawGradient(groupAlpha);
      break;
    case 'clouds':
      drawClouds(groupAlpha);
      break;
    case 'particles':
      drawParticles(groupAlpha);
      break;
    case 'orb':
      drawOrb(groupAlpha);
      break;
  }
}
```

### Step 4: Toggle Groups

Add UI controls to toggle groups:

```javascript
let groupVisibility = {
  background: true,
  midground: true,
  foreground: true
};

function keyPressed() {
  // Press 1, 2, 3 to toggle groups
  if (key === '1') groupVisibility.background = !groupVisibility.background;
  if (key === '2') groupVisibility.midground = !groupVisibility.midground;
  if (key === '3') groupVisibility.foreground = !groupVisibility.foreground;
}

function draw() {
  for (const [name, group] of Object.entries(groups)) {
    // Skip hidden groups
    if (!groupVisibility[name]) continue;
    
    push();
    // ... draw group
    pop();
  }
}
```

### Step 5: Group Opacity Animation

Animate group opacity for transitions:

```javascript
let groupOpacities = {
  background: { current: 0, target: 0.8 },
  midground: { current: 0, target: 1.0 },
  foreground: { current: 0, target: 1.0 }
};

function draw() {
  // Smoothly interpolate opacity
  for (const [name, opacity] of Object.entries(groupOpacities)) {
    opacity.current = lerp(opacity.current, opacity.target, 0.05);
  }
  
  // Use current opacity values when drawing
  // ...
}

// Trigger fade in/out
function fadeGroup(groupName, targetOpacity) {
  groupOpacities[groupName].target = targetOpacity;
}
```

**[Screenshot Placeholder: Composition with labeled groups and control panel]**
*Expected: Visual showing background, midground, foreground layers with toggle buttons*

---

## Part 4: Adding Animation

Let's create keyframe-based animations for smooth, cinematic motion.

### Step 1: Keyframe Animation Concept

```javascript
// Define keyframes: time (0-1) → value
const keyframes = {
  position: [
    { time: 0.0, value: { x: 100, y: 100 }, easing: 'easeOut' },
    { time: 0.3, value: { x: 400, y: 200 }, easing: 'easeInOut' },
    { time: 0.7, value: { x: 600, y: 400 }, easing: 'easeIn' },
    { time: 1.0, value: { x: 700, y: 300 }, easing: 'linear' }
  ],
  opacity: [
    { time: 0.0, value: 0 },
    { time: 0.2, value: 1 },
    { time: 0.8, value: 1 },
    { time: 1.0, value: 0 }
  ]
};
```

### Step 2: Keyframe Animation System

```javascript
class KeyframeAnimator {
  constructor() {
    this.animations = new Map();
    this.startTime = millis();
    this.duration = 5000; // 5 seconds
  }
  
  // Add an animation track
  addTrack(name, keyframes) {
    this.animations.set(name, keyframes);
  }
  
  // Get current value for a track
  getValue(trackName) {
    const keyframes = this.animations.get(trackName);
    if (!keyframes) return null;
    
    const elapsed = millis() - this.startTime;
    const progress = (elapsed % this.duration) / this.duration;
    
    return this.interpolate(keyframes, progress);
  }
  
  // Linear interpolation between keyframes
  interpolate(keyframes, progress) {
    // Find surrounding keyframes
    let prev = keyframes[0];
    let next = keyframes[keyframes.length - 1];
    
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
        prev = keyframes[i];
        next = keyframes[i + 1];
        break;
      }
    }
    
    // Calculate local progress
    const range = next.time - prev.time;
    const localProgress = range === 0 ? 0 : (progress - prev.time) / range;
    
    // Apply easing
    const easedProgress = this.applyEasing(localProgress, prev.easing || 'linear');
    
    // Interpolate
    if (typeof prev.value === 'number') {
      return lerp(prev.value, next.value, easedProgress);
    } else {
      // Object interpolation
      const result = {};
      for (const key of Object.keys(prev.value)) {
        result[key] = lerp(prev.value[key], next.value[key], easedProgress);
      }
      return result;
    }
  }
  
  applyEasing(t, type) {
    switch(type) {
      case 'easeIn': return t * t;
      case 'easeOut': return 1 - (1 - t) * (1 - t);
      case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default: return t;
    }
  }
}

// Usage
const animator = new KeyframeAnimator();

animator.addTrack('position', [
  { time: 0.0, value: { x: 100, y: 100 }, easing: 'easeOut' },
  { time: 0.5, value: { x: 400, y: 300 }, easing: 'easeInOut' },
  { time: 1.0, value: { x: 700, y: 100 } }
]);

animator.addTrack('opacity', [
  { time: 0.0, value: 0 },
  { time: 0.2, value: 1 },
  { time: 0.8, value: 1 },
  { time: 1.0, value: 0 }
]);

function draw() {
  const pos = animator.getValue('position');
  const alpha = animator.getValue('opacity') * 255;
  
  fill(200, 100, 255, alpha);
  circle(pos.x, pos.y, 50);
}
```

### Step 3: Generate Animated Composition

```bash
liminal --prompt "Create an animated p5.js composition with:
  - A circle that moves in a figure-8 pattern
  - Opacity that fades in at start and out at end
  - Color that shifts from blue to purple to pink
  - 6 second loop duration
  Use a KeyframeAnimator class for smooth interpolation." \
        --output ./animated-composition
```

### Step 4: Export Animated Composition

For sharing animations, you have several options:

**Option A: GIF Export**
```javascript
// Add to your sketch for GIF export
let gif;

function setup() {
  createCanvas(800, 600);
  
  // Requires p5.gif library
  gif = new GIF({
    workers: 2,
    quality: 10,
    width: 800,
    height: 600
  });
}

function draw() {
  // ... your animation code
  
  // Capture frame
  if (frameCount < 180) { // 3 seconds at 60fps
    gif.addFrame(canvas.elt, {delay: 16});
  } else if (frameCount === 180) {
    gif.render();
    gif.on('finished', blob => {
      saveAs(blob, 'animation.gif');
    });
  }
}
```

**Option B: Video Export (via CCapture)**
```javascript
// Use CCapture.js for high-quality video
const capturer = new CCapture({
  format: 'webm',
  framerate: 60,
  verbose: true
});

let capturing = false;

function keyPressed() {
  if (key === 'r' && !capturing) {
    capturing = true;
    capturer.start();
  }
}

function draw() {
  // ... animation code
  
  if (capturing) {
    capturer.capture(canvas.elt);
    
    if (frameCount > 360) { // Stop after 6 seconds
      capturer.stop();
      capturer.save();
      capturing = false;
    }
  }
}
```

**Option C: HTML Embedding**
The simplest approach—just share the HTML file. The animation runs in any modern browser.

**[Screenshot Placeholder: Animation timeline with keyframes]**
*Expected: Visual timeline showing position, opacity, and color keyframes*

---

## Part 5: Common Pitfalls

### 1. Audio Autoplay Policy

**Problem**: Audio doesn't play automatically when the page loads.

**Why**: Browsers block audio autoplay until user interaction.

**Solution**: Always add a "Start" button:

```javascript
let audioStarted = false;

function setup() {
  // Create start button
  const btn = createButton('Click to Start Audio');
  btn.position(width/2 - 75, height/2);
  btn.mousePressed(async () => {
    await Tone.start();
    audioStarted = true;
    btn.hide();
    initSynth();
  });
}

function draw() {
  if (!audioStarted) {
    background(20);
    textAlign(CENTER);
    text('Click button to start', width/2, height/2 - 50);
    return;
  }
  
  // Main animation code
}
```

### 2. Layer Ordering

**Problem**: Layers appear in wrong order (e.g., background covering foreground).

**Why**: p5.js draws in execution order—later calls appear on top.

**Solution**: Use a layered drawing approach:

```javascript
function draw() {
  // Draw order matters!
  drawBackground();  // First (bottom)
  drawMidground();   // Second
  drawForeground();  // Last (top)
}

// Or use a layer stack
const layers = [
  { name: 'background', fn: drawBackground },
  { name: 'midground', fn: drawMidground },
  { name: 'foreground', fn: drawForeground }
];

function draw() {
  layers.forEach(layer => layer.fn());
}
```

### 3. Blend Modes

**Problem**: Blend modes behave unexpectedly or show black artifacts.

**Why**: Blend modes interact with the existing canvas pixels. `ADD` mode with black (0,0,0) produces black.

**Solution**: Understand blend mode effects:

```javascript
// BLEND - Default, normal alpha blending
// ADD - Adds colors (good for light effects, glowing particles)
// MULTIPLY - Multiplies colors (good for shadows, darkening)
// SCREEN - Inverse multiply (good for bright overlays)

function draw() {
  background(10); // Dark background
  
  // Draw base layer normally
  blendMode(BLEND);
  drawBase();
  
  // Add glowing particles
  blendMode(ADD);
  drawParticles();
  
  // Return to normal for UI
  blendMode(BLEND);
  drawUI();
}
```

### 4. Performance with Many Layers

**Problem**: Frame rate drops with many layers or particles.

**Solutions**:

```javascript
// 1. Limit particle count
const MAX_PARTICLES = 500;

// 2. Use object pooling
const particlePool = [];
function getParticle() {
  return particlePool.find(p => !p.active) || new Particle();
}

// 3. Reduce canvas size if needed
function setup() {
  // Use pixel density for retina displays
  pixelDensity(min(window.devicePixelRatio, 2));
  createCanvas(800, 600);
}

// 4. Skip off-screen rendering
function drawParticle(p) {
  if (p.x < -50 || p.x > width + 50 || 
      p.y < -50 || p.y > height + 50) {
    return; // Skip if off-screen
  }
  // ... draw
}

// 5. Use WEBGL for 3D/instanced rendering
function setup() {
  createCanvas(800, 600, WEBGL);
}
```

### 5. Memory Leaks

**Problem**: Memory usage grows over time, causing slowdowns.

**Common causes**:
- Creating new objects every frame
- Not removing event listeners
- Accumulating particles indefinitely

**Solution**:

```javascript
// ❌ Bad: Creating new objects every frame
function draw() {
  const position = { x: mouseX, y: mouseY }; // New object!
  // ...
}

// ✅ Good: Reuse objects
const position = { x: 0, y: 0 };
function draw() {
  position.x = mouseX;
  position.y = mouseY;
  // ...
}

// ❌ Bad: Unbounded particle array
particles.push(new Particle());

// ✅ Good: Remove dead particles
particles = particles.filter(p => p.isAlive());

// Or use a fixed-size array with recycling
```

### 6. Coordinate System Confusion

**Problem**: Elements appear at wrong positions.

**Why**: p5.js has two coordinate modes—2D (top-left origin) and WEBGL (center origin).

**Solution**:

```javascript
// 2D mode (default)
function setup() {
  createCanvas(800, 600); // 2D canvas
  // (0, 0) is top-left
  // (width, height) is bottom-right
}

// WEBGL mode
function setup() {
  createCanvas(800, 600, WEBGL); // 3D canvas
  // (0, 0) is center of canvas
  // Y increases going UP (unlike 2D)
}

// Helper for consistent positioning
function getPosition(x, y, mode) {
  if (mode === WEBGL) {
    return { x: x - width/2, y: y - height/2 };
  }
  return { x, y };
}
```

---

## Next Steps

Congratulations on completing your first composition! Here's where to go next:

### Advanced Tutorials

- **[Shader Programming](./shader-basics.md)** - Write custom GLSL shaders for GPU-accelerated effects
- **[Three.js 3D](./three-js-basics.md)** - Create 3D compositions with WebGL
- **[Live Coding](./live-coding.md)** - Real-time music and visuals with Strudel and Hydra
- **[Particle Systems](./particle-systems.md)** - Advanced particle effects and flocking behaviors

### API Documentation

- **[Core API](../api/core.md)** - Programmatic usage of Liminal
- **[Generator Reference](../api/generators.md)** - All available generators and options
- **[Configuration Guide](../api/configuration.md)** - Environment variables and settings

### Example Gallery

Browse the [examples directory](../../examples/) for complete, working compositions:

```bash
# List available examples
ls examples/

# Try an example
liminal --prompt "Create a composition like examples/flow-field" \
        --output ./my-flow-field
```

### Community Resources

- **[p5.js Reference](https://p5js.org/reference/)** - Complete p5.js documentation
- **[Tone.js Docs](https://tonejs.github.io/docs/)** - Audio programming reference
- **[The Coding Train](https://www.youtube.com/c/TheCodingTrain)** - Creative coding tutorials

### Tips for Continued Learning

1. **Start Simple**: Begin with basic shapes and build complexity gradually
2. **Iterate Often**: Use Liminal's feedback loop to refine your ideas
3. **Study Examples**: Reverse-engineer compositions you admire
4. **Experiment**: Try unexpected combinations of techniques
5. **Document**: Save versions of your work to track evolution

---

## Quick Reference

### Essential Commands

```bash
# Basic generation
liminal --prompt "..." --output ./project

# Specify domain
liminal --prompt "..." --domain glsl --output ./shader

# Chat mode for complex ideas
liminal chat

# Serve and preview
liminal serve ./project

# List all your compositions
liminal list
```

### Common Code Patterns

```javascript
// Responsive canvas
function setup() {
  createCanvas(windowWidth, windowHeight);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Animation loop with time
function draw() {
  const t = millis() / 1000; // Time in seconds
  const phase = sin(t * TWO_PI / 5); // 5 second cycle
}

// Mouse interaction
function draw() {
  const targetX = lerp(currentX, mouseX, 0.1);
  const targetY = lerp(currentY, mouseY, 0.1);
}

// Safe audio initialization
async function initAudio() {
  await Tone.start();
  // ... create synths
}
```

---

*Happy creating! Remember: the best way to learn is by making.* 🎨
