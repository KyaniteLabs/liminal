let particles = [];

function setup() {
  createCanvas(600, 600);
  colorMode(HSB, 360, 100, 100, 1);
  for (let i = 0; i < 120; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(220, 15, 8, 0.18);
  for (let p of particles) {
    p.update();
    p.show();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(random(0.3, 1.5));
    this.size = random(3, 10);
    this.hue = random(160, 210);
    this.noiseOff = random(1000);
  }

  update() {
    let angle = noise(this.pos.x * 0.005, this.pos.y * 0.005, this.noiseOff) * TWO_PI * 3;
    this.vel.lerp(p5.Vector.fromAngle(angle).mult(1.2), 0.04);
    this.pos.add(this.vel);
    if (this.pos.x < -20) this.pos.x = width + 20;
    if (this.pos.x > width + 20) this.pos.x = -20;
    if (this.pos.y < -20) this.pos.y = height + 20;
    if (this.pos.y > height + 20) this.pos.y = -20;
  }

  show() {
    noStroke();
    fill(this.hue, 75, 85, 0.7);
    circle(this.pos.x, this.pos.y, this.size);
    stroke(this.hue, 60, 95, 0.35);
    strokeWeight(1.2);
    let tail = p5.Vector.sub(this.pos, this.vel.copy().mult(8));
    line(this.pos.x, this.pos.y, tail.x, tail.y);
  }
}
