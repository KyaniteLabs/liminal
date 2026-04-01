let particles = [];
let hue = 0;
const maxParticles = 200;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  noStroke();
}

function draw() {
  background(245);
  
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    
    if (p.x > width || p.x < 0 || p.y > height || p.y < 0) {
      particles.splice(i, 1);
      continue;
    }
    
    p.move();
    p.show();
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
  
  hue = (hue + 2) % 360;
}

class Particle {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(5, 15);
    this.speedX = random(-2, 2);
    this.speedY = random(-3, -1); // Move upwards primarily
    this.life = map(this.size, 5, 15, 0.01, 0.04);
    this.hueOffset = random(60);
    this.wobble = random(TWO_PI * 2);
    this.wobbleSpeed = random(0.02, 0.05);
  }

  move() {
    this.x += this.speedX;
    this.y += this.speedY + sin(this.wobble) * 1.5;
    this.wobble += this.wobbleSpeed;
    
    // Add some turbulence
    if (this.size > 8) {
      this.x += random(-0.5, 0.5);
    }
  }

  show() {
    let pColor = color((hue + this.hueOffset), 80, 90);
    fill(pColor);
    
    // Draw a soft circle with some transparency gradient effect
    noStroke();
    beginShape();
    for (let angle = 0; angle < TWO_PI; angle += 0.1) {
      let r = this.size * map(sin(angle), -1, 1, 0.5, 1.2);
      let px = this.x + cos(angle) * r;
      let py = this.y + sin(angle) * r;
      vertex(px, py);
    }
    endShape(CLOSE);
    
    // Add a small trail effect
    noFill();
    stroke(pColor);
    strokeWeight(2);
    line(this.x - 10, this.y, this.x + 10, this.y);
  }
}