let particles = [];

function setup() {
  createCanvas(600, 600);
  colorMode(HSB, 360, 100, 100, 1);
  for (let i = 0; i < 200; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(20, 30, 8);
  for (let p of particles) {
    p.update();
    p.show();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = random(2, 4);
    this.hue = random(160, 220);
    this.size = random(3, 10);
    this.prevPos = this.pos.copy();
  }

  update() {
    let angle = noise(this.pos.x * 0.005, this.pos.y * 0.005, frameCount * 0.005) * TWO_PI * 4;
    this.acc = p5.Vector.fromAngle(angle).mult(0.15);
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.prevPos = this.pos.copy();
    this.pos.add(this.vel);

    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.y < 0) this.pos.y = height;
    if (this.pos.y > height) this.pos.y = 0;
  }

  show() {
    let speed = this.vel.mag();
    let alpha = map(speed, 0, this.maxSpeed, 0.2, 0.9);
    stroke(this.hue, 80, 90, alpha);
    strokeWeight(this.size * 0.6);
    line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
  }
}
