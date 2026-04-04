function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 1);
}

let fireworks = [];
const gravity = createVector(0, 0.06);

function draw() {
  // Semi-transparent background for trail effect
  background(0, 0, 0, 0.15);
  
  // Random launch
  if (random(1) < 0.04) {
    fireworks.push(new Firework());
  }
  
  // Update and draw
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].display();
    if (fireworks[i].isDone()) {
      fireworks.splice(i, 1);
    }
  }
}

function mousePressed() {
  fireworks.push(new Firework(mouseX, mouseY));
}

class Firework {
  constructor(x, y) {
    this.rocket = new Particle(x || random(width), y || height, true);
    this.exploded = false;
    this.particles = [];
    this.hue = random(360);
  }
  
  update() {
    if (!this.exploded) {
      this.rocket.applyForce(gravity);
      this.rocket.update();
      
      if (this.rocket.vel.y >= 0 || this.rocket.pos.y < height * 0.3) {
        this.explode();
      }
    }
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(gravity);
      this.particles[i].update();
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  explode() {
    this.exploded = true;
    let count = floor(random(80, 150));
    for (let i = 0; i < count; i++) {
      let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, false);
      p.hue = (this.hue + random(-20, 20)) % 360;
      p.vel = p5.Vector.random2D().mult(random(1, 8));
      this.particles.push(p);
    }
    // Add sparkles
    for (let i = 0; i < 20; i++) {
      let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, false);
      p.hue = this.hue;
      p.size = 1;
      p.vel = p5.Vector.random2D().mult(random(2, 5));
      p.decay = 0.02;
      this.particles.push(p);
    }
  }
  
  display() {
    if (!this.exploded) {
      this.rocket.display();
    }
    for (let p of this.particles) {
      p.display();
    }
  }
  
  isDone() {
    return this.exploded && this.particles.length === 0;
  }
}

class Particle {
  constructor(x, y, isRocket) {
    this.pos = createVector(x, y);
    this.vel = isRocket ? createVector(0, random(-12, -8)) : createVector(0, 0);
    this.acc = createVector(0, 0);
    this.hue = random(360);
    this.size = isRocket ? 4 : random(2, 5);
    this.alpha = 1;
    this.decay = random(0.008, 0.018);
    this.isRocket = isRocket;
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    if (!this.isRocket) {
      this.vel.mult(0.98);
      this.alpha -= this.decay;
    }
  }
  
  display() {
    noStroke();
    if (this.isRocket) {
      fill(40, 80, 100, this.alpha);
    } else {
      fill(this.hue, 85, 95, this.alpha);
    }
    ellipse(this.pos.x, this.pos.y, this.size);
    
    // Glow effect
    if (!this.isRocket) {
      fill(this.hue, 60, 80, this.alpha * 0.3);
      ellipse(this.pos.x, this.pos.y, this.size * 3);
    }
  }
  
  isDead() {
    return this.alpha <= 0;
  }
}