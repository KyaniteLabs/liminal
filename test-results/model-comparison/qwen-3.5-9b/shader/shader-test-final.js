let cols = [];
const WIDTH = 800;
const HEIGHT = 600;
const NUM_PARTICLES = 3000;
const DENSITY_THRESHOLD = 5.0;

function setup() {
  createCanvas(WIDTH, HEIGHT);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  noiseSeed(42);
  
  // Initialize columns with density values
  for (let i = 0; i < width + 1; i++) {
    cols.push(0);
  }
}

function windowResized() {
  resizeCanvas(WIDTH, HEIGHT);
  background(0);
  for (let i = 0; i < width + 1; i++) {
    cols[i] = 0;
  }
}

function draw() {
  // Fade effect to create trails
  fill(0, 20);
  noStroke();
  rect(0, 0, width, height);
  
  let hue = frameCount % 360;
  
  for (let x = 0; x < width; x++) {
    // Use noise to create organic wave patterns
    let n = map(noise(x * 0.015, frameCount * 0.02) + cols[x] * 0.01, -1, 1, 0, 1);
    
    // Emit particles based on noise intensity
    for (let i = 0; i < n * NUM_PARTICLES / width; i++) {
      let y = map(i, 0, n * NUM_PARTICLES / width, height, 0);
      
      // Add some randomness to position
      let px = x + random(-2, 2);
      let py = y + random(-2, 2);
      
      if (px >= 0 && px < width && py >= 0 && py < height) {
        cols[px]++;
        
        // Draw the particle with neon glow effect
        noStroke();
        fill(hue + frameCount * 2, 80, 100, 80);
        rect(px, py, 3, 3);
      }
    }
    
    // Decay density to prevent overflow
    cols[x] *= 0.95;
  }
}