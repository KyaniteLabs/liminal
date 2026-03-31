let buildings = [];
let raindrops = [];
let flyingCars = [];
let neonColors;
let t = 0;

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  
  neonColors = [
    color(255, 0, 128),
    color(0, 255, 255),
    color(255, 0, 255),
    color(0, 255, 128),
    color(255, 128, 0),
    color(128, 0, 255)
  ];
  
  for (let i = 0; i < 15; i++) {
    buildings.push({
      x: map(i, 0, 15, 0, width),
      w: random(40, 80),
      h: random(150, 400),
      windows: [],
      neonColor: random(neonColors)
    });
    
    let b = buildings[buildings.length - 1];
    for (let j = 0; j < 20; j++) {
      b.windows.push({
        wx: random(5, b.w - 10),
        wy: random(10, b.h - 20),
        ww: random(6, 12),
        wh: random(8, 14),
        lit: random() > 0.3,
        flickerOffset: random(1000)
      });
    }
  }
  
  for (let i = 0; i < 200; i++) {
    raindrops.push({
      x: random(width),
      y: random(height),
      speed: random(8, 15),
      len: random(10, 25),
      opacity: random(100, 200)
    });
  }
  
  for (let i = 0; i < 5; i++) {
    flyingCars.push({
      x: random(width),
      y: random(50, 150),
      speed: random(1, 3),
      size: random(20, 40),
      trail: [],
      color: random(neonColors),
      noiseOffset: random(1000)
    });
  }
}

function draw() {
  background(5, 5, 20);
  
  drawSky();
  drawBuildings();
  drawRain();
  drawFlyingCars();
  drawGroundReflection();
  drawScanlines();
  
  t += 0.01;
}

function drawSky() {
  for (let y = 0; y < 200; y++) {
    let c = lerpColor(color(10, 5, 30), color(0, 0, 15), y / 200);
    stroke(c);
    line(0, y, width, y);
  }
  
  for (let i = 0; i < 50; i++) {
    let x = noise(i * 0.5, t * 0.2) * width;
    let y = noise(i * 0.3, t * 0.1) * 150;
    let size = noise(i * 0.2) * 2 + 0.5;
    let flicker = noise(i * 10, t * 5);
    
    if (flicker > 0.3) {
      fill(255, 255, 255, flicker * 255);
      noStroke();
      ellipse(x, y, size);
    }
  }
}

function drawBuildings() {
  for (let b of buildings) {
    let baseY = height - 50;
    let buildingTop = baseY - b.h;
    
    fill(15, 12, 30);
    noStroke();
    rect(b.x, buildingTop, b.w, b.h);
    
    stroke(b.neonColor);
    strokeWeight(2);
    noFill();
    rect(b.x, buildingTop, b.w, b.h);
    
    if (noise(t + b.x * 0.01) > 0.4) {
      strokeWeight(3);
      line(b.x, buildingTop, b.x + b.w, buildingTop + b.h);
      line(b.x + b.w, buildingTop, b.x, buildingTop + b.h);
    }
    
    noStroke();
    for (let w of b.windows) {
      let flicker = noise(t * 2 + w.flickerOffset);
      if (w.lit && flicker > 0.2) {
        let alpha = map(flicker, 0.2, 1, 100, 255);
        fill(255, 220, 100, alpha);
        rect(b.x + w.wx, buildingTop + w.wy, w.ww, w.wh);
      }
    }
    
    for (let i = 0; i < 3; i++) {
      let neonY = buildingTop + b.h * (i + 1) / 4;
      let neonNoise = noise(b.x * 0.05, t + i);
      if (neonNoise > 0.5) {
        strokeWeight(2);
        stroke(neonColors[(i + floor(t)) % neonColors.length]);
        let neonAlpha = map(noise(b.x * 0.1, t * 3), 0, 1, 100, 255);
        stroke(neonColors[(i + floor(t)) % neonColors.length].levels[0],
               neonColors[(i + floor(t)) % neonColors.length].levels[1],
               neonColors[(i + floor(t)) % neonColors.length].levels[2],
               neonAlpha);
        line(b.x, neonY, b.x + b.w, neonY);
      }
    }
  }
}

