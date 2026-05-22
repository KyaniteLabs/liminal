let particles = [];

function setup() {
  createCanvas(600, 600);
  colorMode(HSB, 360, 100, 100, 100);
  for (let i = 0; i < 120; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(220, 15, 8);
  for (let p of particles) {
    p.update();
    p.show();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(random(-1, 1), random(-1, 1));
    this.acc = createVector(0, 0);
    this.size = random(3, 10);
    this.hue = random(160, 220);
    this.prev = this.pos.copy();
  }

  update() {
    let angle = noise(this.pos.x * 0.005, this.pos.y * 0.005, frameCount * 0.005) * TWO_PI * 4;
    this.acc = p5.Vector.fromAngle(angle).mult(0.15);
    this.vel.add(this.acc);
    this.vel.limit(2.5);
    this.prev = this.pos.copy();
    this.pos.add(this.vel);
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  show() {
    stroke(this.hue, 70, 85, 60);
    strokeWeight(this.size * 0.6);
    line(this.prev.x, this.prev.y, this.pos.x, this.pos.y);
    noStroke();
    fill(this.hue, 50, 95, 80);
    circle(this.pos.x, this.pos.y, this.size);
  }
}
