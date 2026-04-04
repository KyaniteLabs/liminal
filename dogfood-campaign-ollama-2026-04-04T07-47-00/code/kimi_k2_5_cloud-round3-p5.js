let fireworks = [];
let particles = [];
let gravity;

function setup() {
  createCanvas(windowWidth, windowHeight);
  gravity = createVector(0, 0.1);
}

function draw() {
  background(0, 0, 30);

  // Launch new fireworks randomly
  if (random(1) < 0.05) {
    fireworks.push(new Firework(random(width), random(height)));
  }

  // Update and display fireworks
  for (let i = fireworks.length - 1; i >= 0; i--) {
    let firework = fireworks[i];
    firework.update();
    firework.show();
    if (firework.done()) {
      fireworks.splice(i, 1);
    }
  }

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let particle = particles[i];
    particle.update();
    particle.show();
    if (particle.isFinished()) {
      particles.splice(i, 1);
    }
  }
}

class Firework {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.exploded = false;
    this.hue = random(360);
    this.rocket = new Particle(this.x, this.y, 0, -random(10, 15), 0, random(-0.5, 0.5), this.hue);
    this.particles = [];
    this.explosionRadius = 100;
  }

  update() {
    if (!this.exploded) {
      this.rocket.update();
      this.showRocket();
      
      let targetY = random(height * 0.2, height * 0.6);
      if (this.rocket.y < targetY) {
        this.explode();
      }
    } else {
      // Update explosion particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].update();
      }
    }
  }

  show() {
    if (!this.exploded) {
      this.rocket.show();
    } else {
      // Show explosion trails
      for (let p of this.particles) {
        p.show();
      }
    }
  }

  explode() {
    this.exploded = true;
    for (let i = 0; i < 100; i++) {
      this.particles.push(new Particle(this.rocket.x, this.rocket.y, 0, 0, 0, 0, this.hue, true));
    }
  }

  done() {
    return this.exploded && this.particles.every(p => p.isFinished());
  }
}

class Particle {
  constructor(x, y, vx, vy, ax, ay, hue, isExplosion = false) {
    this.pos = createVector(x, y);
    this.vel = createVector(vx, vy);
    this.acc = createVector(ax, ay);
    this.lifespan = 255;
    this.hue = hue;
    this.isExplosion = isExplosion;
    
    if (isExplosion) {
      this.lifespan = random(100, 200);
      this.size = random(2, 5);
    } else {
      this.size = 3;
    }
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0); // Reset acceleration
    
    this.lifespan -= 4; // Fade rate
    
    if (this.isExplosion) {
        this.lifespan -= 0.5; // Slower fade for explosion particles
    }
  }

  show() {
    stroke(this.hue, 200, 255, this.lifespan);
    strokeWeight(this.size);
    point(this.pos.x, this.pos.y);
  }

  isFinished() {
    return this.lifespan < 0;
  }
}