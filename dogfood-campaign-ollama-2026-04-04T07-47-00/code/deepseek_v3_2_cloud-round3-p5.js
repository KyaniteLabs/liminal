let fireworks = [];
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
}

function draw() {
  // Darken the background slightly each frame to create fading trails effect
  background(0, 0, 10, 50);

  // 1. Create new fireworks randomly
  if (random(1) < 0.05) {
    fireworks.push(new Firework(random(width), random(height)));
  }

  // 2. Update and display fireworks
  for (let i = fireworks.length - 1; i >= 0; i--) {
    let firework = fireworks[i];
    firework.update();
    firework.show();

    if (firework.exploded) {
      // When a firework explodes, it generates particles
      let newParticles = firework.explode();
      particles.push(...newParticles);
      fireworks.splice(i, 1); // Remove the spent firework rocket
    }
  }

  // 3. Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.show();

    if (p.done()) {
      particles.splice(i, 1);
    }
  }
}

// --- Particle Class ---
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-2, 2);
    this.color = color;
    this.lifespan = 255;
  }

  update() {
    // Apply gravity
    this.vy += 0.1;
    // Update position
    this.x += this.vx;
    this.y += this.vy;
    // Fade out
    this.lifespan -= 5;
    return this.lifespan > 0;
  }

  show() {
    stroke(this.color, this.lifespan);
    strokeWeight(3);
    point(this.x, this.y);
  }

  done() {
    return this.lifespan <= 0;
  }
}

// --- Firework Class ---
class Firework {
  constructor(startX, startY) {
    this.x = startX;
    this.y = startY;
    this.targetX = random(width * 0.1, width * 0.9);
    this.targetY = random(height * 0.1, height * 0.5);
    this.color = color(random(255), random(255), random(255));
    this.distanceToTarget = dist(this.x, this.y, this.targetX, this.targetY);
    this.speed = random(3, 6);
    this.angle = atan2(this.targetY - this.y, this.targetX - this.x);
    this.vx = cos(this.angle) * this.speed;
    this.vy = sin(this.angle) * this.speed;
    this.exploded = false;
  }

  update() {
    if (!this.exploded) {
      this.x += this.vx;
      this.y += this.vy;
      // Check if we are near the target
      if (dist(this.x, this.y, this.targetX, this.targetY) < this.speed * 2) {
        this.exploded = true;
      }
    }
  }

  show() {
    if (!this.exploded) {
      stroke(this.color);
      strokeWeight(2);
      point(this.x, this.y);
    }
  }

  explode() {
    const count = 80;
    let newParticles = [];
    for (let i = 0; i < count; i++) {
      // Create particles radiating outwards
      let angle = random(TWO_PI);
      let speed = random(1, 8);
      let p = new Particle(this.x, this.y, this.color);
      p.vx = cos(angle) * speed;
      p.vy = sin(angle) * speed;
      newParticles.push(p);
    }
    return newParticles;
  }
}

function mousePressed() {
  // Launch a firework where the user clicks
  fireworks.push(new Firework(mouseX, mouseY));
}