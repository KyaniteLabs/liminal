function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(20);
  const count = 100;
  for (let i = 0; i < count; i++) {
    fill(255, 100 + i * 1.5, 150 + i * 1);
    ellipse(
      Math.random() * width,
      Math.random() * height,
      2 + Math.random() * 3,
      2 + Math.random() * 3
    );
  }
}