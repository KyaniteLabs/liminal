let balls = [];
let boundaryRadius;
let boundaryCenter;

function setup() {
  createCanvas(600, 600);
  boundaryCenter = createVector(width / 2, height / 2);
  boundaryRadius = 250;

  // Create 10 random balls
  for (let i = 0; i < 10; i++) {
    balls.push(new Ball(
      random(boundaryRadius * 0.1, boundaryRadius * 0.9), // Random distance from center
      random(TWO_PI), // Random angle
      random(15, 30) // Random radius
    ));
  }
}

function draw() {
  background(20);

  // Draw circular boundary
  noFill();
  stroke(100);
  strokeWeight(2);
  circle(boundaryCenter.x, boundaryCenter.y, boundaryRadius * 2);

  // Update and display all balls
  for (let i = 0; i < balls.length; i++) {
    balls[i].update();
    balls[i].display();

    // Check collisions with other balls
    for (let j = i + 1; j < balls.length; j++) {
      balls[i].checkBallCollision(balls[j]);
    }
  }
}

class Ball {
  constructor(distance, angle, radius) {
    this.radius = radius;
    this.pos = p5.Vector.fromAngle(angle).mult(distance).add(boundaryCenter);
    this.vel = p5.Vector.random2D().mult(random(2, 4));
    this.color = color(random(150, 255), random(150, 255), random(150, 255));
  }

  update() {
    // Move ball
    this.pos.add(this.vel);

    // Boundary collision (circle)
    let distFromCenter = p5.Vector.dist(this.pos, boundaryCenter);
    if (distFromCenter + this.radius > boundaryRadius) {
      let normal = p5.Vector.sub(this.pos, boundaryCenter).normalize();
      this.vel = this.vel.sub(normal.mult(2 * this.vel.dot(normal)));
      
      // Reposition to prevent sticking
      this.pos = p5.Vector.add(boundaryCenter, normal.mult(boundaryRadius - this.radius));
    }
  }

  display() {
    fill(this.color);
    noStroke();
    circle(this.pos.x, this.pos.y, this.radius * 2);
  }

  checkBallCollision(other) {
    let distance = p5.Vector.dist(this.pos, other.pos);
    let minDistance = this.radius + other.radius;

    if (distance < minDistance) {
      // Calculate collision normal
      let normal = p5.Vector.sub(other.pos, this.pos).normalize();
      
      // Calculate relative velocity
      let relVel = p5.Vector.sub(this.vel, other.vel);
      
      // Calculate impulse scalar (simplified elastic collision)
      let impulse = 2 * relVel.dot(normal) / 2; // Equal masses assumed
      
      // Update velocities
      this.vel.sub(normal.mult(impulse));
      other.vel.add(normal.mult(impulse));
      
      // Separate balls to prevent overlap
      let overlap = minDistance - distance;
      let separation = normal.mult(overlap / 2);
      this.pos.sub(separation);
      other.pos.add(separation);
    }
  }
}