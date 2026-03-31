let shapes = [];
let trailCanvas;
let trailAlpha = 12;
let time = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);
  
  trailCanvas = createGraphics(800, 600);
  trailCanvas.pixelDensity(1);
  trailCanvas.colorMode(HSB, 360, 100, 100, 100);
  trailCanvas.background(0, 0, 4);
  
  for (let i = 0; i < 20; i++) {
    shapes.push(createShape(i));
  }
  
  windowResized();
}

function createShape(index) {
  let types = ['triangle', 'square', 'circle', 'hexagon', 'diamond'];
  return {
    x: random(width),
    y: random(height),
    vx: 0,
    vy: 0,
    baseX: random(width),
    baseY: random(height),
    size: random(20, 60),
    rotation: random(TWO_PI),
    rotSpeed: random(-0.03, 0.03),
    type: types[floor(random(types.length))],
    noiseOffsetX: random(1000),
    noiseOffsetY: random(1000),
    noiseOffsetR: random(1000),
    hueOffset: random(360),
    speed: random(0.8, 2),
    orbitRadius: random(50, 150)
  };
}

function draw() {
  time += 0.008;
  
  trailCanvas.noStroke();
  trailCanvas.fill(0, 0, 4, trailAlpha);
  trailCanvas.rect(0, 0, width, height);
  
  for (let shape of shapes) {
    let noiseX = noise(shape.noiseOffsetX + time * 0.5) * 2 - 1;
    let noiseY = noise(shape.noiseOffsetY + time * 0.5) * 2 - 1;
    let noiseR = noise(shape.noiseOffsetR + time * 0.3) * 2 - 1;
    
    shape.baseX += noiseX * shape.speed;
    shape.baseY += noiseY * shape.speed;
    
    shape.baseX = constrain(shape.baseX, 0, width);
    shape.baseY = constrain(shape.baseY, 0, height);
    
    shape.x = shape.baseX + cos(time * 2 + shape.noiseOffsetX) * shape.orbitRadius * noiseR;
    shape.y = shape.baseY + sin(time * 2 + shape.noiseOffsetY) * shape.orbitRadius * noiseR;
    
    shape.rotation += shape.rotSpeed * (0.5 + abs(noiseR) * 1.5);
    
    let hue = (shape.hueOffset + time * 30 + frameCount * 0.1) % 360;
    let sat = 70 + noise(shape.noiseOffsetX) * 30;
    let bri = 80 + noise(shape.noiseOffsetY) * 20;
    
    trailCanvas.push();
    trailCanvas.translate(shape.x, shape.y);
    trailCanvas.rotate(shape.rotation);
    trailCanvas.fill(hue, sat, bri, 85);
    trailCanvas.noStroke();
    
    drawShape(trailCanvas, shape.type, shape.size);
    trailCanvas.pop();
  }
  
  image(trailCanvas, 0, 0);
  
  fill(0, 0, 100, 30);
  noStroke();
  textSize(11);
  textAlign(RIGHT, BOTTOM);
  text('geometric feedback', width - 12, height - 10);
}

function drawShape(p, type, size) {
  switch(type) {
    case 'triangle':
      p.triangle(0, -size/2, -size/2, size/2, size/2, size/2);
      break;
    case 'square':
      p.rect(-size/2, -size/2, size, size);
      break;
    case 'circle':
      p.ellipse(0, 0, size, size);
      break;
    case 'hexagon':
      drawPolygon(p, 6, size/2);
      break;
    case 'diamond':
      p.quad(0, -size/2, size/2.5, 0, 0, size/2, -size/2.5, 0);
      break;
  }
}

function drawPolygon(p, sides, radius) {
  p.beginShape();
  for (let i = 0; i < sides; i++) {
    let angle = TWO_PI / sides * i - HALF_PI;
    p.vertex(cos(angle) * radius, sin(angle) * radius);
  }
  p.endShape(CLOSE);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  trailCanvas.resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  for (let shape of shapes) {
    shape.baseX = mouseX + random(-50, 50);
    shape.baseY = mouseY + random(-50, 50);
  }
}