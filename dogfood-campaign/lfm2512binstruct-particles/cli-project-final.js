function setup() {
  createCanvas(800, 600);
  noStroke();
  background(220); // Light gray background
}

function draw() {
  updateParticles();

  // Mouse position to emit sparks
  let mouseX = mouseX();
  let mouseY = height((pixelsSize) / 2 - mouseY);

  // Create a particle per mouse click
  for (let i = 0; i < 10; i++) {
    particles.push(createParticle(mouseX, mouseY));
  }
}

// Particle class
class Particle {
  constructor(x, y) {
    this.velocity = createVector(random(-3, 3), random(-3, 3));
    this.gravity = 0.5;
    this.lifetime = 60;
    this.alpha = max(0, 1 - (millis() / this.lifetime)); // Fade-out
    this.x = x;
    this.y = y;
  }

  updateParticles() {
    this.move(this.velocity);
    this.gravity();
    this.alpha -= 0.01; // Fade out
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }
}

function createParticle(x, y) {
  return new Particle(x, y);
}