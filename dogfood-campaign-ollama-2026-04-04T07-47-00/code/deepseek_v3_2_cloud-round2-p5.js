let fireworks = [];
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);
}

function draw() {
  // Create the fading night sky effect by drawing a semi-transparent black rectangle over everything
  background(0, 0, 0, 20);

  // 1. Spawn new fireworks randomly
  if (random(1) < 0.05) {
    fireworks.push(new Firework(random(width), height));
  }

  // 2. Update and Draw Fireworks (Rockets ascending)
  for (let i = fireworks.length - 1; i >= 0; i--) {
    let firework = fireworks[i];
    firework.update();
    firework.show();

    if (firework.done()) {
      fireworks.splice(i, 1);
    }
  }

  // 3. Update and Draw Particles (Explosion remnants)
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.show();

    if (p.done()) {
      particles.splice(i, 1);
    }
  }
}

// ======================================================
// FIREWORK CLASS (Handles the rocket launch)
// ======================================================
class Firework {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.targetHeight = random(height * 0.1, height * 0.4); // Explode at 10% to 40% height
    this.speed = random(5, 10);
    this.angle = -PI / 2 + (random(-0.1, 0.1)); // Aim slightly upwards
    this.hue = random(360);
    this.exploded = false;
  }

  update() {
    if (!this.exploded) {
      // Move upwards towards the target height
      this.y -= this.speed * 0.5;
      this.speed *= 0.98; // Slow down slightly due to air resistance

      // Check for explosion trigger
      if (this.y < this.targetHeight) {
        this.explode();
        this.exploded = true;
      }
    }
  }

  show() {
    if (!this.exploded) {
      stroke(this.hue, 100, 100, 80);
      strokeWeight(3);
      point(this.x, this.y);
    }
  }

  explode() {
    // Create 100 particles at the explosion point
    for (let i = 0; i < 100; i++) {
      particles.push(new Particle(this.x, this.y, this.hue));
    }
  }

  done() {
    return this.exploded && this.y < 0; // Remove if exploded and off screen
  }
}

// ======================================================
// PARTICLE CLASS (Handles the explosion fragments)
// ======================================================
class Particle {
  constructor(x, y, hue) {
    this.x = x;
    this.y = y;
    this.r = random(2, 4);
    this.hue = hue;
    
    // Initial velocity: random direction radiating outward
    let angle = random(TWO_PI);
    let force = random(2, 8);
    this.vx = cos(angle) * force;
    this.vy = sin(angle) * force;
    
    this.lifespan = 100;
  }

  update() {
    // Apply gravity
    this.vy += 0.1;
    
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    
    // Fade over time
    this.lifespan -= 3;
    this.vx *= 0.99; // Air resistance
    this.vy *= 0.99;
  }

  show() {
    // Use lifespan for alpha fading
    let alpha = map(this.lifespan, 0, 100, 0, 100);
    stroke(this.hue, 100, 100, alpha);
    strokeWeight(this.r * (this.lifespan / 100));
    point(this.x, this.y);
  }

  done() {
    return this.lifespan <= 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}