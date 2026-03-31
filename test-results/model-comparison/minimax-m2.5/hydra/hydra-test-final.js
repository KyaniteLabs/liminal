let t = 0;
let shapes = [];
let numShapes = 15;
let angleOffset = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  
  for (let i = 0; i < numShapes; i++) {
    let angle = map(i, 0, numShapes, 0, TWO_PI);
    shapes.push({
      angle: angle,
      radius: 150 + sin(i * 0.5) * 80,
      size: 20 + (i % 5) * 8,
      sides: 3 + (i % 4),
      hue: map(i, 0, numShapes, 0, 360),
      rotSpeed: 0.02 + random(0.01, 0.03),
      noiseOffset: random(1000)
    });
  }
}

function draw() {
  fill(0, 0, 0, 8);
  rect(0, 0, width, height);
  
  t += 0.01;
  angleOffset += 0.002;
  
  let centerX = width / 2;
  let centerY = height / 2;
  
  for (let i = 0; i < numShapes; i++) {
    let s = shapes[i];
    
    let noiseVal = noise(s.noiseOffset + t * 0.5);
    let spiralAngle = s.angle + t * 0.3 + angleOffset * (i + 1);
    let spiralRadius = s.radius + map(noiseVal, 0, 1, -60, 60);
    
    let x = centerX + cos(spiralAngle) * spiralRadius;
    let y = centerY + sin(spiralAngle) * spiralRadius;
    
    push();
    translate(x, y);
    rotate(s.angle * 2 + t * s.rotSpeed * 10);
    
    let hue = (s.hue + t * 20) % 360;
    fill(hue, 70, 90, 60);
    
    drawPolygon(0, 0, s.size, s.sides);
    
    fill(hue, 40, 100, 30);
    drawPolygon(0, 0, s.size * 0.6, s.sides);
    
    pop();
    
    let trailX = x;
    let trailY = y;
    for (let j = 0; j < 5; j++) {
      let trailAngle = spiralAngle - j * 0.15;
      let trailR = spiralRadius + j * 15;
      let tx = centerX + cos(trailAngle) * trailR;
      let ty = centerY + sin(trailAngle) * trailR;
      
      fill((hue + j * 10) % 360, 60, 80, 15 - j * 2);
      push();
      translate(tx, ty);
      rotate(s.angle * 2 + t * s.rotSpeed * 10 - j * 0.1);
      drawPolygon(0, 0, s.size * (1 - j * 0.15), s.sides);
      pop();
    }
  }
  
  for (let i = 0; i < 3; i++) {
    let ringAngle = t * 0.5 + i * TWO_PI / 3;
    let ringRadius = 100 + i * 60 + sin(t + i) * 20;
    let rx = centerX + cos(ringAngle) * ringRadius;
    let ry = centerY + sin(ringAngle) * ringRadius;
    
    noFill();
    stroke((t * 10 + i * 60) % 360, 50, 80, 20);
    strokeWeight(2);
    ellipse(rx, ry, 30 + i * 10, 30 + i * 10);
    noStroke();
  }
}

function drawPolygon(x, y, radius, npoints) {
  let angle = TWO_PI / npoints;
  beginShape();
  for (let a = 0; a < TWO_PI; a += angle) {
    let sx = x + cos(a) * radius;
    let sy = y + sin(a) * radius;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}

function windowResized() {
  resizeCanvas(800, 600);
}

function mousePressed() {
  for (let i = 0; i < numShapes; i++) {
    shapes[i].noiseOffset = random(1000);
  }
  t = 0;
}

function mouseMoved() {
  let d = dist(mouseX, mouseY, width / 2, height / 2);
  for (let i = 0; i < numShapes; i++) {
    shapes[i].radius = 150 + d * 0.5 + sin(i * 0.5) * 80;
  }
}