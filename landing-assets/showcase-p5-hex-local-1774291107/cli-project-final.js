<think>
The user wants a p5.js sketch with rotating hexagons and color gradients using HSB mode. I need to create an improved version that:

1. Uses HSB color mode
2. Has rotating hexagons
3. Uses noise() for organic variation
4. Is self-contained and immediately runnable
5. No markdown fences or explanatory text

Let me create a compelling geometric art piece with hexagons that rotate and have smooth color gradients.

I'll create nested hexagons with varying rotation speeds, sizes, and HSB color gradients that shift over time using noise() for organic variation.
</think>

let hexLayers = [];
let numLayers = 8;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1);
  noiseSeed(random(10000));
  
  for (let i = 0; i < numLayers; i++) {
    hexLayers.push({
      baseSize: map(i, 0, numLayers - 1, 50, 320),
      rotation: random(TWO_PI),
      rotSpeed: map(noise(i * 0.5), 0, 1, -0.02, 0.02),
      hueOffset: i * 45,
      numHexagons: floor(map(i, 0, numLayers - 1, 5, 1)),
      spacing: map(i, 0, numLayers - 1, 8, 25),
      layerOffset: noise(i * 2) * 100
    });
  }
}

function draw() {
  background(0, 0, 8);
  
  translate(width / 2, height / 2);
  
  for (let layer of hexLayers) {
    layer.rotation += layer.rotSpeed;
    
    push();
    rotate(layer.rotation);
    
    for (let h = 0; h < layer.numHexagons; h++) {
      let size = layer.baseSize - h * layer.spacing;
      let hue = (frameCount * 0.5 + layer.hueOffset + h * 20 + noise(h, frameCount * 0.01) * 60) % 360;
      let sat = 70 + noise(h * 0.3, frameCount * 0.02) * 30;
      let bri = 60 + sin(frameCount * 0.05 + h * 0.5) * 30;
      let alpha = map(h, 0, layer.numHexagons - 1, 100, 30);
      
      stroke(hue, sat, 90);
      strokeWeight(map(h, 0, layer.numHexagons - 1, 2, 0.5));
      noFill();
      
      drawHexagon(0, 0, size);
      
      noStroke();
      fill(hue, sat * 0.5, bri * 0.3, alpha * 0.3);
      drawHexagon(0, 0, size - 5);
    }
    pop();
  }
  
  drawCenterGlow();
}

function drawHexagon(x, y, radius) {
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i - HALF_PI;
    let px = x + cos(angle) * radius;
    let py = y + sin(angle) * radius;
    vertex(px, py);
  }
  endShape(CLOSE);
}

function drawCenterGlow() {
  noStroke();
  for (let r = 80; r > 0; r -= 5) {
    let hue = (frameCount * 0.8) % 360;
    fill(hue, 60, 100, map(r, 0, 80, 20, 0));
    ellipse(0, 0, r, r);
  }
  
  stroke((frameCount * 0.5) % 360, 80, 100);
  strokeWeight(3);
  noFill();
  ellipse(0, 0, 30 + sin(frameCount * 0.1) * 5);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}