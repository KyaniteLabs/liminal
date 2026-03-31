let fireworks = [];
let particles = [];

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  background(10, 10, 20);
}

function draw() {
  background(10, 10, 20, 40);

  if (random() < 0.05) {
    fireworks.push(new Firework(random(width), height));
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].draw();
    if (fireworks[i].explode()) {
      createExplosion(fireworks[i].x, fireworks[i].y);
      fireworks.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].applyForce(createVector(0, 0.15));
    particles[i].update();
    particles[i].draw();
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

function createExplosion(x, y) {
  let hue = random(360);
  let numParticles = 100 + floor(random(50));
  
  for (let i = 0; i < numParticles; i++) {
    let angle = random(TWO_PI);
    let speed = random(2, 10);
    let vel = createVector(cos(angle) * speed, sin(angle) * speed);
    let col = colorMode(HSB, 360, 100, 100, 100);
    let c = color(hue + random(-30, 30), 80, 100, 100);
    colorMode(RGB, 255, 255, 255, 255);
    particles.push(new Particle(x, y, vel, c));
  }
}

class Firework {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vel = createVector(0, random(-12, -8));
    this.acc = createVector(0, 0);
    this.trail = [];
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 10) this.trail.shift();
    
    this.vel.add(this.acc);
    this.y += this.vel.y;
    this.acc.mult(0);
  }

  draw() {
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 50, 200);
      stroke(255, 255, 255, alpha);
      noFill();
      ellipse(this.trail[i].x, this.trail[i].y, 2);
    }
    fill(255);
    noStroke();
    ellipse(this.x, this.y, 4);
  }

  explode() {
    return this.vel.y >= 0;
  }
}

class Particle {
  constructor(x, y, vel, col) {
    this.pos = createVector(x, y);
    this.vel = vel;
    this.acc = createVector(0, 0);
    this.col = col;
    this.lifespan = 255;
    this.decay = random(1.5, 3.5);
    this.trail = [];
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.trail.push({x: this.pos.x, y: this.pos.y});
    if (this.trail.length > 8) this.trail.shift();
    
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.vel.mult(0.98);
    this.lifespan -= this.decay;
  }

  draw() {
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 0, this.lifespan * 0.5);
      let sz = map(i, 0, this.trail.length, 1, 3);
      let c = color(red(this.col), green(this.col), blue(this.col), alpha);
      fill(c);
      noStroke();
      ellipse(this.trail[i].x, this.trail[i].y, sz);
    }
    
    let c = color(red(this.col), green(this.col), blue(this.col), this.lifespan);
    fill(c);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 3);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(10, 10, 20);
}