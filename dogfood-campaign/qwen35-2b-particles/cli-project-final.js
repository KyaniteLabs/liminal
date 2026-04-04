```javascript
function setup() {
  createCanvas(windowWidth, windowHeight);
  noLoop(); // Explicitly disable loop to prevent issues with draw() structure, though draw loop is usually better
  particles = [];
  gravity = 0.03;
  friction = 0.95;
  fadeRate = 0.92;
}

function draw() {
  background(0);

  // Spawn particles on mouse click
  if (mouseX > 0 && mouseY > 0) {
    createParticle(mouseX, mouseY);
  }

  // Update and draw each particle in the array
  for (let i = particles.length - 1; i >= 0; i--) {
    updateParticle(i);
    drawParticle(i);

    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function createParticle(x, y) {
  // Create new particle
  let particle = {
    x: x,
    y: y,
    vx: (frameCount % 2 === 0) ? 1 : -1,
    vy: 2,
    color: color(255, random(0, 255), 255), // Random color
    radius: random(3, 6)
  };
  particles.push(particle);
}

function updateParticle(index) {
  particles[index].x += particles[index].vx;
  particles[index].y += particles[index].vy;
  particles[index].vy += gravity; // Apply gravity
  particles[index].vx *= friction; // Apply air resistance
  particles[index].radius *= friction; // Shrink radius over time
  particles[index].alpha *= fadeRate; // Fade out
}

function drawParticle(index) {
  let p = particles[index];
  if (p.alpha <= 0) return; // Don't draw if dead

  push();
  translate(p.x, p.y);
  // Add glow effect
  background(