function drawRain() {
  strokeWeight(1);
  
  for (let drop of raindrops) {
    let windOffset = noise(drop.y * 0.01, t) * 2 - 1;
    drop.x += windOffset;
    drop.y += drop.speed;
    
    if (drop.y > height) {
      drop.y = -drop.len;
      drop.x = random(width);
    }
    
    let streak = noise(drop.x * 0.1, drop.y * 0.1, t);
    let alpha = drop.opacity * (0.5 + streak * 0.5);
    
    stroke(150, 180, 255, alpha);
    line(drop.x, drop.y, drop.x + windOffset * 2, drop.y + drop.len);
  }
}

function drawFlyingCars() {
  for (let car of flyingCars) {
    car.x += car.speed;
    if (car.x > width + 50) {
      car.x = -50;
      car.y = random(50, 150);
    }
    
    car.y += (noise(t * 2 + car.noiseOffset) - 0.5) * 2;
    car.y = constrain(car.y, 30, 180);
    
    car.trail.unshift({x: car.x, y: car.y});
    if (car.trail.length > 20) car.trail.pop();
    
    noStroke();
    for (let i = 0; i < car.trail.length - 1; i++) {
      let alpha = map(i, 0, car.trail.length, 150, 0);
      stroke(red(car.color), green(car.color), blue(car.color), alpha);
      strokeWeight(map(i, 0, car.trail.length, 3, 1));
      line(car.trail[i].x, car.trail[i].y, car.trail[i + 1].x, car.trail[i + 1].y);
    }
    
    push();
    translate(car.x, car.y);
    
    let bodyColor = color(30, 30, 40);
    fill(bodyColor);
    stroke(50, 50, 60);
    strokeWeight(1);
    beginShape();
    vertex(-car.size / 2, 0);
    vertex(-car.size / 3, -car.size / 4);
    vertex(car.size / 3, -car.size / 4);
    vertex(car.size / 2, 0);
    vertex(car.size / 3, car.size / 6);
    vertex(-car.size / 3, car.size / 6);
    endShape(CLOSE);
    
    noStroke();
    fill(car.color);
    ellipse(-car.size / 4, -car.size / 8, 4, 3);
    ellipse(car.size / 4, -car.size / 8, 4, 3);
    
    let glowColor = color(red(car.color), green(car.color), blue(car.color), 100);
    for (let i = 3; i > 0; i--) {
      fill(glowColor);
      ellipse(car.size / 3, 0, i * 4, i * 3);
      ellipse(-car.size / 3, 0, i * 4, i * 3);
    }
    
    pop();
  }
}

function drawGroundReflection() {
  let groundY = height - 50;
  
  for (let y = groundY; y < height; y++) {
    let inter = map(y, groundY, height, 0, 1);
    let alpha = inter * 80;
    stroke(0, 100, 150, alpha);
    line(0, y, width, y);
  }
  
  for (let i = 0; i < 8; i++) {
    let x = noise(i * 0.3, t) * width;
    let lightHue = floor(noise(i * 0.5, t * 0.5) * 255);
    stroke(lightHue, 100, 255, 50);
    strokeWeight(1);
    line(x, groundY, x, height);
    
    let spread = noise(t + i) * 50 + 20;
    for (let j = 0; j < 5; j++) {
      let alpha = map(j, 0, 5, 30, 0);
      stroke(lightHue, 100, 255, alpha);
      line(x - spread + j * spread / 5, groundY, x - spread + j * spread / 5, height);
    }
  }
}

function drawScanlines() {
  for (let y = 0; y < height; y += 4) {
    stroke(0, 0, 0, 20);
    line(0, y, width, y);
  }
  
  if (noise(t * 10) > 0.97) {
    let glitchY = random(height);
    let glitchH = random(5, 20);
    copy(0, glitchY, width, glitchH, 10, glitchY, width, glitchH);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  
  buildings = [];
  for (let i = 0; i < 15; i++) {
    buildings.push({
      x: map(i, 0, 15, 0, width),
      w: random(40, 80),
      h: random(150, 400),
      windows: [],
      neonColor: random(neonColors)
    });
    
    let b = buildings[buildings.length - 1];
    for (let j = 0; j < 20; j++) {
      b.windows.push({
        wx: random(5, b.w - 10),
        wy: random(10, b.h - 20),
        ww: random(6, 12),
        wh: random(8, 14),
        lit: random() > 0.3,
        flickerOffset: random(1000)
      });
    }
  }
}