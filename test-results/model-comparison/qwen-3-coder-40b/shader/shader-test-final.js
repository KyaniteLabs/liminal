let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
}

function draw() {
  background(0);
  loadPixels();
  
  const w = width;
  const h = height;
  const d = pixelDensity();
  const w_d = w * d;
  const h_d = h * d;
  
  t += 0.04;
  
  for (let y = 0; y < h_d; y++) {
    for (let x = 0; x < w_d; x++) {
      const i = (x + y * w_d) * 4;
      
      // Create swirling motion
      const dx = x - w_d / 2;
      const dy = y - h_d / 2;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const angle = Math.atan2(dy, dx) + t * 0.5;
      
      // Generate plasma effect with multiple sine waves
      let value = 0;
      value += Math.sin((x/w_d)*8 + t) * 0.33;
      value += Math.sin((y/h_d)*8 + t) * 0.33;
      value += Math.sin((dist/50) - t*2) * 0.34;
      value += Math.sin(angle*4 + t) * 0.33;
      
      // Color cycling using sine waves with phase offsets
      const r = Math.floor(128 + 127 * Math.sin(value + t));
      const g = Math.floor(128 + 127 * Math.sin(value + t + 2.094)); // +120 degrees
      const b = Math.floor(128 + 127 * Math.sin(value + t + 4.189)); // +240 degrees
      
      pixels[i] = r;
      pixels[i+1] = g;
      pixels[i+2] = b;
      pixels[i+3] = 255;
    }
  }
  
  updatePixels();
}