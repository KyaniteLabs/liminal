let x, y;
let speedX, speedY;
let noiseOffset = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  x = width / 2;
  y = height / 2;
  speedX = 2;
  speedY = 1.5;
}

function draw() {
  background(20, 25, 35);
  
  noiseOffset += 0.01;
  
  let noiseX = noise(noiseOffset) * 4 - 2;
  let noiseY = noise(noiseOffset + 1000) * 4 - 2;
  
  x += speedX + noiseX * 0.3;
  y += speedY + noiseY * 0.3;
  
  if (x > width - 50 || x < 50) speedX *= -1;
  if (y > height - 50 || y < 50) speedY *= -1;
  
  x = constrain(x, 50, width - 50);
  y = constrain(y, 50, height - 50);
  
  let pulse = sin(frameCount * 0.05) * 10;
  let circleSize = 80 + pulse;
  
  noFill();
  for (let i = 5; i > 0; i--) {
    let alpha = map(i, 5, 0, 30, 100);
    let size = circleSize + i * 15;
    stroke(100, 200, 255, alpha);
    strokeWeight(2);
    ellipse(x, y, size, size);
  }
  
  noStroke();
  let r = map(noise(noiseOffset + 500), 0, 1, 150, 255);
  let g = map(noise(noiseOffset + 600), 0, 1, 200, 255);
  let b = map(noise(noiseOffset + 700), 0, 1, 220, 255);
  fill(r, g, b);
  ellipse(x, y, circleSize, circleSize);
  
  fill(255, 255, 255, 100);
  ellipse(x - 10, y - 10, 15, 15);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}