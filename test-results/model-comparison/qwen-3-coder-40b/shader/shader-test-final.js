let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(0);
  
  // Create plasma effect with noise and color cycling
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      // Calculate multiple noise values for complex plasma patterns
      let n1 = noise(x * 0.01 + t, y * 0.01);
      let n2 = noise(x * 0.01 - t, y * 0.01 + t);
      let n3 = noise((x + y) * 0.01 + t * 0.5);
      
      // Combine noises for rich plasma pattern
      let combined = (n1 + n2 + n3) / 3;
      
      // Create smooth color cycling using HSB
      let hue = (combined * 360 + t * 50) % 360;
      let brightness = map(combined, 0, 1, 100, 255);
      
      // Add some contrast manipulation
      if (brightness > 200) {
        brightness = 255;
      } else if (brightness < 50) {
        brightness = 0;
      }
      
      colorMode(HSB);
      fill(hue, 80, brightness);
      rect(x, y, 3, 3);
    }
  }
  
  t += 0.01;
}