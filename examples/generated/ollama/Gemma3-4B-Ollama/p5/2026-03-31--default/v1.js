let fireworkCount = 100;
let particles = [];
let gravity = 0.1;
let fadeRate = 0.01;
let noiseScale = 0.02;
let noiseOffset = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  noiseSeed(12345);
  for (let i = 0; i < fireworkCount; i++) {
    particles.push(new Firework());
  }
}

function draw() {
  background(0);

  for (let i = 0; i < particles.length; i++) {
    particles[i].update();
    particles[i].display();
  }

  noiseOffset += 0.01;
}

class Firework {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(10, 30);
    this.speed = random(2, 5);
    this.color = color(random(255), random(255), random(255), random(150));
    this.trail = [];
  }

  update() {
    this.y -= this.speed;

    if (this.y < 0) {
      this.y = height;
      this.x = random(width);
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 50) {
      this.trail.shift();
    }

    this.x += noise(this.x * noiseScale, noiseOffset) * this.size * 0.2;
    this.y += noise(this.y * noiseScale, noiseOffset) * this.size * 0.2;
  }

  display() {
    noStroke();
    fill(this.color);
    ellipse(this.x, this.y, this.size, this.size);

    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 0, 255);
      let c = color(this.color.r, this.color.g, this.color.b, alpha);
      ellipse(this.trail[i].x, this.trail[i].y, this.size * 0.7, this.size * 0.7);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}