<think>
The user wants a p5.js bioluminescent jellyfish sketch with flowing tentacles using noise. Let me analyze the previous iteration's issues:

1. Missing setup() function
2. Missing draw() function
3. Lacks animation or interactivity

I need to create a complete, self-contained p5.js sketch that:
- Has setup() and draw() functions
- Includes animation (time-based)
- Uses Perlin noise for organic tentacle movement
- Creates bioluminescent jellyfish visuals
- Is responsive with windowResized()

Let me create a complete sketch with:
- Multiple jellyfish with bell bodies and flowing tentacles
- Noise-based animation for tentacles
- Glow effects for bioluminescence
- Color gradients in blues, purples, cyans

I should NOT use markdown fences, just output raw JavaScript code.
</think>

let jellyfish = [];
let time = 0;
const NUM_JELLYFISH = 6;
const TENTACLES_PER_JELLYFISH = 10;

class Tentacle {
  constructor(x, y, length, hue, noiseOffset) {
    this.baseX = x;
    this.baseY = y;
    this.length = length;
    this.hue = hue;
    this.noiseOffset = noiseOffset;
    this.segments = 25;
  }
  
  update(time) {
    this.points = [];
    let x = this.baseX;
    let y = this.baseY;
    
    for (let i = 0; i < this.segments; i++) {
      let t = i / this.segments;
      let noiseVal = noise(this.noiseOffset + t * 3, time * 0.5);
      let angle = map(noiseVal, 0, 1, -PI/3, PI/3);
      let segLen = this.length / this.segments * (1 + t * 0.5);
      x += cos(angle + PI/2) * segLen;
      y += sin(angle + PI/2) * segLen + segLen * 0.3;
      this.points.push({x, y, t});
    }
  }
  
  draw() {
    noFill();
    for (let w = 4; w > 0; w -= 0.5) {
      let alpha = map(w, 4, 0, 50, 200);
      stroke(this.hue, 200, 255, alpha);
      strokeWeight(w);
      beginShape();
      curveVertex(this.baseX, this.baseY);
      for (let p of this.points) {
        curveVertex(p.x, p.y);
      }
      endShape();
    }
  }
}

class Jellyfish {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.bellWidth = random(60, 120);
    this.bellHeight = random(50, 90);
    this.hue = random(180, 280);
    this.phase = random(TWO_PI);
    this.tentacles = [];
    this.numTentacles = TENTACLES_PER_JELLYFISH;
    
    for (let i = 0; i < this.numTentacles; i++) {
      let tx = this.x + map(i, 0, this.numTentacles - 1, -this.bellWidth/2, this.bellWidth/2);
      let ty = this.y + this.bellHeight/2;
      let length = random(80, 200);
      let offset = random(1000);
      this.tentacles.push(new Tentacle(tx, ty, length, this.hue, offset));
    }
  }
  
  update(time) {
    let pulse = sin(time * 2 + this.phase) * 0.15 + 1;
    this.displayWidth = this.bellWidth * pulse;
    this.displayHeight = this.bellHeight * (2 - pulse);
    
    for (let t of this.tentacles) {
      let tx = this.x + map(this.tentacles.indexOf(t), 0, this.numTentacles - 1, -this.displayWidth/2, this.displayWidth/2);
      t.baseX = tx;
      t.baseY = this.y + this.displayHeight/2;
      t.update(time);
    }
  }
  
  draw() {
    for (let glow = 3; glow > 0; glow--) {
      let alpha = map(glow, 3, 0, 30, 150);
      fill(this.hue, 180, 255, alpha);
      noStroke();
      
      beginShape();
      vertex(this.x, this.y - this.displayHeight/2);
      bezierVertex(
        this.x - this.displayWidth/2, this.y - this.displayHeight/4,
        this.x - this.displayWidth/2, this.y + this.displayHeight/2,
        this.x, this.y + this.displayHeight/2
      );
      bezierVertex(
        this.x + this.displayWidth/2, this.y + this.displayHeight/2,
        this.x + this.displayWidth/2, this.y - this.displayHeight/4,
        this.x, this.y - this.displayHeight/2
      );
      endShape(CLOSE);
    }
    
    fill(this.hue, 100, 255, 200);
    ellipse(this.x, this.y - this.displayHeight/4, 20, 15);
    
    for (let t of this.tentacles) {
      t.draw();
    }
  }
}

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 255, 255, 255);
  pixelDensity(1);
  noiseSeed(random(10000));
  
  for (let i = 0; i < NUM_JELLYFISH; i++) {
    jellyfish.push(new Jellyfish(random(100, 700), random(100, 500)));
  }
}

function draw() {
  background(240, 50, 20);
  
  time += 0.02;
  
  for (let j of jellyfish) {
    j.update(time);
    j.draw();
  }
  
  for (let i = 0; i < 50; i++) {
    let px = noise(i * 0.1, time * 0.3) * width;
    let py = noise(i * 0.1 + 100, time * 0.2) * height;
    let ps = noise(i * 0.05, time) * 3 + 1;
    fill(200, 100, 255, 100);
    noStroke();
    ellipse(px, py, ps, ps);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  jellyfish.push(new Jellyfish(mouseX, mouseY));
  if (jellyfish.length > 15) {
    jellyfish.shift();
  }
}