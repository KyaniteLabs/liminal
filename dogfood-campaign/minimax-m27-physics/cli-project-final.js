Here is a complete p5.js sketch that simulates multiple balls bouncing within a circular boundary with ball-to-ball collision physics.

```javascript
// p5.js Sketch: Balls Bouncing in a Circle
// Multiple balls with collision detection against each other and the boundary

let balls = [];
const numBalls = 15;
const boundaryRadius = 250;
const centerX, centerY; // Will be set in setup

// Ball class
class Ball {
  constructor() {
    this.radius = random(10, 20);
    // Pick a random position inside the circle (with padding)
    let angle = random(TWO_PI);
    let r = random(this.radius, boundaryRadius - this.radius - 10);
    this.pos = createVector(centerX + cos(angle) * r, centerY + sin(angle) * r);
    
    // Random velocity
    this.vel = p5.Vector.random2D().mult(random(2, 5));
    
    // Visual properties
    this.color = color(random(255), random(255), random(255));
  }

  update() {
    this.pos.add(this.vel);
  }

  // Check collision with the circular boundary
  checkBoundaries() {
    let dir = p5.Vector.sub(this.pos, createVector(centerX, centerY));
    let dist = dir.mag();
    let maxDist = boundaryRadius - this.radius;

    if (dist > maxDist) {
      // 1. Clamp position to boundary (prevent sticking out)
      dir.setMag(maxDist);
      this.pos = p5.Vector.add(createVector(centerX, centerY), dir);

      // 2. Reflect velocity (dot product with normal)
      // Normal is the direction from center to ball
      let normal = dir.copy().normalize();
      // v' = v - 2 * (v . n) * n
      this.vel.sub(p5.Vector.mult(normal, 2 * this.vel.dot(normal)));
    }
  }

  // Check collision with another ball
  collide(other) {
    let dir = p5.Vector.sub(other.pos, this.pos);
    let dist = dir.mag();
    let minDist = this.radius + other.radius;

    if (dist < minDist) {
      // 1. Calculate collision normal (unit vector between centers)
      let normal = dir.copy().normalize();

      // 2. Resolve Overlap (push apart based on inverse mass)
      // Assuming equal density, mass ~ radius^2
      let m1 = this.radius * this.radius;
      let m2 = other.radius * other.radius;
      let totalMass = m1 + m2;
      
      // Separation amount to distribute based on