let particles = [];
const NUM_PARTICLES = 100;
const BLUE_HUE = 200; // A calming blue hue

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    // Initial velocity simulating gentle flow
    this.vel = p5.Vector.random2D().mult(random(0.1, 1.5));
    this.acc = createVector(0, 0);
    this.lifespan = 255;
    this.radius = random(1, 3);
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0); // Reset acceleration

    this.lifespan -= 1.5;
  }

  display() {
    // Color based on blue hue, fading out
    stroke(BLUE_HUE, 100, 255, this.lifespan);
    strokeWeight(this.radius);
    point(this.pos.x, this.pos.y);
  }
}

function setup() {
  createCanvas(800, 600);
  background(20, 20, 40); // Dark, deep blue background
}

function draw() {
  // Create a faint, semi-transparent background overlay to create the "flow" trail effect
  background(20, 20, 40, 50);

  // 1. Update and Display Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.display();

    // Remove dead particles
    if (p.lifespan < 0) {
      particles.splice(i, 1);
    }
  }

  // 2. Gentle attraction/flow force (Simulating a subtle current)
  let flowForce = createVector(0, 0.1); // Slight downward drift
  let center = createVector(width / 2, height / 2);
  
  // Apply a slight attraction towards the center, simulating a vortex or gentle current
  for (let p of particles) {
    let attraction = p5.Vector.sub(center, p.pos);
    attraction.normalize();
    attraction.mult(0.005); // Very weak pull
    
    p.applyForce(flowForce);
    p.applyForce(attraction);
  }

  // 3. Spawn new particles periodically to keep the system active
  if (random(1) < 0.15) {
    let x = random(width);
    let y = random(height);
    particles.push(new Particle(x, y));
  }
}

// Optional: Add a slight burst on mouse interaction for user control
function mouseMoved() {
    // When the mouse moves, spawn a small burst of particles near it
    for (let i = 0; i < 3; i++) {
        particles.push(new Particle(mouseX, mouseY));
    }
}