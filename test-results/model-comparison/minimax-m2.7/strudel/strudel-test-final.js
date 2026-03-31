let beatTime = 0;
let beatInterval = 60 / 130;
let isKick = true;
let beatCount = 0;
let particles = [];
let bassEnergy = 0;
let highEnergy = 0;
let decay = 0.95;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100);
  noiseSeed(42);
}

function draw() {
  background(0, 0, 5, 30);
  
  beatTime += deltaTime / 1000;
  
  if (beatTime >= beatInterval) {
    beatTime -= beatInterval;
    isKick = !isKick;
    beatCount++;
    
    if (isKick) {
      bassEnergy = 1;
      spawnRing();
    } else {
      highEnergy = 0.7;
      spawnSparks();
    }
  }
  
  bassEnergy *= decay;
  highEnergy *= decay;
  
  let beatPhase = beatTime / beatInterval;
  let pulse = sin(beatPhase * PI) * 0.5 + 0.5;
  
  drawFlowField(pulse);
  drawRings(pulse);
  updateParticles();
  drawGrid(pulse);
  drawCentralGlow(pulse);
  
  bassEnergy *= 0.96;
  highEnergy *= 0.94;
}

function drawFlowField(pulse) {
  let cols = 40;
  let rows = 30;
  let w = width / cols;
  let h = height / rows;
  
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * w + w / 2;
      let y = j * h + h / 2;
      let n = noise(i * 0.08, j * 0.08, frameCount * 0.01);
      let angle = n * TWO_PI * 2 + bassEnergy * 2;
      
      let len = (8 + bassEnergy * 12) * pulse;
      let hue = (n * 120 + 180 + frameCount * 0.5) % 360;
      
      stroke(hue, 80, 60 + highEnergy * 40);
      strokeWeight(1 + pulse * 0.5);
      push();
      translate(x, y);
      rotate(angle);
      line(-len / 2, 0, len / 2, 0);
      pop();
    }
  }
}

function drawRings(pulse) {
  noFill();
  let numRings = 3;
  
  for (let r = 0; r < numRings; r++) {
    let radius = 50 + r * 60 + bassEnergy * 100;
    let hue = (200 + r * 40 + frameCount) % 360;
    let alpha = (0.8 - r * 0.2) * pulse;
    
    strokeWeight(3 - r * 0.5);
    stroke(hue, 100, 80, alpha);
    ellipse(width / 2, height / 2, radius * 2, radius * 2);
    
    for (let i = 0; i < 8; i++) {
      let angle = (i / 8) * TWO_PI + frameCount * 0.02;
      let x = width / 2 + cos(angle) * radius;
      let y = height / 2 + sin(angle) * radius;
      let size = 4 + pulse * 6;
      
      fill(hue, 100, 100);
      noStroke();
      ellipse(x, y, size, size);
    }
  }
}

function drawCentralGlow(pulse) {
  let maxRadius = 150 + bassEnergy * 200;
  
  for (let i = 10; i > 0; i--) {
    let r = (maxRadius / 10) * i;
    let alpha = (1 - i / 10) * 0.3 * pulse;
    let hue = (frameCount * 2 + i * 10) % 360;
    
    fill(hue, 100, 80, alpha);
    noStroke();
    ellipse(width / 2, height / 2, r * 2, r * 2);
  }
  
  fill(0, 0, 100);
  noStroke();
  let coreSize = 20 + bassEnergy * 30 + pulse * 10;
  ellipse(width / 2, height / 2, coreSize, coreSize);
}

function spawnRing() {
  for (let i = 0; i < 36; i++) {
    let angle = (i / 36) * TWO_PI;
    particles.push({
      x: width / 2,
      y: height / 2,
      vx: cos(angle) * (3 + random(2)),
      vy: sin(angle) * (3 + random(2)),
      life: 1,
      size: 8 + random(8),
      hue: (180 + random(60)) % 360
    });
  }
}

function spawnSparks() {
  for (let i = 0; i < 20; i++) {
    let angle = random(TWO_PI);
    let speed = random(2, 5);
    particles.push({
      x: width / 2 + random(-50, 50),
      y: height / 2 + random(-50, 50),
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      life: 1,
      size: 3 + random(4),
      hue: (300 + random(60)) % 360
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;
    p.vx *= 0.98;
    p.vy *= 0.98;
    
    if (p.life > 0) {
      fill(p.hue, 100, 100, p.life * 100);
      noStroke();
      ellipse(p.x, p.y, p.size * p.life, p.size * p.life);
    }
    
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawGrid(pulse) {
  stroke(200, 50, 30, 20);
  strokeWeight(1);
  
  let spacing = 40;
  let offset = (frameCount * 0.5) % spacing;
  
  for (let x = -spacing + offset; x < width + spacing; x += spacing) {
    let wobble = sin(x * 0.02 + frameCount * 0.05) * bassEnergy * 20;
    line(x + wobble, 0, x - wobble, height);
  }
  
  for (let y = -spacing + offset; y < height + spacing; y += spacing) {
    let wobble = cos(y * 0.02 + frameCount * 0.05) * bassEnergy * 20;
    line(0, y + wobble, width, y - wobble);
  }
  
  let beatAlpha = bassEnergy * 50;
  stroke(0, 100, 100, beatAlpha);
  strokeWeight(2);
  rect(0, 0, width, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}