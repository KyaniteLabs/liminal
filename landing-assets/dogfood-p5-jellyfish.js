let jellyfish = [];
let particles = [];
let bubbles = [];
let numJellyfish = 5;
let numParticles = 200;
let numBubbles = 40;
let t = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);
  
  for (let i = 0; i < numJellyfish; i++) {
    let baseHue = random(180, 280);
    jellyfish.push({
      x: random(width * 0.15, width * 0.85),
      y: random(80, 350),
      size: random(40, 80),
      phase: random(TWO_PI),
      speed: random(0.008, 0.015),
      hue: baseHue,
      saturation: random(70, 95),
      brightness: random(85, 100),
      pulsePhase: random(TWO_PI),
      tentacles: [],
      numTentacles: floor(random(6, 12)),
      opacity: random(60, 90)
    });
    
    let jf = jellyfish[i];
    for (let j = 0; j < jf.numTentacles; j++) {
      jf.tentacles.push({
        baseAngle: map(j, 0, jf.numTentacles, -PI * 0.4, PI * 0.4),
        length: random(60, 140) * (jf.size / 60),
        segments: floor(random(12, 20)),
        phaseOffset: random(TWO_PI),
        thickness: random(2, 5)
      });
    }
  }
  
  for (let i = 0; i < numParticles; i++) {
    particles.push(createParticle());
  }
  
  for (let i = 0; i < numBubbles; i++) {
    bubbles.push(createBubble());
  }
}

function createParticle() {
  return {
    x: random(width),
    y: random(height),
    vx: random(-0.3, 0.3),
    vy: random(-0.5, -0.1),
    size: random(1, 4),
    hue: random(180, 300),
    alpha: random(30, 80),
    life: random(100, 255),
    maxLife: 255
  };
}

function createBubble() {
  return {
    x: random(width),
    y: random(height, height + 200),
    size: random(2, 8),
    speed: random(0.3, 1.2),
    wobble: random(TWO_PI),
    wobbleSpeed: random(0.02, 0.06)
  };
}

function draw() {
  drawBackground();
  
  for (let b of bubbles) {
    updateBubble(b);
    drawBubble(b);
  }
  
  for (let p of particles) {
    updateParticle(p);
    drawParticle(p);
  }
  
  for (let jf of jellyfish) {
    updateJellyfish(jf);
    drawJellyfish(jf);
  }
  
  t += 0.01;
}

function drawBackground() {
  background(240, 60, 8);
  
  for (let y = 0; y < height; y += 2) {
    let inter = map(y, 0, height, 0, 1);
    let hue = lerp(220, 260, inter * 0.5);
    let bright = lerp(5, 12, inter);
    stroke(hue, 80, bright, 15);
    strokeWeight(2);
    line(0, y, width, y);
  }
  
  for (let i = 0; i < 100; i++) {
    let x = noise(i * 0.1, t * 0.3) * width;
    let y = noise(i * 0.1 + 100, t * 0.2) * height;
    let size = noise(i * 0.2) * 2;
    noStroke();
    fill(200, 30, 50, 20);
    ellipse(x, y, size);
  }
}

function updateJellyfish(jf) {
  jf.phase += jf.speed;
  jf.y += sin(jf.phase * 2) * 0.3;
  jf.x += cos(jf.phase * 0.5) * 0.2;
  jf.x = constrain(jf.x, jf.size, width - jf.size);
  jf.y = constrain(jf.y, 50, 400);
  
  jf.pulsePhase += 0.03;
}

function drawJellyfish(jf) {
  let pulseAmount = sin(jf.pulsePhase) * 0.15 + 1;
  let bellHeight = jf.size * pulseAmount;
  let bellWidth = jf.size * (2 - pulseAmount * 0.5);
  
  drawTentacles(jf, bellWidth, bellHeight);
  
  drawBell(jf, bellWidth, bellHeight);
  
  drawInnerGlow(jf, bellWidth, bellHeight);
  
  drawOrgans(jf, bellWidth, bellHeight);
}

function drawBell(jf, w, h) {
  push();
  translate(jf.x, jf.y);
  
  noStroke();
  
  for (let i = 3; i > 0; i--) {
    let glowSize = i * 8;
    let alpha = jf.opacity / (i * 2);
    fill(jf.hue, jf.saturation * 0.7, 100, alpha * 0.5);
    ellipse(0, 0, w + glowSize, h + glowSize * 0.6);
  }
  
  fill(jf.hue, jf.saturation * 0.8, 90, jf.opacity);
  stroke(jf.hue, jf.saturation, 100, jf.opacity * 1.5);
  strokeWeight(1.5);
  
  beginShape();
  vertex(-w * 0.5, 0);
  bezierVertex(-w * 0.5, -h * 0.8, -w * 0.2, -h, w * 0.1, -h * 0.7);
  vertex(w * 0.1, -h * 0.7);
  bezierVertex(w * 0.3, -h * 0.5, w * 0.5, -h * 0.2, w * 0.5, 0);
  endShape();
  
  fill(jf.hue, jf.saturation * 0.5, 100, jf.opacity * 0.8);
  noStroke();
  arc(0, -h * 0.3, w * 0.6, h * 0.5, PI, TWO_PI);
  
  pop();
}

