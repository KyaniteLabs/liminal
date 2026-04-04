```javascript
let balls = [];
let containerRadius;
const numBalls = 15;

function setup() {
  createCanvas(600, 600);
  colorMode(HSB, 360, 100, 100);
  
  // Define the boundary circle size
  containerRadius = width / 2 - 20;
  
  // Initialize balls
  for (let i = 0; i < numBalls; i++) {
    let r = random(15, 25);
    // Spawn balls randomly within the container
    let angle = random(TWO_PI);
    let dist = random(0, containerRadius - r);
    let x = width / 2 + cos(angle) * dist;
    let y = height / 2 + sin(angle) * dist;
    
    balls.push(new Ball(x, y, r));
  }
}

function draw() {
  background(230, 15, 95); // Dark background
  
  // Draw Container Boundary
  noFill();
  stroke(0, 0, 100);
  strokeWeight(4);
  ellipse(width / 2, height / 2, containerRadius * 2);
  
  // Update and draw balls
  for (let ball of balls) {
    ball.update();
    ball.checkBoundaryCollision();
    ball.display();
  }
  
  // Check collisions between all pairs of balls
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      balls[i].checkBallCollision(balls[j]);
    }
  }
}

class Ball {
  constructor(x, y, r) {
    this.pos = createVector(x, y);
    // Random velocity
    this.vel = p5.Vector.random2D().mult(random(2, 5));
    this.r = r;
    this.color = color(random(360), 80, 90);
    this.mass = r; // Mass proportional to size
  }

  update() {
    this.pos.add(this.vel);
  }

  display() {
    noStroke();
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
    
    // Add a shine effect
    fill(255, 100);
    ellipse(this.pos.x - this.r * 0.3, this.pos.y - this.r * 0.3, this.r * 0.4);
  }

  checkBoundaryCollision() {
    // Vector from center of canvas to ball
    let distFromCenter = p5.Vector.dist(this.pos, createVector(width / 2, height / 2));
    
    // Check if ball touches or passes the boundary
    if (distFromCenter + this.r > containerRadius) {
      // Calculate normal vector at collision point (pointing inward)
      let normal = p5.Vector.sub(createVector(width / 2, height / 2), this.pos).normalize();
      
      // Reflect velocity vector: V_new = V - 2(V . N)N
      let dot = this.vel.dot(normal);
      let reflection = p5.Vector.mult(normal, 2 * dot);
      this.vel.sub(reflection);
      
      // Correction: Push ball back inside to prevent sticking
      let overlap = (distFromCenter + this.r) - containerRadius;
      let correction = p5.Vector.mult(normal, overlap);
      this.pos.add(correction);
    }
  }

  checkBallCollision(other) {
    let distVect = p5.Vector.sub(other.pos, this.pos);
    let distMag = distVect.mag();
    let minDist = this.r + other.r;

    if (distMag < minDist) {
      // 1. Resolve Overlap (prevent sticking)
      let overlap = minDist - distMag;
      let correction = distVect.copy().normalize().mult(overlap * 0.5);
      this.pos.sub(correction);
      other.pos.add(correction);

      // 2.