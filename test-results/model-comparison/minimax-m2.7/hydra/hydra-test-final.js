let shapes = [];
let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  pixelDensity(1);
  for (let i = 0; i < 15; i++) {
    shapes.push({
      x: noise(i * 0.4) * width,
      y: noise(i * 0.4 + 50) * height,
      baseX: noise(i * 0.4) * width,
      baseY: noise(i * 0.4 + 50) * height,
      size: noise(i * 0.3) * 60 + 30,
      sides: floor(noise(i * 0.6) * 5) + 3,
      hue: noise(i * 0.5) * 360,
      phase: noise(i * 2) * 1000,
      rotSpeed: (noise(i * 0.7) - 0.5) * 0.04,
      rot: 0
    });
  }
}

function draw() {
  background(0, 0, 5, 25);
  t += 0.015;
  
  let mx = mouseX, my = mouseY;
  let mouseActive = mouseIsPressed;
  
  for (let s of shapes) {
    let nx = noise(s.baseX * 0.002, t + s.phase);
    let ny = noise(s.baseY * 0.002, t + s.phase + 100);
    
    let tx = map(nx, 0, 1, 0, width);
    let ty = map(ny, 0, 1, 0, height);
    
    let dx = tx - s.x;
    let dy = ty - s.y;
    s.x += dx * 0.03;
    s.y += dy * 0.03;
    
    if (mouseActive) {
      let pmx = width / 2 + (mx - width / 2) * 0.5;
      let pmy = height / 2 + (my - height / 2) * 0.5;
      let dm = dist(s.x, s.y, pmx, pmy);
      if (dm < 200) {
        let angle = atan2(s.y - pmy, s.x - pmx);
        let force = map(dm, 0, 200, 3, 0);
        s.x += cos(angle) * force;
        s.y += sin(angle) * force;
      }
    }
    
    s.rot += s.rotSpeed;
    
    let pulse = sin(t * 2 + s.phase) * 0.15 + 1;
    let currentSize = s.size * pulse;
    
    push();
    translate(s.x, s.y);
    rotate(s.rot);
    
    noFill();
    for (let j = 4; j >= 0; j--) {
      let alpha = map(j, 4, 0, 8, 60);
      let weight = map(j, 4, 0, 1, 3);
      let hueShift = (s.hue + j * 15 + t * 20) % 360;
      let sat = 70 + sin(t + j) * 20;
      
      stroke(hueShift, sat, 90, alpha);
      strokeWeight(weight);
      
      beginShape();
      for (let k = 0; k < s.sides; k++) {
        let angle = TWO_PI / s.sides * k - HALF_PI;
        let r = currentSize * (1 - j * 0.08);
        let wobble = sin(t * 3 + k * 2 + s.phase) * 5;
        vertex(cos(angle) * (r + wobble), sin(angle) * (r + wobble));
      }
      endShape(CLOSE);
    }
    
    let innerHue = (s.hue + 180) % 360;
    fill(innerHue, 50, 80, 15);
    noStroke();
    beginShape();
    for (let k = 0; k < s.sides; k++) {
      let angle = TWO_PI / s.sides * k - HALF_PI;
      let r = currentSize * 0.3;
      vertex(cos(angle) * r, sin(angle) * r);
    }
    endShape(CLOSE);
    
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {}