let shapes = [];
const numShapes = 40;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 1);
  for (let i = 0; i < numShapes; i++) {
    shapes.push({
      x: random(width),
      y: random(height),
      nx: random(1000),
      ny: random(1000),
      size: random(20, 70),
      rot: random(TWO_PI),
      rotSpeed: random(-0.02, 0.02),
      hue: random(360),
      type: floor(random(4)),
      speed: random(0.005, 0.015),
      phase: random(TWO_PI)
    });
  }
}

function draw() {
  fill(0, 0, 8, 0.12);
  rect(0, 0, width, height);
  
  let mx = mouseX / width;
  let my = mouseY / height;
  
  for (let s of shapes) {
    let nx = noise(s.nx) * 2 - 1;
    let ny = noise(s.ny) * 2 - 1;
    let mouseInfluence = dist(mouseX, mouseY, s.x, s.y) < 200 ? 0.5 : 0;
    
    s.x += nx * s.speed * 80 + (mx * width - s.x) * mouseInfluence * 0.002;
    s.y += ny * s.speed * 80 + (my * height - s.y) * mouseInfluence * 0.002;
    s.nx += 0.006;
    s.ny += 0.006;
    s.rot += s.rotSpeed;
    s.phase += 0.02;
    
    s.x = (s.x + width) % width;
    s.y = (s.y + height) % height;
    
    push();
    translate(s.x, s.y);
    rotate(s.rot + sin(s.phase) * 0.3);
    
    let pulse = 1 + sin(s.phase) * 0.15;
    let currentSize = s.size * pulse;
    
    noStroke();
    fill(s.hue, 70, 90, 0.7);
    
    if (s.type === 0) {
      ellipse(0, 0, currentSize);
    } else if (s.type === 1) {
      triangle(0, -currentSize/2, -currentSize/2, currentSize/2, currentSize/2, currentSize/2);
    } else if (s.type === 2) {
      rectMode(CENTER);
      rect(0, 0, currentSize, currentSize);
    } else {
      beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = TWO_PI * i / 6;
        let r = i % 2 === 0 ? currentSize/2 : currentSize/4;
        vertex(cos(angle) * r, sin(angle) * r);
      }
      endShape(CLOSE);
    }
    
    fill(s.hue, 40, 100, 0.4);
    if (s.type === 0) {
      ellipse(0, 0, currentSize * 0.3);
    } else if (s.type === 1) {
      triangle(0, -currentSize/4, -currentSize/4, currentSize/4, currentSize/4, currentSize/4);
    } else if (s.type === 2) {
      rect(0, 0, currentSize * 0.4, currentSize * 0.4);
    } else {
      ellipse(0, 0, currentSize * 0.2);
    }
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}