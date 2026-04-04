let fireworks = [];
let particles = [];

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 5, 25);
  
  if (random(1) < 0.04) {
    fireworks.push(new Firework());
  }
  
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].show();
    
    if (fireworks[i].explode()) {
      let hue = random(360);
      for (let j = 0; j < 80; j++) {
        particles.push(new Particle(fireworks[i].x, fireworks[i].y, hue));
      }
      fireworks.splice(i, 1);
    }
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].applyForce(createVector(0, 0.08));
    particles[i].update();
    particles[i].show();
    
    if (particles[i].isDead()) {
      particles.splice(i, 1);
    }
  }
}

class Firework {
  constructor() {
    this.pos = createVector(random(100, width - 100), height);
    this.vel = createVector(random(-1, 1), random(-14, -10));
    this.trail = [];
    this.historySize = 12;
  }
  
  update() {
    this.trail.push(this.pos.copy());
    if (this.trail.length > this.historySize) {
      this.trail.shift();
    }
    this.pos.add(this.vel);
  }
  
  show() {
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 0, 100);
      let size = map(i, 0, this.trail.length, 1, 3);
      fill(45, 20, 100, alpha);
      ellipse(this.trail[i].x, this.trail[i].y, size);
    }
    fill(45, 20, 100);
    ellipse(this.pos.x, this.pos.y, 4);
  }
  
  explode() {
    return this.vel.y >= -2;
  }
}

class Particle {
  constructor(x, y, hue) {
    this.pos = createVector(x, y);
    this.prevPos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.vel.mult(random(2, 8));
    this.hue = hue + random(-20, 20);
    this.sat = random(70, 100);
    this.bri = random(85, 100);
    this.alpha = 100;
    this.decay = random(0.8, 1.5);
    this.acc = createVector(0, 0);
    this.trail = [];
    this.trailSize = 8;
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  update() {
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
    this.vel.add(this.acc);
    this.vel.mult(0.97);
    this.pos.add(this.vel);
    this.acc.mult(0);
    this.alpha -= this.decay;
    
    this.trail.push(this.pos.copy());
    if (this.trail.length > this.trailSize) {
      this.trail.shift();
    }
  }
  
  show() {
    noStroke();
    
    for (let i = 0; i < this.trail.length; i++) {
      let tAlpha = map(i, 0, this.trail.length, 0, this.alpha * 0.5);
      let size = map(i, 0, this.trail.length, 1, 4);
      fill(this.hue, this.sat, this.bri, tAlpha);
      ellipse(this.trail[i].x, this.trail[i].y, size);
    }
    
    stroke(this.hue, this.sat, this.bri, this.alpha);
    strokeWeight(2);
    line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
    
    noStroke();
    fill(this.hue, this.sat, this.bri, this.alpha);
    ellipse(this.pos.x, this.pos.y, 3);
  }
  
  isDead() {
    return this.alpha <= 0;
  }
}

function mousePressed() {
  for (let i = 0; i < 60; i++) {
    particles.push(new Particle(mouseX, mouseY, random(360)));
  }
}