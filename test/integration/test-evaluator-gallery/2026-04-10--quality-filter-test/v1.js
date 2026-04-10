function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(frameCount % 360, 20, 90);
  fill(255);
  noStroke();
  for (let i = 0; i < 20; i++) {
    let x = width / 2 + cos(frameCount * 0.02 + i * 0.5) * (100 + i * 10);
    let y = height / 2 + sin(frameCount * 0.03 + i * 0.7) * (80 + i * 8);
    ellipse(x, y, 15 + sin(frameCount * 0.05 + i) * 5);
  }
}

function mousePressed() {
  background(0);
}
