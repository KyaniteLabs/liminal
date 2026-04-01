let w, h;
let timeOffset = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  colorMode(HSB, 360, 100, 100);
}

function draw() {
  background(240, 50, 50); // Dark background
  
  timeOffset += 0.005;
  
  let cols = width / 2;
  let rows = height / 2;
  
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      // Calculate position relative to center with some jitter
      let cx = map(x, 0, cols, -width/4, width/4);
      let cy = map(y, 0, rows, -height/4, height/4);
      
      // Create collision-like interference pattern based on distance from center
      let dx = mouseX - width/2;
      let dy = mouseY - height/2;
      let dist = sqrt(dx*dx + dy*dy) * 0.01;
      
      let val = noise(cx * 0.01 + timeOffset, cy * 0.01 + timeOffset, dist);
      
      // Map value to color and size based on "collision" intensity (dist from mouse)
      let hue = map(val, 0, 1, 0, 360);
      let sat = 80;
      let light = map(val, 0, 1, 20, 90);
      
      // Size increases near "collision" point (mouse) but also oscillates
      let size = map(sin(val * PI * 3), -1, 1, 2, 8);
      if (dist < 0.05) {
        size *= 3; // Big explosion at collision center
      }
      
      fill(hue, sat, light);
      rect(cx, cy, size, size);
    }
  }
}