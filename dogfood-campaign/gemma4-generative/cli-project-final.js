let noiseScale = 0.005; // Controls how stretched or compressed the noise pattern is
let flowSpeed = 0.005;  // Controls how fast the pattern evolves over time
let numLines = 15;      // Number of distinct flow lines to draw

function setup() {
  // Create the canvas to fill the window size
  createCanvas(windowWidth, windowHeight);
  // Set a smooth stroke weight for continuous lines
  strokeWeight(2);
  // No background fill so the lines look suspended
  background(0); 
  angleMode(DEGREES);
}

function draw() {
  // 1. Fading Background Effect
  // Instead of clearing the background completely, we draw a semi-transparent rectangle
  // over the top. This creates a smooth, lingering trail effect.
  fill(0, 5); // Low alpha value (5 out of 255)
  rect(0, 0, width, height);

  // 2. Drawing the Flowing Lines
  for (let i = 0; i < numLines; i++) {
    // Calculate the starting X position for this line (staggered across the screen)
    let startX = map(i, 0, numLines, 50, width - 50);
    
    beginShape();
    
    // We sample points from bottom to top (y from height to 0)
    for (let y = height; y > -height; y -= 5) {
      // Calculate the time offset based on the line index and current time
      let timeOffset = i * 0.5 + frameCount * flowSpeed;
      
      // --- Noise Calculation ---
      // Create an X coordinate that drifts over time (the 'flowing' element)
      let xCoord = map(noise(startX * noiseScale, y * noiseScale, timeOffset), 0, 1, 0, width);
      
      // Use Perlin noise for the vertical displacement, giving the 'organic' feel
      // We are sampling noise at (xCoord, yCoord, timeOffset)
      let noiseValue = noise(xCoord * 0.005, y * 0.005, timeOffset);
      
      // Map the noise value (0 to 1) to a position offset (e.g., +/- 50 pixels)
      let yOffset = map(noiseValue, 0, 1, -50, 50);
      
      // Calculate the final point
      let currentX = xCoord;
      let currentY = y + yOffset;
      
      // --- Color Gradient Calculation ---
      // Map the noise value (0 to 1) to a color gradient (e.g., blue to magenta)
      let r = map(noiseValue, 0, 1, 0, 255);
      let g = map(noiseValue, 0, 1, 150, 255);
      let b = map(noiseValue, 0, 1, 255, 0);
      
      stroke(r, g, b, 180); // Set stroke with calculated color and transparency
      point(currentX, currentY);
    }
    endShape();
  }
}

// Handle resizing the canvas when the window changes size
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0); // Clear background on resize
}