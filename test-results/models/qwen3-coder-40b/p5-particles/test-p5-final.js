let particles = [];
const numParticles = 400;
const trailFade = 30;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(10);
}

function draw() {
  // Create fading trails with semi-transparent black
  fill(0, trailFade);
  noStroke();
  rect(0, 0, width, height);

  for (let p of particles) {
    p.update();
    p.show();
  }
}

class Particle {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.vx = random(-3, 3);
    this.vy = random(-3, 3);
    this.size = random(2, 5);
    this.life = 1;
    this.decay = random(0.98, 0.995);
  }

  update() {
    // Move particle
    this.x += this.vx;
    this.y += this.vy;

    // Add wave-like motion for more interesting trails
    this.x += sin(frameCount * 0.1 + this.x) * 0.5;
    this.y += cos(frameCount * 0.1 + this.y) * 0.5;

    // Slowly decay velocity to create smooth movement
    this.vx *= this.decay;
    this.vy *= this.decay;

    // Add slight acceleration toward center for cohesion
    let dx = width / 2 - this.x;
    let dy = height / 2 - this.y;
    this.vx += dx * 0.0005;
    this.vy += dy * 0.0005;

    // Wrap around screen edges
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  show() {
    // Dynamic blue color based on particle life and motion
    let speed = sqrt(this.vx * this.vx + this.vy * this.vy);
    let b = map(speed, 0, 5, 200, 255); // Brighter when moving faster
    fill(0, 100, b, 200);
    
    // Draw particle as a circle
    ellipse(this.x, this.y, this.size);
  }
}

// Initialize particles on window load
function windowReady() {
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle());
  }
}

window.onload = windowReady;

// Handle window resize
function windowResize() {
  resizeCanvas(windowWidth, windowHeight);
  // Re-initialize particles if the significant change in size
  if (particles.length < numParticles) {
    for (let i = 0; i < numParticles - particles.length; i++) {
      particles.push(new Particle());
    }
  }
}

window.onresize = windowResize;