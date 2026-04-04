let particles = [];
const GRAVITY = 0.15;
const NUM_SPARKS_PER_FRAME = 3;

/**
 * Particle Class: Represents a single spark.
 */
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    
    // Random initial velocity for a spiky spread
    this.vx = random(-2, 2);
    this.vy = random(-8, -2); // Initial upward push
    
    // Color setup using HSB for vibrant, customizable hues
    this.hue = random(360);
    this.saturation = random(90, 100);
    this.brightness = random(70, 100);
    
    this.lifespan = 255; // Start fully opaque
  }

  // Update position based on velocity and gravity
  update() {
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    
    // Fade out the particle over time
    this.lifespan -= 5; 
  }

  // Draw the particle
  show() {
    noStroke();
    // Use the stored HSB values for color
    colorMode(HSB, 360, 100, 100, 100);
    fill(this.hue, this.saturation, this.brightness, this.lifespan);
    
    // Draw the spark as a small ellipse
    ellipse(this.x, this.y, 5, 5);
  }

  // Check if the particle is dead (faded out)
  isDead() {
    return this.lifespan < 0;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  // Set the initial color mode to HSB for easier color cycling
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  // Create a semi-transparent background overlay to create the fading trail effect
  background(0, 0, 0, 20); 

  // 1. Emission: Create new sparks based on mouse movement
  if (mouseIsFollowed()) {
    for (let i = 0; i < NUM_SPARKS_PER_FRAME; i++) {
      // Emit spark at the current mouse location
      particles.push(new Particle(mouseX, mouseY));
    }
  }

  // 2. Update and Display Particles
  // Iterate backward to safely remove elements while looping
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.show();

    // Remove particle if it's expired
    if (p.isDead()) {
      particles.splice(i, 1);
    }
  }
}

// Optional: Add a visual cue or reset if the mouse is not moving much
function mouseMoved() {
  // Simply ensuring the loop runs when the mouse moves is enough for emission,
  // but we can use mouseMoved to make the emission more responsive.
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}