let fireworks = [];
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 0, 10, 10); // Dark night sky with slight fade effect

  // Create new fireworks randomly
  if (random(1) < 0.08) {
    let x = random(width);
    let y = random(height * 0.4, height * 0.7);
    fireworks.push(new Firework(x, y));
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
    let p = particles[i];
    p.update();
    p.show();
    if (p.done()) {
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
    this.velocity = createVector(random(-2, 2), random(-10, -15));
    this.acceleration = createVector(0, 0.1);
    this.particles = [];
    this.trail = [];
    this.maxTrail = 10;
  }

  update() {
    if (!this.exploded) {
      // Rocket ascent phase
      this.velocity.add(this.acceleration);
      this.x += this.velocity.x;
      this.y += this.velocity.y;

      this.trail.push(createVector(this.x, this.y));
      if (this.trail.length > this.maxTrail) {
        this.trail.shift();
      }

      // Check for explosion condition (y velocity slowing down or reaching peak)
      if (this.velocity.y >= 0 && this.y < height * 0.3) {
        this.explode();
      }
    } else {
      // After explosion, the firework object itself is effectively done,
      // its particles handle the rest.
    }
  }

  show() {
    if (!this.exploded) {
      // Draw rocket body trail
      stroke(this.hue, 100, 100, 100);
      strokeWeight(3);
      for (let i = 0; i < this.trail.length; i++) {
        let p = this.trail[i];
        let alpha = map(i, 0, this.trail.length - 1, 0, 100);
        stroke(this.hue, 100, 100, alpha);
        point(p.x, p.y);
      }
      
      // Draw the current position
      fill(this.hue, 100, 100, 100);
      noStroke();
      ellipse(this.x, this.y, 5, 5);
    }
  }

  explode() {
    this.exploded = true;
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
      let p = new Particle(this.x, this.y, this.hue);
      particles.push(p);
    }
  }

  done() {
    return this.exploded && this.trail.length === 0;
  }
}

class Particle {
  constructor(x, y, hue) {
    this.x = x;
    this.y = y;
    this.hue = hue;
    this.lifespan = 100;
    this.radius = random(2, 5);
    
    // Initial velocity (explosion force)
    let angle = random(TWO_PI);
    let speed = random(3, 8);
    this.velocity = createVector(cos(angle) * speed, sin(angle) * speed);
    
    // Gravity effect
    this.acceleration = createVector(0, 0.1);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.lifespan -= 2;
  }

  show() {
    stroke(this.hue, 100, 100, this.lifespan / 100 * 100);
    strokeWeight(this.radius);
    noFill();
    ellipse(this.x, this.y, this.radius, this.radius);
  }

  done() {
    return this.lifespan <= 0;
  }
}