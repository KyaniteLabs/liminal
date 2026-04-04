let fireworks = [];
const GRAVITY = 0.1;
const NUM_PARTICLES = 60;

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = random(-2, 2);
    this.vy = random(-10, -5); // Start moving upwards slightly, or just use gravity effect
    this.color = color;
    this.alpha = 255;
    this.size = random(2, 4);
    this.life = 255;
  }

  update() {
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    
    // Fade effect
    this.alpha -= 3;
    this.life -= 2;
    this.size *= 0.98; // Shrink slightly over time
  }

  show() {
    stroke(this.color.r, this.color.g, this.color.b, this.alpha);
    strokeWeight(this.size);
    point(this.x, this.y);
  }

  isFinished() {
    return this.alpha < 0 || this.size < 0.2;
  }
}

class Firework {
  constructor(x, y) {
    this.particles = [];
    this.x = x;
    this.y = y;
    this.explode();
  }

  explode() {
    let baseColor = color(random(360), 100, 100); // HSB for vibrant colors
    for (let i = 0; i < NUM_PARTICLES; i++) {
      // Calculate random angle and velocity for outward burst
      let angle = random(TWO_PI);
      let speed = random(2, 8);
      
      let p = new Particle(this.x, this.y, baseColor);
      p.vx = cos(angle) * speed;
      p.vy = sin(angle) * speed * 1.5; // Give a strong initial upward/outward push
      this.particles.push(p);
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.update();
      if (p.isFinished()) {
        this.particles.splice(i, 1);
      }
    }
  }

  show() {
    for (let p of this.particles) {
      p.show();
    }
  }

  isDone() {
    return this.particles.length === 0;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 255);
}

function draw() {
  // Create the night sky effect with fading trails:
  // Drawing a semi-transparent black rectangle over the previous frame
  background(0, 0, 0, 15); 

  // Randomly launch new fireworks occasionally
  if (random(1) < 0.15) {
    let x = random(width * 0.1, width * 0.9);
    let y = random(height * 0.1, height * 0.4); // Launch from upper half of screen
    fireworks.push(new Firework(x, y));
  }

  // Update and display all fireworks
  for (let i = fireworks.length - 1; i >= 0; i--) {
    let fw = fireworks[i];
    fw.update();
    fw.show();

    if (fw.isDone()) {
      fireworks.splice(i, 1);
    }
  }
}