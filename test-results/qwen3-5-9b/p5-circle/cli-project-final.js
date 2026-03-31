let particleSystem = [];
const particleCount = 300;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  
  // Seed the noise function so it behaves consistently across runs
  noiseSeed(42); 
  
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(255, 10); // Trail effect
  
  noStroke();
  
  let hueVal = map(noise(frameCount * 0.001), 0, 1, 240, 360);
  
  for (let particle of particles) {
    particle.update(hueVal);
    particle.show();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(0.5);
    this.acc = createVector(0, 0);
    
    this.size = random(3, 15);
  }
  
  update(hueVal) {
    // Use noise to create organic movement based on position and time
    let nX = noise(this.pos.x * 0.01 + frameCount * 0.002);
    let nY = noise(this.pos.y * 0.01 + frameCount * 0.003);
    
    // Apply noise influence to acceleration
    this.acc.x += (nX - 0.5) * 0.2;
    this.acc.y += (nY - 0.5) * 0.2;
    
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    
    // Friction to slow down slightly over time for organic feel
    this.vel.mult(0.98);
    
    // Bounce off walls gently
    if (this.pos.x < 0 || this.pos.x > width) {
      this.vel.x *= -1;
    }
    if (this.pos.y < 0 || this.pos.y > height) {
      this.vel.y *= -1;
    }
    
    // Color variation based on noise and position
    let h = map(noise(this.pos.x * 0.01 + frameCount * 0.005), 0, 1, hueVal - 30, hueVal + 30);
    let s = 80;
    let l = 60;
    
    this.color = color(h, s, l);
  }
  
  show() {
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}