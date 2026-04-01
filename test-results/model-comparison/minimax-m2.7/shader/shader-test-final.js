let t = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
}

function draw() {
  background(0, 0, 0);
  
  let cellSize = 3;
  
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      let n1 = noise(x * 0.004, y * 0.004, t * 0.4);
      let n2 = noise(x * 0.008 + 50, y * 0.008 + 50, t * 0.6);
      let n3 = noise(x * 0.002 - 100, y * 0.002 - 100, t * 0.3);
      
      let plasma = sin(n1 * TWO_PI * 4) * 0.33;
      plasma += sin(n2 * TWO_PI * 3 + t) * 0.33;
      plasma += sin(n3 * TWO_PI * 5 - t * 0.7) * 0.34;
      plasma = (plasma + 1) * 0.5;
      
      let hue = (plasma * 360 + t * 60) % 360;
      let sat = 95;
      let bri = 60 + plasma * 40;
      
      fill(hue, sat, bri);
      rect(x, y, cellSize, cellSize);
    }
  }
  
  t += 0.015;
  
  noStroke();
  for (let i = 0; i < 40; i++) {
    fill(0, 0, 0, map(i, 0, 40, 8, 0));
    rect(0, 0, width, i);
    rect(0, height - i, width, i);
    rect(0, 0, i, height);
    rect(width - i, 0, i, height);
  }
}

function windowResized() {
  resizeCanvas(800, 600);
}