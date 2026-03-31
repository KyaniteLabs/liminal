let waves = [];
let foamParticles = [];
let seagulls = [];
let waveCount = 5;
let t = 0;
let sunY = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  
  for (let i = 0; i < waveCount; i++) {
    waves.push({
      y: map(i, 0, waveCount - 1, 300, height + 50),
      amplitude: map(i, 0, waveCount - 1, 60, 15),
      frequency: map(i, 0, waveCount - 1, 0.008, 0.015),
      speed: map(i, 0, waveCount - 1, 0.3, 0.8),
      phase: random(TWO_PI),
      color: lerpColor(color(20, 60, 100), color(60, 140, 180), i / waveCount),
      foamColor: lerpColor(color(200, 220, 240), color(255, 255, 255), random(0.3, 0.7))
    });
  }
  
  for (let i = 0; i < 8; i++) {
    seagulls.push({
      x: random(-100, width + 100),
      y: random(50, 180),
      speed: random(0.5, 1.5),
      wingPhase: random(TWO_PI),
      wingSpeed: random(0.15, 0.25),
      size: random(8, 14)
    });
  }
}

function draw() {
  drawSky();
  drawSun();
  drawClouds();
  drawWaves();
  drawFoam();
  drawSeagulls();
  t += 0.01;
}

