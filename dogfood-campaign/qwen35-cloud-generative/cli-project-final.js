let t = 0; // Time variable for animation

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);
  noFill();
  strokeWeight(2);
}

function draw() {
  // Semi-transparent background to create a fading trail effect
  // Change the alpha (last argument) to adjust trail length
  background(0, 0, 0, 10); 

  // Grid settings
  const step = 15; // Distance between lines
  
  // Loop through the canvas in a grid
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < height; y += step) {
      
      // Calculate Perlin noise based on position and time
      // We scale x and y to make the noise "zoomed out" enough to see variation
      let n = noise(x * 0.003, y * 0.003, t);
      
      // Map noise value (0-1) to an angle (0 to 4*PI for more swirls)
      let angle = map(n, 0, 1, 0, TWO_PI * 2);
      
      // Map noise value to color hue for gradients
      // We add t*50 to shift colors over time
      let hue = map(n, 0, 1, 0, 360) + (t * 50); 
      
      // Set stroke color
      stroke(hue, 80, 100, 80);
      
      // Calculate the end point of the line based on the angle
      let x2 = x + cos(angle) * step;
      let y2 = y + sin(angle) * step;
      
      // Draw the line segment
      line(x, y, x2, y2);
    }
  }
  
  // Increment time to animate the flow
  t += 0.005;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(0);
}