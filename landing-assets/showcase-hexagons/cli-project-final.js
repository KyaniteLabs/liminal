1. Has animated/rotating hexagonal shapes
2. Uses noise() for organic variation
3. Is visually compelling
4. Has proper setup() and draw() functions
5. Responds to window resizing
6. Uses pixelDensity(1) for performance

I'll create a design with:
- A hexagonal grid pattern
- Rotating hexagon layers within each cell
- Noise-based color variation
- Smooth animation
- Maybe some interactivity (mouse position affects rotation or colors)

Let me write the code:
</think>

let hexagons = [];
let t = 0;
let noiseScale = 0.003;
let baseHue = 220;
let hexSize = 50;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1);
  noiseSeed(floor(random(10000)));
  
  initHexagons();
}

function initHexagons() {
  hexagons = [];
  let spacing = hexSize * 2;
  let rows = ceil(height / (spacing * 0.866)) + 4;
  let cols = ceil(width / spacing) + 4;
  
  for (let i = -2; i < rows; i++) {
    for (let j = -2; j < cols; j++) {
      let offsetX = (i % 2) * spacing / 2;
      let x = j * spacing + offsetX;
      let y = i * spacing * 0.866;
      
      let noiseVal = noise(x * noiseScale, y * noiseScale);
      let rotSpeed = map(noiseVal, 0, 1, -0.01, 0.01);
      let hueShift = map(noise(x * noiseScale * 2, y * noiseScale * 2), 0, 1, -30, 30);
      let layerCount = floor(map(noiseVal, 0, 1, 3, 6));
      let scaleVar = map(noise(x * noiseScale * 3, y * noiseScale * 3), 0, 1, 0.6, 1.2);
      
      hexagons.push({
        x: x,
        y: y,
        baseSize: hexSize * scaleVar,
        rotation: random(TWO_PI),
        rotSpeed: rotSpeed,
        hueShift: hueShift,
        layerCount: layerCount,
        noiseOffset: noiseVal * 1000
      });
    }
  }
}

function drawHexagon(x, y, radius, rotation, hue) {
  push();
  translate(x, y);
  rotate(rotation);
  
  stroke(hue, 60, 90, 60);
  strokeWeight(1.5);
  noFill();
  
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i - HALF_PI;
    let px = cos(angle) * radius;
    let py = sin(angle) * radius;
    vertex(px, py);
  }
  endShape(CLOSE);
  
  pop();
}

function drawHexagonInner(x, y, radius, rotation, hue, index) {
  push();
  translate(x, y);
  rotate(rotation + index * 0.2);
  
  let innerRadius = radius * 0.6;
  let innerHue = (hue + index * 15) % 360;
  
  fill(innerHue, 70, 60, 15);
  stroke(innerHue, 80, 80, 40);
  strokeWeight(1);
  
  beginShape();
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i - HALF_PI + index * 0.1;
    let wobble = noise(x * 0.01 + i * 10, y * 0.01 + t * 0.5 + index) * 5;
    let px = cos(angle) * (innerRadius + wobble);
    let py = sin(angle) * (innerRadius + wobble);
    vertex(px, py);
  }
  endShape(CLOSE);
  
  pop();
}

function drawTriangles(x, y, radius, rotation, hue) {
  push();
  translate(x, y);
  rotate(rotation);
  
  let triRadius = radius * 0.35;
  
  for (let i = 0; i < 6; i++) {
    let angle = TWO_PI / 6 * i - HALF_PI;
    let tx = cos(angle) * radius * 0.5;
    let ty = sin(angle) * radius * 0.5;
    
    let triHue = (hue + i * 20 + t * 5) % 360;
    let alpha = map(sin(t * 2 + i), -1, 1, 20, 50);
    
    fill(triHue, 60, 80, alpha);
    stroke(triHue, 70, 100, 30);
    strokeWeight(0.8);
    
    push();
    translate(tx, ty);
    rotate(angle + t * 0.5);
    
    beginShape();
    for (let j = 0; j < 3; j++) {
      let a = TWO_PI / 3 * j - HALF_PI;
      vertex(cos(a) * triRadius, sin(a) * triRadius);
    }
    endShape(CLOSE);
    
    pop();
  }
  
  pop();
}

function drawCenterDot(x, y, radius, hue) {
  push();
  translate(x, y);
  
  let pulse = sin(t * 3) * 0.2 + 1;
  let dotSize = radius * 0.15 * pulse;
  let dotHue = (hue + 180) % 360;
  
  fill(dotHue, 50, 100, 80);
  noStroke();
  
  ellipse(0, 0, dotSize, dotSize);
  
  stroke(dotHue, 60, 100, 40);
  strokeWeight(1);
  noFill();
  ellipse(0, 0, dotSize * 2, dotSize * 2);
  
  pop();
}

function draw() {
  background(230, 20, 10);
  
  t += 0.02;
  
  let mouseInfluence = dist(mouseX, mouseY, width/2, height/2) / 300;
  let interactiveRot = map(mouseX, 0, width, -0.02, 0.02);
  
  for (let hex of hexagons) {
    let timeOffset = hex.noiseOffset * 0.001;
    let currentRot = hex.rotation + t * hex.rotSpeed * 50 + sin(timeOffset + t) * 0.5;
    let hue = (baseHue + hex.hueShift + t * 10 + noise(hex.x * 0.005, hex.y * 0.005) * 40) % 360;
    
    let layerAlpha = map(sin(t + hex.noiseOffset), -1, 1, 0.3, 1);
    
    push();
    translate(hex.x, hex.y);
    scale(layerAlpha);
    
    drawHexagon(0, 0, hex.baseSize, currentRot, hue);
    drawHexagonInner(0, 0, hex.baseSize, currentRot, hue, 0);
    
    if (hex.layerCount >= 3) {
      drawHexagonInner(0, 0, hex.baseSize * 0.8, -currentRot * 1.5, hue + 30, 1);
    }
    
    if (hex.layerCount >= 4) {
      drawHexagonInner(0, 0, hex.baseSize * 0.5, currentRot * 2, hue + 60, 2);
    }
    
    if (hex.layerCount >= 5) {
      drawTriangles(0, 0, hex.baseSize, currentRot * 0.5, hue);
    }
    
    drawCenterDot(0, 0, hex.baseSize, hue);
    
    pop();
  }
  
  drawConnectionLines();
  drawOverlayGradient();
}

function drawConnectionLines() {
  stroke(200, 30, 100, 15);
  strokeWeight(0.5);
  
  for (let i = 0; i < hexagons.length; i++) {
    let h1 = hexagons[i];
    for (let j = i + 1; j < hexagons.length; j++) {
      let h2 = hexagons[j];
      let d = dist(h1.x, h1.y, h2.x, h2.y);
      
      if (d < hexSize * 1.8 && d > hexSize * 0.1)