function drawSky() {
  for (let y = 0; y < 300; y++) {
    let inter = map(y, 0, 300, 0, 1);
    let c;
    if (t % 10 < 5) {
      c = lerpColor(color(135, 180, 220), color(200, 220, 240), inter);
    } else {
      c = lerpColor(color(40, 60, 90), color(100, 140, 180), inter);
    }
    stroke(c);
    line(0, y, width, y);
  }
  
  for (let y = 300; y < height; y++) {
    let inter = map(y, 300, height, 0, 1);
    let c = lerpColor(color(60, 120, 160), color(20, 50, 80), inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function drawSun() {
  let sunX = width * 0.75;
  let sunY = 120;
  
  for (let r = 80; r > 0; r -= 2) {
    let alpha = map(r, 0, 80, 255, 0);
    let warmth = map(r, 0, 80, 1, 0.3);
    fill(255, 200 * warmth, 100 * warmth, alpha * 0.3);
    noStroke();
    ellipse(sunX, sunY, r * 2, r * 2);
  }
  
  fill(255, 240, 180);
  noStroke();
  ellipse(sunX, sunY, 60, 60);
}

function drawClouds() {
  noStroke();
  let cloudSeed = floor(t * 0.1) % 100;
  noiseSeed(cloudSeed);
  
  for (let i = 0; i < 5; i++) {
    let cx = noise(i * 10) * width;
    let cy = 80 + noise(i * 10 + 100) * 100;
    let cloudSize = 60 + noise(i * 10 + 200) * 80;
    
    fill(255, 255, 255, 60);
    for (let j = 0; j < 8; j++) {
      let ox = noise(i * 10 + j, t * 0.05) * 40 - 20;
      let oy = noise(i * 10 + j + 50, t * 0.05) * 20 - 10;
      let size = cloudSize * (0.5 + noise(i + j) * 0.5);
      ellipse(cx + ox, cy + oy, size, size * 0.6);
    }
  }
}

function drawWaves() {
  noStroke();
  
  for (let w = waves.length - 1; w >= 0; w--) {
    let wave = waves[w];
    let darkerColor = color(
      red(wave.color) * 0.7,
      green(wave.color) * 0.7,
      blue(wave.color) * 0.7
    );
    
    fill(darkerColor);
    beginShape();
    vertex(0, height);
    
    for (let x = 0; x <= width; x += 5) {
      let y = wave.y;
      y += sin(x * wave.frequency + t * wave.speed + wave.phase) * wave.amplitude;
      y += sin(x * wave.frequency * 2.3 + t * wave.speed * 1.5 + wave.phase * 0.5) * wave.amplitude * 0.3;
      
      if (w < waves.length - 1) {
        let nextWave = waves[w + 1];
        let nextY = nextWave.y + sin(x * nextWave.frequency + t * nextWave.speed + nextWave.phase) * nextWave.amplitude;
        if (y < nextY) y = nextY + random(2, 5);
      }
      
      vertex(x, y);
    }
    
    vertex(width, height);
    endShape(CLOSE);
    
    fill(wave.color);
    beginShape();
    vertex(0, height);
    
    for (let x = 0; x <= width; x += 5) {
      let y = wave.y;
      y += sin(x * wave.frequency + t * wave.speed + wave.phase) * wave.amplitude;
      y += sin(x * wave.frequency * 2.3 + t * wave.speed * 1.5 + wave.phase * 0.5) * wave.amplitude * 0.3;
      vertex(x, y);
    }
    
    vertex(width, height);
    endShape(CLOSE);
  }
}

function drawFoam() {
  noiseSeed(42);
  
  for (let x = 0; x < width; x += 8) {
    for (let w = 0; w < waves.length; w++) {
      let wave = waves[w];
      let waveY = wave.y + sin(x * wave.frequency + t * wave.speed + wave.phase) * wave.amplitude;
      waveY += sin(x * wave.frequency * 2.3 + t * wave.speed * 1.5 + wave.phase * 0.5) * wave.amplitude * 0.3;
      
      let foamNoise = noise(x * 0.02 + w * 10, t * 0.5);
      
      if (foamNoise > 0.6 && waveY < height - 20) {
        let foamAlpha = map(foamNoise, 0.6, 1, 0, 200);
        let foamSize = map(foamNoise, 0.6, 1, 2, 6);
        
        fill(255, 255, 245, foamAlpha);
        noStroke();
        
        let offsetX = noise(x * 0.1, t + w) * 10 - 5;
        let offsetY = noise(x * 0.1 + 100, t + w) * 5 - 2;
        
        ellipse(x + offsetX, waveY + offsetY, foamSize, foamSize * 0.6);
      }
    }
  }
  
  if (random() < 0.3) {
    let spawnX = random(width);
    let waveIdx = floor(random(waves.length - 1));
    let wave = waves[waveIdx];
    let waveY = wave.y + sin(spawnX * wave.frequency + t * wave.speed + wave.phase) * wave.amplitude;
    
    foamParticles.push({
      x: spawnX,
      y: waveY,
      vx: random(-1, 1),
      vy: random(-3, -1),
      size: random(3, 8),
      life: 1,
      decay: random(0.02, 0.05)
    });
  }
  
  for (let i = foamParticles.length - 1; i >= 0; i--) {
    let p = foamParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    
    if (p.life <= 0 || p.y > height) {
      foamParticles.splice(i, 1);
    } else {
      fill(255, 255, 255, p.life * 150);
      noStroke();
      ellipse(p.x, p.y, p.size * p.life, p.size * p.life * 0.7);
    }
  }
}

function drawSeagulls() {
  stroke(60, 50, 45);
  strokeWeight(2);
  
  for (let g of seagulls) {
    let wingY = sin(t * g.wingSpeed * 60 + g.wingPhase) * 8;
    
    let bodyLen = g.size;
    line(g.x - bodyLen, g.y, g.x, g.y - wingY * 0.5);
    line(g.x + bodyLen, g.y, g.x, g.y - wingY * 0.5);
    
    fill(60, 50, 45);
    noStroke();
    ellipse(g.x, g.y, bodyLen * 0.8, bodyLen * 0.4);
    
    let headX = g.x - bodyLen * 0.6;
    ellipse(headX, g.y - 2, bodyLen * 0.35, bodyLen * 0.3);
    
    let beakX = headX - bodyLen * 0.2;
    fill(255, 180, 50);
    triangle(beakX, g.y - 2, beakX - 5, g.y, beakX, g.y + 1);
    
    g.x += g.speed;
    
    if (g.x > width + 150) {
      g.x = -150;
      g.y = random(50, 180);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}