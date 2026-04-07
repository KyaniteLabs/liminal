
let particles = [];
const numParticles = 900;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function draw() {
  // Deep blue background with low opacity for trails
  background(220, 80, 10, 15);
  for (let p of particles) {
    p.update();
    p.display();
  }
}

class Particle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = random(0.3, 1.2);
    this.noiseScale = random(0.001, 0.003);
    // Slight hue variation within blue range
    this.hue = random(200, 240);
    this.saturation = random(60, 90);
    this.brightness = random(80, 100);
    this.size = random(2, 4);
  }

  update() {
    // Use Perlin noise to create a smooth flow field
    let angle = noise(this.pos.x * this.noiseScale, this.pos.y * this.noiseScale) * TWO_PI * 2;
    let force = p5.Vector.fromAngle(angle);
    force.mult(0.1);
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
    noStroke();
    fill(this.hue, this.saturation, this.brightness, 40);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
