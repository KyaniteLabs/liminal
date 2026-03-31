let fireworks = [];
let numFireworks = 50;
let gravity = 0.1;
let fadeSpeed = 0.02;
let noiseScale = 0.03;
let noiseOffset = 0;

function setup() {
  createCanvas(800, 600, WEBGL);
  pixelDensity(1);
  noiseSeed(12345);
  for (let i = 0; i < numFireworks; i++) {
    fireworks.push(new Firework());
  }
}

function draw() {
  background(0);
  noiseOffset += 0.01;
  for (let i = 0; i < fireworks.length; i++) {
    fireworks[i].update();
    fireworks[i].display();
  }
}

class Firework {
  constructor() {
    this.x = random(-width, width);
    this.y = random(-height, height);
    this.z = random(500, 800);
    this.size = random(10, 30);
    this.color = color(random(255), random(255), random(255), 150);
    this.velocity = createVector(0, 0, 0);
    this.trail = [];
    this.trailLength = 50;
  }

  update() {
    this.velocity.x = map(noise(this.x * noiseScale, this.y * noiseScale, noiseOffset), 0, 1, -1, 1);
    this.velocity.y = map(noise(this.x * noiseScale + 10, this.y * noiseScale + 10, noiseOffset), 0, 1, -1, 1);
    this.velocity.z = map(noise(this.x * noiseScale + 20, this.y * noiseScale + 20, noiseOffset), 0, 1, -1, 1);

    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.z += this.velocity.z;

    this.z -= gravity;

    if (this.z <= 0) {
      this.z = 0;
      this.velocity.z = 0;
    }

    this.trail.push({
      x: this.x,
      y: this.y,
      z: this.z,
      color: this.color
    });

    if (this.trail.length > this.trailLength) {
      this.trail.shift();
    }
  }

  display() {
    push();
    translate(this.x, this.y, this.z);
    noStroke();
    fill(this.color);
    sphere(this.size);
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trailLength, 0, 1);
      let c = color(this.color.r, this.color.g, this.color.b, alpha * 255);
      fill(c);
      sphere(this.size * (1 - i / this.trailLength));
    }
    pop();
  }
}