let particles = [];

function setup() {
  createCanvas(800, 600);
}

function draw() {
  background('#02202A');
  
  if (frameCount % 60 === 0) explode();
  
  for (let i = 0; i < particleSystem.length; i++) {
    let p = particleSystem[i];
    fill(random(255), random(255), random(255));
    noStroke();
    ellipse(p.x, p.y, p.size);
    
    p.applyForce(createVector(mouseX - p.x, mouseY - p.y)/100.0); // Apply a force based on the cursor position
    p.update();
  }
}

function explode() {
  particles = [];
  
  for (let i = 0; i < 150; i++) { // Create some fireworks at random positions above where we clicked.
    let x = floor(random(width));
    let y = height;
    
    let angle = PI / 4 * random(TWO_PI); // Random angles
    let speed = random(50, 100);
    particles.push(new Particle(x, y, angle, speed));
  }
}

class Particle {
  constructor (x, y, theta, v) { this.x = x; this.y = y; this.theta = theta; this.v = v; this.size = random(10, 30); this.color = color(random(255), random(255), random(255)); }

  applyForce(forceX, forceY) {
    let acceleration = p5.Vector.div(forceX * this.mass, this.velocity.mag() + .1);
    
    this.acceleration.x += acceleration.x;
    this.acceleration.y += acceleration.y;
  }
  
  update(dt) { 
    if (!this.alive)
        return;  
    
    // Fading
    let fade = map(pulse(millis()), -255, 0, 0, 255);
    
    this.v.add(this.acceleration);
    this.v.mult(-dt * .005); // Gravity
    
    this.x += (mouseX > x ? 1 : mouseX < x ? -1 : 0) * dt * p5.Vector.fromAngle(pulse(millis()) + theta)
                     * sqrt(v / speed());
    
    this.y -= v * pulse(millis());
    
    if (this.v.mag() <= .01 || millis() > this.lifetime + frameCount*20 ) { 
        particles.splice(this.index, 1); // Remove when out of bounds
        return;
    }
    
    let alpha = map(pulse(millis()), -255, 0, 0, fade);
    strokeAlpha(alpha);

    push();
      translate(x,y)
        ellipse(0, 0, this.size * pulse(millis()));
    pop();

    // Update lifetime and decay
    this.lifetime += dt;
  }
  
}

let particleSystem = [];
const numParticles = 150;

for (let i = 0; i < numParticles; i++) {
  let p = new Particle(300, height - 100 + random(-50), TWO_PI * random(), random(35, 70));
  particles.push(p);
  
  // Add to particle system
  particleSystem.push(particles[i]);
}

function mousePressed() {
  explode();
}