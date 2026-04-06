
let particles = [];
const numParticles = 600;
const noiseScale = 0.008;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(10, 20, 40);
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  // Soft trail effect
  background(10, 20, 40, 25);
  for (let p of particles) {
    p.update();
    p.display();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 1.2;
    this.prevPos = this.pos.copy();
    // Calm blue palette
    this.hue = random(200, 240);
    this.sat = random(70, 110);
    this.bright = random(85, 100);
  }

  update() {
    // Use Perlin noise for a smooth flow field
    let angle = noise(this.pos.x * noiseScale, this.pos.y * noiseScale) * TWO_PI * 2;
    let force = p5.Vector.fromAngle(angle);
    force.mult(0.4);
    this.acc.add(force);
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Wrap around edges
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  display() {
    stroke(this.hue, this.sat, this.bright, 120);
    strokeWeight(1.2);
    line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
    this.prevPos = this.pos.copy();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
