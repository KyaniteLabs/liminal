let particles = [];
const numParticles = 100;
let gravityOn = false;
const G = 0.5; // gravity strength
const MOUSE_ATTRACTION = 0.5; // mouse attraction strength
const MAX_TRAIL = 20;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(random(width), random(height)));
  }
}

function draw() {
  // fade effect
  noStroke();
  fill(0, 0, 0, 20); // a bit of transparency for fade
  rect(0, 0, width, height);

  // update and draw particles
  for (let p of particles) {
    p.applyForce(createVector(0, G)); // gravity if enabled
    // mouse attraction
    let mouse = createVector(mouseX, mouseY);
    let dir = p5.Vector.sub(mouse, p.pos);
    let d = dir.mag();
    if (d > 1) {
      dir.normalize();
      let forceMag = MOUSE_ATTRACTION * (p.mass) / (d * d); // adjust as needed
      dir.mult(forceMag);
      p.applyForce(dir);
    }
    p.update();
    p.checkCollisions();
    p.display();
  }

  // UI
  fill(0);
  textSize(16);
  text("Gravity: " + (gravityOn ? "ON" : "OFF"), 20, 30);
}

function mousePressed() {
  gravityOn = !gravityOn;
}