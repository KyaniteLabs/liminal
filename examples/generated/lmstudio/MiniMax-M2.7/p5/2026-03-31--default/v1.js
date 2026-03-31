let fireworks = [];

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
}

function draw() {
  background(10, 10, 30, 40);

  let wind = map(noise(frameCount * 0.008), 0, 1, -0.3, 0.3);

  if (frameCount % 8 === 0) {
    let hue = random(360);
    fireworks.push(new Firework(random(width), height, hue));
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    fireworks[i].applyWind(wind);
    fireworks[i].update();
    fireworks[i].display();

    if (fireworks[i].isDead()) {
      fireworks.splice(i, 1);
    }
  }
}

class Firework {
  constructor(x, y, hue) {
    this.particles = [];
    this.launch(x, y, hue);
  }

  launch(x, y, hue) {
    let vx = random(-0.5, 0.5);
    let vy = random(-14, -10);
    this.particles.push(new Particle(x, y, vx, vy, hue, true));
  }

  applyWind(wind) {
    for (let p of this.particles) {
      p.vx += wind * 0.05;
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.update();

      if (p.isLaunch && p.vy >= 0) {
        this.explode(p.x, p.y, p.hue);
        this.particles.splice(i, 1);
      }

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  explode(x, y, hue) {
    let count = floor(random(80, 120));
    for (let i = 0; i < count; i++) {
      let angle = random(TWO_PI);
      let speed = random(1, 6);
      let vx = cos(angle) * speed;
      let vy = sin(angle) * speed;
      let particleHue = hue + random(-30, 30);
      this.particles.push(new Particle(x, y, vx, vy, particleHue, false));
    }
  }

  display() {
    for (let p of this.particles) {
      p.display();
    }
  }

  isDead() {
    return this.particles.length === 0;
  }
}

class Particle {
  constructor(x, y, vx, vy, hue, isLaunch) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.hue = hue;
    this.isLaunch = isLaunch;
    this.alpha = 255;
    this.decay = isLaunch ? 0 : random(0.015, 0.03);
    this.size = isLaunch ? 4 : random(2, 4);
  }

  update() {
    this.vy += 0.06;
    this.x += this.vx;
    this.y += this.vy;
    if (!this.isLaunch) {
      this.alpha -= this.decay * 255;
      this.size *= 0.98;
    }
  }

  display() {
    noStroke();
    colorMode(HSB, 360, 100, 100, 255);
    fill(this.hue, 80, 100, max(0, this.alpha));
    ellipse(this.x, this.y, this.size);
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}