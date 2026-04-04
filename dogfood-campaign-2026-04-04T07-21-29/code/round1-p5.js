function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 1);
  background(0);
}

function draw() {
  colorMode(RGB);
  background(0, 0, 5, 0.15);
  
  if (random(1) < 0.04) {
    fireworks.push(new Firework());
  }
  
  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].update();
    fireworks[i].display();
    
    if (fireworks[i].done()) {
      fireworks.splice(i, 1);
    }
  }
}

let fireworks = [];
let gravity;

function initGlobals() {
  gravity = createVector(0, 0.08);
  fireworks = [];
}

class Firework {
  constructor(x, y, hu) {
    this.particles = [];
    this.rocket = new Particle(x || random(width), y || height, hu || random(360), true);
    this.exploded = false;
  }
  
  update() {
    if (!this.exploded) {
      this.rocket.applyForce(gravity);
      this.rocket.update();
      
      if (this.rocket.vel.y >= -0.5 || this.rocket.pos.y < random(100, 300)) {
        this.explode();
      }
    }
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(gravity);
      this.particles[i].update();
      this.particles[i].show();
      
      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  explode() {
    this.exploded = true;
    let hu = this.rocket.hu;
    let burstType = floor(random(4));
    
    if (burstType === 0) {
      for (let i = 0; i < 150; i++) {
        let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, hu + random(-20, 20), false);
        p.vel.mult(random(0.5, 2.5));
        p.lifespan = random(150, 255);
        this.particles.push(p);
      }
    } else if (burstType === 1) {
      for (let i = 0; i < 80; i++) {
        let angle = (TWO_PI / 80) * i;
        let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, hu, false);
        p.vel = p5.Vector.fromAngle(angle).mult(random(3, 7));
        p.lifespan = random(200, 255);
        this.particles.push(p);
      }
      for (let i = 0; i < 40; i++) {
        let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, (hu + 180) % 360, false);
        p.vel.mult(random(1, 2));
        p.lifespan = random(100, 200);
        this.particles.push(p);
      }
    } else if (burstType === 2) {
      for (let ring = 1; ring <= 3; ring++) {
        let count = 30 * ring;
        for (let i = 0; i < count; i++) {
          let angle = (TWO_PI / count) * i;
          let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, hu + ring * 30, false);
          p.vel = p5.Vector.fromAngle(angle).mult(2 + ring);
          p.lifespan = random(180, 255);
          this.particles.push(p);
        }
      }
    } else {
      let spokes = 8;
      for (let i = 0; i < spokes; i++) {
        let angle = (TWO_PI / spokes) * i;
        for (let j = 0; j < 20; j++) {
          let p = new Particle(this.rocket.pos.x, this.rocket.pos.y, hu + j * 5, false);
          let speed = map(j, 0, 20, 1, 5);
          p.vel = p5.Vector.fromAngle(angle + random(-0.1, 0.1)).mult(speed);
          p.lifespan = random(150, 220);
          this.particles.push(p);
        }
      }
    }
  }
  
  display() {
    if (!this.exploded) {
      this.rocket.show();
    }
  }
  
  done() {
    return this.exploded && this.particles.length === 0;
  }
}

class Particle {
  constructor(x, y, hu, isRocket) {
    this.pos = createVector(x, y);
    this.vel = isRocket ? createVector(random(-0.5, 0.5), random(-10, -7)) : p5.Vector.random2D().mult(random(2, 6));
    this.acc = createVector(0, 0);
    this.hu = hu;
    this.lifespan = isRocket ? 255 : random(150, 255);
    this.trail = [];
    this.trailLength = isRocket ? 5 : 8;
  }
  
  applyForce(force) {
    this.acc.add(force);
  }
  
  update() {
    this.trail.push(this.pos.copy());
    if (this.trail.length > this.trailLength) {
      this.trail.shift();
    }
    
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
    
    if (!isRocket) {
      this.vel.mult(0.98);
    }
    
    this.lifespan -= 2;
  }
  
  show() {
    colorMode(HSB, 360, 100, 100, 255);
    
    for (let i = 0; i < this.trail.length - 1; i++) {
      let alpha = map(i, 0, this.trail.length, 0, this.lifespan * 0.6);
      let brightness = map(i, 0, this.trail.length, 50, 100);
      let weight = map(i, 0, this.trail.length, 0.5, 2);
      stroke(this.hu, 80, brightness, alpha);
      strokeWeight(weight);
      line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
    }
    
    noStroke();
    fill(this.hu, 70, 100, this.lifespan);
    ellipse(this.pos.x, this.pos.y, 3, 3);
  }
  
  done() {
    return this.lifespan <= 0;
  }
}

function mousePressed() {
  fireworks.push(new Firework(mouseX, mouseY));
}

function keyPressed() {
  if (key === ' ') {
    for (let i = 0; i < 3; i++) {
      fireworks.push(new Firework(random(width), random(height * 0.5, height)));
    }
  }
}

initGlobals();