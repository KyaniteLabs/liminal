// Array to store our particles
let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  // Use HSB color mode for easy rainbow effects
  // Hue: 0-360, Saturation: 0-100, Brightness: 0-100, Alpha: 0-100
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
}

function draw() {
  // Clear background with a slight transparency for a motion blur trail effect
  // Change alpha (last param) to 100 for no trails, or lower for longer trails
  background(0, 0, 0, 30);

  // Emit new particles at the mouse position
  // We add 5 particles per frame to make the stream dense
  for (let i = 0; i < 5; i++) {
    particles.push(new Spark(mouseX, mouseY));
  }

  // Iterate backwards through the array so we can remove items safely
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.update();
    p.show();

    // Remove particle if it's dead (faded out)
    if (p.isDead()) {
      particles.splice(i, 1);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// --- Particle Class ---
class Spark {
  constructor(x, y) {
    this.pos = createVector(x, y);
    
    // Random velocity: mostly upward with some spread
    let angle = random(-PI / 4, -3 * PI / 4); // Upward cone
    let speed = random(2, 6);
    this.vel = p5.Vector.fromAngle(angle).mult(speed);
    
    // Add a little horizontal randomness
    this.vel.x += random(-1, 1);

    this.acc = createVector(0, 0.15); // Gravity pulling down
    this.lifespan = 100; // Start at 100% opacity (in HSB alpha)
    
    // Random color hue
    this.hue = random(360);
    this.size = random(2, 5);
  }

  update() {
    this.vel.add(this.acc); // Apply gravity to velocity
    this.pos.add(this.vel); // Apply velocity to position
    this.lifespan -= 1.5;   // Fade out speed
  }

  show() {
    // Map lifespan to alpha for fade out
    let alpha = map(this.lifespan, 0, 100, 0, 100);
    fill(this.hue, 80, 100, alpha);
    ellipse(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.lifespan <= 0;
  }
}