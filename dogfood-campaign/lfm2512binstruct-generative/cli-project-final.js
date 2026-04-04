function setup() {
  createCanvas(800, 600);
  noLoop(); // We'll use loop in draw()
  
  // Generate noise values for each point
  generateNoiseGrid();
}

function draw() {
  background(220); // Light gray background

  // Generate a grid of points for Perlin noise
  const width = width;
  const height = height;
  const points = createPerlinPointGrid(width, height);
  
  // Draw the lines with color gradients
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      float noiseValue = getNoise(x / 20, y / 20); // Scale and offset
      color(noiseValue * 255);
      line(x - width/2, y - width/2 + noiseValue*10, x + width/2, y - width/2 + noiseValue*10);
    }
  }
}

// Utility: Generate Perlin-like noise values
function generateNoiseGrid(width, height) {
  const noise = createNoise();
  const size = Math.max(width / 10, height / 10); // Scale for smoothness
  let noiseValues = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Normalize and scale to [-1, 1]
      const nx = x / size;
      const ny = y / size;
      const value = noise(nx, ny);
      // Use a gradient based on noise intensity
      const hue = map(value * 360, 0, 1, 0, 255); // Map to 0-255
      noiseValues.push(hue);
    }
  }

  return noiseValues;
}

// Utility: Create Perlin-like grid (simple pseudo-Perlin)
function getNoise(x, y) {
  const frequency = 6;
  const scale = 2.0 * pow(sin((x / 100) + y / 100), frequency);
  return sin(rad2deg(frequency * x) * scale) + cos(rad2deg(frequency * y));
}