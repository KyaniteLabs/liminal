let particles = [];
const numParticles = 500;
const size = 3;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
}

function draw() {
  background(0);
  
  for (let i = 0; i < numParticles; i++) {
    const particle = new Particle();
    particles.push(particle);
  }
  
  for (const particle of particles) {
    particle.update();
    particle.show();
  }
  
  particles = particles.slice(particles.length - size);
}

class Particle {
  constructor() {
    this.x = random(width);
    this.y = height;
    this.vx = noise(frameCount * 0.01, time / 10) * 5;
    this.vy = noise(time / 20) * 5;
  }
  
  update() {
    this.y -= this.vy;
    
    if (this.y < 0) {
      this.x = random(width);
      this.y = height;
      this.vx = noise(frameCount * 0.01, time / 10) * 5;
      this.vy = noise(time / 20) * 5;
    }
    
    this.x += this.vx;
  }
  
  show() {
    fill(random(255), random(255), random(255));
    ellipse(this.x, this.y, size);
  }
}