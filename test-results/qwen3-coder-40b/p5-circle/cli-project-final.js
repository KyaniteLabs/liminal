function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
}

function draw() {
  background(255);
  fill(0, 0, 255);
  noStroke();
  circle(width / 2, height / 2, 100);
}