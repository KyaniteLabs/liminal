var fireworks = [];
var stars = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noiseSeed(99);
  
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: random(width),
      y: random(height * 0.7),
      size: random(0.5, 2),
      brightness: random(100, 255)
    });
  }
}

function draw() {
  background(10, 10, 25, 50);
  
  for (let s of stars) {
    let twinkle = noise(s.x * 0.1, s.y * 0.1, frameCount * 0.02) * 100;
    fill(255, s.brightness + twinkle - 50);
    noStroke();
    ellipse(s.x, s.y, s.size);
  }
  
  if (random(1) < 0.08) {
    let hue = random(360);
    let x = random(width * 0.2, width * 0.8);
    let y = random(height * 0.2, height * 0.5);
    fireworks.push(new Firework(x, y, hue));
  }
  
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].display();
    if (fireworks[i].finished()) {
      fireworks.splice(i, 1);
    }
  }
}

class Firework {
  constructor(x, y, hue) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, -random(8, 14));
    this.acc = createVector(0, 0);
    this.hue = hue;
    this.exploded = false;
    this.particles = [];
    this.trail = [];
  }
  
  explode() {
    let particleCount = floor(random(80, 150));
    for (let i = 0; i < particleCount; i++) {
      let angle = random(TWO_PI);
      let speed = random(2, 8) + noise(i * 0.1, frameCount * 0.01) * 4;
      let pVel = createVector(cos(angle) * speed, sin(angle) * speed);
      let pHue = this.hue + random(-30, 30);
      this.particles.push(new Particle(this.pos.x, this.pos.y, pVel, pHue));
    }
  }
  
  update() {
    if (!this.exploded) {
      this.vel.add(createVector(0, 0.15));
      this.pos.add(this.vel);
      this.trail.push({x: this.pos.x, y: this.pos.y});
      if (this.trail.length > 15) this.trail.shift();
      
      if (this.vel.y > -1) {
        this.explode();
        this.exploded = true;
      }
    } else {
      for (let p of this.particles) {
        p.update();
      }
    }
  }
  
  display() {
    if (!this.exploded) {
      noStroke();
      for (let i = 0; i < this.trail.length; i++) {
        let alpha = map(i, 0, this.trail.length, 50, 255);
        let size = map(i, 0, this.trail.length, 1, 4);
        colorMode(HSB);
        fill(this.hue, 80, 100, alpha / 255);
        ellipse(this.trail[i].x, this.trail[i].y, size);
        colorMode(RGB);
      }
    } else {
      for (let p of this.particles) {
        p.display();
      }
    }
  }
  
  finished() {
    if (!this.exploded) return false;
    for (let p of this.particles) {
      if (!p.finished()) return false;
    }
    return this.particles.length === 0;
  }
}

class Particle {
  constructor(x, y, vel, hue) {
    this.pos = createVector(x, y);
    this.vel = vel;
    this.acc = createVector(0, 0);
    this.hue = hue;
    this.alpha = 255;
    this.decay = random(2, 5);
    this.trail = [];
  }
  
  update() {
    this.acc = createVector(0, 0.08);
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.alpha -= this.decay;
    
    this.trail.push({x: this.pos.x, y: this.pos.y});
    if (this.trail.length > 12) this.trail.shift();
  }
  
  display() {
    if (this.trail.length > 1) {
      noFill();
      strokeWeight(2);
      colorMode(HSB);
      for (let i = 0; i < this.trail.length - 1; i++) {
        let alpha = map(i, 0, this.trail.length, 0, this.alpha);
        stroke(this.hue + noise(this.pos.x * 0.01, frameCount * 0.05) * 20 - 10, 70, 100, alpha / 255);
        line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
      }
      colorMode(RGB);
    }
    
    noStroke();
    colorMode(HSB);
    fill(this.hue, 60, 100, this.alpha / 255);
    let size = map(this.alpha, 0, 255, 1, 4);
    ellipse(this.pos.x, this.pos.y, size);
    colorMode(RGB);
  }
  
  finished() {
    return this.alpha <= 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: random(width),
      y: random(height * 0.7),
      size: random(0.5, 2),
      brightness: random(100, 255)
    });
  }
}