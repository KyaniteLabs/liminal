let circles = [];
let numCircles = 12;
let baseHue = 0;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1);
  noiseSeed(random(1000));
  
  for (let i = 0; i < numCircles; i++) {
    circles.push({
      x: noise(i * 0.5) * width,
      y: noise(i * 0.5 + 100) * height,
      baseRadius: 50 + noise(i * 0.3) * 150,
      phase: noise(i * 0.7) * TWO_PI,
      speed: 0.02 + noise(i * 0.4) * 0.03,
      hueOffset: noise(i * 0.6) * 60
    });
  }
}

function draw() {
  background(0, 0, 10);
  
  baseHue = (baseHue + 0.2) % 360;
  
  for (let i = 0; i < numCircles; i++) {
    let c = circles[i];
    let pulse = sin(frameCount * c.speed + c.phase);
    let radius = c.baseRadius + pulse * 30;
    let currentHue = (baseHue + c.hueOffset) % 360;
    
    for (let r = radius; r > 0; r -= 3) {
      let inter = map(r, 0, radius, 0, 1);
      let layerHue = (currentHue + inter * 30) % 360;
      let saturation = map(inter, 0, 1, 80, 40);
      let brightness = map(inter, 0, 1, 100, 60);
      let alpha = map(inter, 0, 1, 100, 20);
      
      noStroke();
      fill(layerHue, saturation, brightness, alpha);
      ellipse(c.x + noise(frameCount * 0.01 + i) * 5, 
              c.y + noise(frameCount * 0.01 + i + 50) * 5, 
              r * 2, r * 2);
    }
    
    let glowRadius = radius + 20 + pulse * 10;
    for (let g = glowRadius; g > radius; g -= 4) {
      let glowAlpha = map(g, radius, glowRadius, 30, 0);
      fill(currentHue, 60, 100, glowAlpha);
      ellipse(c.x, c.y, g * 2, g * 2);
    }
  }
  
  for (let i = 0; i < 5; i++) {
    let x = noise(frameCount * 0.005 + i * 20) * width;
    let y = noise(frameCount * 0.005 + i * 20 + 200) * height;
    let r = 100 + noise(i) * 200;
    let hue = (baseHue + i * 70) % 360;
    
    for (let j = r; j > 0; j -= 5) {
      let inter = map(j, 0, r, 0, 1);
      fill(hue, 50, 80, inter * 15);
      ellipse(x, y, j * 2, j * 2);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  for (let i = 0; i < numCircles; i++) {
    circles[i].x = noise(i * 0.5) * width;
    circles[i].y = noise(i * 0.5 + 100) * height;
  }
}