function drawInnerGlow(jf, w, h) {
  push();
  translate(jf.x, jf.y);
  
  noStroke();
  for (let i = 5; i > 0; i--) {
    let glowAlpha = (sin(jf.pulsePhase * 2 + i * 0.5) * 0.5 + 0.5) * jf.opacity * 0.4;
    fill(jf.hue + 20, jf.saturation * 0.5, 100, glowAlpha);
    let glowW = w * 0.3 * (i / 5);
    let glowH = h * 0.3 * (i / 5);
    ellipse(0, -h * 0.3, glowW, glowH);
  }
  
  pop();
}

function drawOrgans(jf, w, h) {
  push();
  translate(jf.x, jf.y);
  
  noStroke();
  for (let i = 0; i < 4; i++) {
    let ox = map(i, 0, 3, -w * 0.2, w * 0.2);
    let oy = -h * 0.4 + sin(jf.pulsePhase + i) * 3;
    let organSize = 4 + sin(jf.pulsePhase * 2 + i * 0.8) * 2;
    
    fill(jf.hue + 40, 60, 100, jf.opacity * 0.9);
    ellipse(ox, oy, organSize);
    
    fill(jf.hue + 60, 40, 100, jf.opacity);
    ellipse(ox, oy, organSize * 0.5);
  }
  
  pop();
}

function drawTentacles(jf, bellW, bellH) {
  push();
  translate(jf.x, jf.y);
  
  for (let tent of jf.tentacles) {
    drawTentacle(jf, tent, bellW, bellH);
  }
  
  pop();
}

function drawTentacle(jf, tent, bellW, bellH) {
  let startX = tent.baseAngle * bellW * 0.4;
  let startY = 5;
  
  stroke(jf.hue, jf.saturation * 0.6, 90, jf.opacity * 0.7);
  strokeWeight(tent.thickness);
  noFill();
  
  beginShape();
  let prevX = startX;
  let prevY = startY;
  
  for (let i = 0; i <= tent.segments; i++) {
    let progress = i / tent.segments;
    let segX = startX + progress * tent.length * cos(tent.baseAngle + HALF_PI);
    let segY = startY + progress * tent.length;
    
    let noiseVal = noise(
      tent.phaseOffset + i * 0.15 + t * 1.5,
      jf.phase + tent.baseAngle
    );
    let wave = (noiseVal - 0.5) * 40 * progress;
    
    let currentX = segX + wave;
    let currentY = segY;
    
    let thicknessFade = 1 - progress * 0.6;
    strokeWeight(tent.thickness * thicknessFade);
    
    if (i === 0) {
      vertex(currentX, currentY);
    } else {
      let cpX = (prevX + currentX) / 2 + wave * 0.5;
      let cpY = (prevY + currentY) / 2;
      quadraticVertex(cpX, cpY, currentX, currentY);
    }
    
    prevX = currentX;
    prevY = currentY;
  }
  
  endShape();
  
  noStroke();
  let endX = startX + tent.length * cos(tent.baseAngle + HALF_PI);
  let endY = startY + tent.length;
  let endNoise = noise(tent.phaseOffset + tent.segments * 0.15 + t * 1.5, jf.phase);
  endX += (endNoise - 0.5) * 40;
  
  for (let g = 3; g > 0; g--) {
    fill(jf.hue, jf.saturation * 0.5, 100, jf.opacity * 0.2 / g);
    ellipse(endX, endY, tent.thickness + g * 6);
  }
  
  fill(jf.hue + 30, 40, 100, jf.opacity * 0.8);
  ellipse(endX, endY, tent.thickness * 0.8);
}

function updateParticle(p) {
  p.x += p.vx + sin(t + p.y * 0.01) * 0.2;
  p.y += p.vy;
  p.life -= 0.5;
  p.alpha = (p.life / p.maxLife) * 80;
  
  if (p.life <= 0 || p.y < -10) {
    Object.assign(p, createParticle());
    p.y = height + 10;
    p.life = p.maxLife;
  }
}

function drawParticle(p) {
  noStroke();
  
  for (let i = 2; i > 0; i--) {
    fill(p.hue, p.saturation * 0.5, 100, p.alpha * 0.2 / i);
    ellipse(p.x, p.y, p.size + i * 4);
  }
  
  fill(p.hue, p.saturation * 0.3, 100, p.alpha);
  ellipse(p.x, p.y, p.size);
  
  fill(p.hue + 40, 20, 100, p.alpha);
  ellipse(p.x, p.y, p.size * 0.4);
}

function updateBubble(b) {
  b.y -= b.speed;
  b.wobble += b.wobbleSpeed;
  b.x += sin(b.wobble) * 0.5;
  
  if (b.y < -20) {
    b.y = height + random(50, 200);
    b.x = random(width);
  }
}

function drawBubble(b) {
  push();
  translate(b.x, b.y);
  
  noFill();
  stroke(200, 30, 80, 30);
  strokeWeight(0.5);
  ellipse(0, 0, b.size * 2);
  
  noStroke();
  fill(200, 20, 100, 15);
  ellipse(0, 0, b.size * 2);
  
  fill(200, 10, 100, 40);
  ellipse(-b.size * 0.3, -b.size * 0.3, b.size * 0.3);
  
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}