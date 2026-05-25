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
    this.vel = createVector(random(-1.5, 1.5), random(-1.5, 1.5));
    this.acc = createVector(0, 0);
    this.size = random(4, 14);
    this.hue = random(160, 220);
    this.sat = random(60, 95);
    this.bright = random(70, 100);
    this.alpha = random(50, 90);
    this.noiseOff = random(1000);
  }

  update() {
    let angle = noise(this.noiseOff) * TWO_PI * 3;
    let force = p5.Vector.fromAngle(angle).mult(0.08);
    this.acc.add(force);
    this.vel.add(this.acc);
    this.vel.limit(2.5);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.noiseOff += 0.006;

    if (this.pos.x < -20) this.pos.x = width + 20;
    if (this.pos.x > width + 20) this.pos.x = -20;
    if (this.pos.y < -20) this.pos.y = height + 20;
    if (this.pos.y > height + 20) this.pos.y = -20;
  }

  show() {
    noStroke();
    fill(this.hue, this.sat, this.bright, this.alpha);
    ellipse(this.pos.x, this.pos.y, this.size);

    stroke(this.hue, this.sat - 20, this.bright, this.alpha * 0.35);
    strokeWeight(1.5);
    let tailX = this.pos.x - this.vel.x * 10;
    let tailY = this.pos.y - this.vel.y * 10;
    line(this.pos.x, this.pos.y, tailX, tailY);
  }
}
