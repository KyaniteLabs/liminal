let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  // Semi-transparent background for fade-out effect
  background(0, 20);

  // Create new particles at mouse position
  for (let i = 0; i < 5; i++) {
    particles.push(new Particle(mouseX, mouseY));
  }

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    
    // Remove dead particles
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

// Particle class
class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 5));
    this.acc = createVector(0, 0.1); // Gravity
    this.color = color(random(150, 255), random(150, 255), random(150, 255));
    this.size = random(3, 8);
    this.lifespan = 255;
    this.fadeRate = random(2, 5);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.lifespan -= this.fadeRate;
  }

  display() {
    fill(red(this.color), green(this.color), blue(this.color), this.lifespan);
    circle(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}

// Resize canvas when window is resized
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}