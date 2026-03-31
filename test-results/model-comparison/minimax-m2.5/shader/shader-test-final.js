let t = 0;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100);
  pixelDensity(1);
  noStroke();
}

function draw() {
  background(0);
  
  loadPixels();
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let nx = x * 0.006;
      let ny = y * 0.006;
      
      let v1 = sin(noise(nx + t * 0.3, ny) * TWO_PI);
      let v2 = sin(noise(nx - t * 0.2, ny + t * 0.4) * TWO_PI + 1);
      let v3 = sin(noise(nx * 1.2 + t * 0.1, ny * 1.2 - t * 0.15) * TWO_PI + 2);
      let v4 = sin(noise(nx * 0.8 - t * 0.25, ny * 0.8 + t * 0.2) * TWO_PI + 3);
      
      let plasma = (v1 + v2 + v3 + v4) * 0.25;
      plasma = (plasma + 1) * 0.5;
      
      let colorShift = t * 15;
      let hue = (plasma * 180 + colorShift) % 360;
      
      if (hue < 0) hue += 360;
      
      let brightness = pow(plasma, 0.7) * 100;
      let saturation = 80 + plasma * 20;
      
      let idx = (x + y * width) * 4;
      let r = brightness * cos((hue / 360) * TWO_PI) + brightness;
      let g = brightness * cos((hue / 360 - 0.33) * TWO_PI) + brightness;
      let b = brightness * cos((hue / 360 - 0.66) * TWO_PI) + brightness;
      
      pixels[idx] = constrain(r, 0, 255);
      pixels[idx + 1] = constrain(g, 0, 255);
      pixels[idx + 2] = constrain(b, 0, 255);
      pixels[idx + 3] = 255;
    }
  }
  
  updatePixels();
  
  t += 0.015;
  
  if (frameCount % 60 === 0) {
    console.log("Plasma cycling");
  }
}

function windowResized() {
  resizeCanvas(800, 600);
}