// Calming blue particle system with flowing movement
// Run this in the p5.js web editor or include p5.js in an HTML file

let particles = [];
let flowField;
let cols, rows;
let scl = 20;
let zoff = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(220, 30, 10);
  
  cols = floor(width / scl);
  rows = floor(height / scl);
  flowField = new Array(cols * rows);
  
  for (let i = 0; i < 800; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  // Soft trail effect
  noStroke();
  fill(220, 30, 10, 5);
  rect(0, 0, width, height);
  
  // Update and draw particles
  for (let p of particles) {
    p.follow(flowField);
    p.update();
    p.edges();
    p.show();
  }
  
  // Update flow field using Perlin noise
  let yoff = 0;
  for (let y = 0; y < rows; y++) {
    let xoff = 0;
    for (let x = 0; x < cols; x++) {
      let index = x + y * cols;
      let angle = noise(xoff, yoff, zoff) * TWO_PI * 2;
      let v = p5.Vector.fromAngle(angle);
      v.setMag(1);
      flowField[index] = v;
      xoff += 0.1;
    }
    yoff += 0.1;
  }
  zoff += 0.005;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = floor(width / scl);
  rows = floor(height / scl);
  flowField = new Array(cols * rows);
}

// Particle class
class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 1.5;
    this.prevPos = this.pos.copy();
    // Gentle blue hue range
    this.hue = random(180, 240);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  follow(vectors) {
    let x = floor(this.pos.x / scl);
    let y = floor(this.pos.y / scl);
    let index = x + y * cols;
    let force = vectors[index];
    if (force) {
      this.applyForce(force);
    }
  }

  applyForce(force) {
    this.acc.add(force);
  }

  show() {
    stroke(this.hue, 80, 95, 50);
    strokeWeight(1);
    line(this.prevPos.x, this.prevPos.y, this.pos.x, this.pos.y);
    this.updatePrev();
  }

  updatePrev() {
    this.prevPos.x = this.pos.x;
    this.prevPos.y = this.pos.y;
  }

  edges() {
    if (this.pos.x > width) {
      this.pos.x = 0;
      this.updatePrev();
    }
    if (this.pos.x < 0) {
      this.pos.x = width;
      this.updatePrev();
    }
    if (this.pos.y > height) {
      this.pos.y = 0;
      this.updatePrev();
    }
    if (this.pos.y < 0) {
      this.pos.y = height;
      this.updatePrev();
    }
  }
}