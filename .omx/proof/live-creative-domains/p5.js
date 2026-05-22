<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blue-Green Particles</title>
  <script src="https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.min.js"></script>
  <style>
    body { margin: 0; overflow: hidden; background: #0a0f14; }
  </style>
</head>
<body>
<script>
const particles = [];
const NUM = 200;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);
  noStroke();
  for (let i = 0; i < NUM; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(210, 40, 6, 0.15);
  for (let p of particles) {
    p.update();
    p.show();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class Particle {
  constructor() {
    this.reset(true);
  }

  reset(initial = false) {
    this.x = initial ? random(width) : random(-50, width + 50);
    this.y = initial ? random(height) : random(-50, height + 50);
    this.vx = random(-1.2, 1.2);
    this.vy = random(-1.2, 1.2);
    this.size = random(3, 12);
    this.hue = random(160, 220); // blue-green range
    this.sat = random(60, 95);
    this.bri = random(70, 100);
    this.alpha = random(0.4, 0.9);
    this.noiseOffX = random(1000);
    this.noiseOffY = random(2000);
    this.noiseSpeed = random(0.003, 0.01);
  }

  update() {
    let n = noise(this.noiseOffX, this.noiseOffY);
    let angle = n * TWO_PI * 2;
    this.vx += cos(angle) * 0.08;
    this.vy += sin(angle) * 0.08;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x += this.vx;
    this.y += this.vy;
    this.noiseOffX += this.noiseSpeed;
    this.noiseOffY += this.noiseSpeed;

    if (this.x < -60 || this.x > width + 60 || this.y < -60 || this.y > height + 60) {
      this.reset();
    }
  }

  show() {
    fill(this.hue, this.sat, this.bri, this.alpha);
    circle(this.x, this.y, this.size);

    // motion trail
    fill(this.hue, this.sat * 0.7, this.bri, this.alpha * 0.25);
    circle(this.x - this.vx * 4, this.y - this.vy * 4, this.size * 0.7);
  }
}
</script>
</body>
</html>
