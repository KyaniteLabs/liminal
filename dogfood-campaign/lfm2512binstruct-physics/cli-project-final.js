function setup() {
  createCanvas(800, 400);
  noStroke();
  size(600, 400);

  // Define the center of the circle (boundary)
  const circleCenter = createVector(width / 2, height / 2);

  // Create an array to hold ball objects
  let balls = [];
  const numBalls = 10; // Number of balls
  for (let i = 0; i < numBalls; i++) {
    balls.push(new Ball(circleCenter.x + random(-width/4, width/4), circleCenter.y + random(-height/2, height/2)));
  }
}

function draw() {
  background(240); // Light grey background
  fill(255, 100, 100);
  
  // Draw the circular boundary
  noStroke();
  ellipse(circleCenter.x, circleCenter.y, radius, radius);

  // Update and display each ball
  balls.forEach(ball => {
    ball.update();
    ball.display();
    if (checkCollision(ball)) {
      ball.collide(bounds);
    }
  });
}

// Ball class definition
class Ball {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.radius = random(5, 15); // Random radius between 5 and 15
    this.speed = random(2, 4); // Speed between 2 and 4
  }

  update() {
    this.position.add(this.speed);
  }

  display() {
    fill(255);
    noStroke();
    sphere(this.radius);
  }

  collide(bounds) {
    const [cx, cy] = this.position;
    const r = this.radius;

    // Collision with circle boundary
    if (this.position.x - cx < -r || this.position.x + cx > bounds.x + radius) {
      this.position.set(cx);
      this.speed *= -1;
    }
    // Collision between balls
    for (let otherBall of balls) {
      if (balls.indexOf(otherBall) !== this.index && 
          distance(this.position, otherBall.position) < 2*r) {
        // Simple elastic collision: reverse speed in both directions
        this.speed *= -1;
        otherBall.speed *= -1;
      }
    }
  }

  get radius() { return this.radius; }
  get index() { return this.index; }
  distance(p1, p2) {
    const dist = dist(p1.x, p1.y, p2.x, p2.y);
    return dist < this.radius + 5;
  }

  updateSpeed() {
    this.speed += this.speed * 0.01;
    if (this.speed > 4) this.speed = 2; // Limit speed
  }
}

// Helper function to draw ellipses for circles
function createEllipse(x, y, r) {
  fill(255);
  noStroke();
  ellipse(x, y, r * 2, r * 2);
}