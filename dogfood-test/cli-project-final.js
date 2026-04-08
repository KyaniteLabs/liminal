function setup() {
  createCanvas(600, 400);
  // Ball properties
  ballX = width / 2;
  ballY = height / 2;
  ballSize = 30;
  // Initial velocity (speed)
  velocityX = random(-5, 5);
  velocityY = random(-5, 5);
}

function draw() {
  background(220);

  // 1. Update position (Physics)
  ballX += velocityX;
  ballY += velocityY;

  // 2. Boundary Collision Detection (Horizontal)
  // Check if the left or right edge is hit
  if (ballX - ballSize / 2 > width || ballX + ballSize / 2 < 0) {
    velocityX = -velocityX; // Reverse X direction
  }

  // 3. Boundary Collision Detection (Vertical)
  // Check if the top or bottom edge is hit
  if (ballY - ballSize / 2 > height || ballY + ballSize / 2 < 0) {
    velocityY = -velocityY; // Reverse Y direction
  }

  // 4. Drawing
  fill(255, 0, 0); // Red color
  ellipse(ballX, ballY, ballSize, ballSize);
}