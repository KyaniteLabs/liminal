let particles = [];
let trailStrength = 30;
let shapeSize = 12;
let timeScale = 0.005;

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = random(width);
    this.y = random(height);
    this.angle = random(TWO_PI);
    this.speed = random(1, 3);
    this.size = random(shapeSize - 4, shapeSize + 6);
    this.hueOffset = random(0, 360);
    this.turnSpeed = random(-0.05, 0.05);
    this.decay = random(0.97, 0.995);
  }

  update(time) {
    // Use noise for smooth, organic movement
    let noiseX = noise(this.x * 0.01, time) - 0.5;
    let noiseY = noise(this.y * 0.01, time) - 0.5;
    
    this.angle += this.turnSpeed + (noiseX * 0.2);
    
    this.x += cos(this.angle) * this.speed + noiseX * 3;
    this.y += sin(this.angle) * this.speed + noiseY * 3;
    
    // Bounce or wrap around screen
    if (this.x < 0 || this.x > width) {
      this.angle = PI - this.angle;
      this.x = constrain(this.x, 0, width);
    }
    if (this.y < 0 || this.y > height) {
      this.angle = -this.angle;
      this.y = constrain(this.y, 0, height);
    }
    
    // Randomly change size slightly
    this.size *= this.decay;
    if (this.size < 3) this.reset();
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.angle + time * 0.01);
    
    let hue = (millis() * 0.05 + this.hueOffset) % 360;
    colorMode(HSB);
    fill(hue, 80, 70);
    
    // Draw geometric shapes - alternating between triangles and squares
    if (floor(millis() / 200) % 2 === 0) {
      triangle(-this.size/2, this.size/2, this.size/2, this.size/2, 0, -this.size);
    } else {
      rect(0, 0, this.size, this.size);
    }
    
    // Add a second shape for complexity
    rotate(PI / 4);
    fill(hue + 180, 70, 60, 50);
    if (floor(millis() / 200) % 3 === 0) {
      circle(0, 0, this.size * 0.7);
    } else {
      triangle(-this.size/4, -this.size/4, this.size/4, -this.size/4, 0, this.size/2);
    }
    
    pop();
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  background(10);
  
  // Create initial particles
  for (let i = 0; i < 80; i++) {
    particles.push(new Particle());
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  let time = millis() * timeScale;
  
  // Create trails with semi-transparent background
  fill(10, trailStrength);
  rect(0, 0, width, height);
  
  // Draw each particle
  for (let i = 0; i < particles.length; i++) {
    particles[i].update(time);
    particles[i].draw();
  }
}