let particles = [];
let numParticles = 200;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  fill(10, 20, 40, 25);
  rect(0, 0, width, height);
  
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
    this.maxSpeed = 2;
    this.prevPos = this.pos.copy();
  }
  
  update() {
    this.prevPos = this.pos.copy();
    
    let angle = noise(this.pos.x * 0.005, this.pos.y * 0.005, frameCount * 0.005) * TWO_PI * 2;
    let force = p5.Vector.fromAngle(angle);
    force.mult(0.5);
    
    this.acc.add(force);
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    
    if (this.pos.x > width) {
      this.pos.x = 0;
      this.prevPos.x = 0;
    }
    if (this.pos.x < 0) {
      this.pos.x = width;
      this.prevPos.x = width;
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
      this.prevPos.y = 0;
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
      this.prevPos.y = height;
    }
  }
  
  display() {
    let speed = this.vel.mag();
    let alpha = map(speed, 0, this.maxSpeed, 100, 255);
    let size = map(speed, 0, this.maxSpeed, 2, 6);
    
    fill(100, 180, 255, alpha);
    ellipse(this.pos.x, this.pos.y, size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}