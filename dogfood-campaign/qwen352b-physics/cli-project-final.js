function setup() {
  // Set up the canvas
  createCanvas(600, 400);
  
  // Define the ball properties (radius and color)
  let ballRadius = 15;
  let ballColor = '#ffeb3b';
}

function draw() {
  background('#292972'); // Set a dark blue-grey background
  
  // Create an array to store ball data so we can check for collisions later
  let balls = []; 
  
  // Clear the canvas and add new balls
  createBall();
  
  // Add balls every second
  if (frameCount % 10 === 0) {
    createBall();
  }

  // Draw each ball
  for (let i = 0; i < balls.length; i++) {
    let b = balls[i];
    
    // Update position based on velocity
    x += b.vx;
    y += b.vy;
    
    // Apply friction and gravity to simulate bouncing
    b.vx *= 0.96; 
    b.vy *= 0.98;
    
    // Add a little bit of randomness to the bounce energy for variety
    b.vx = random(-1, 1) * 3;
    b.vy = random(-1, 1) * 4;

    // Draw ball
    ellipse(x, y, ballRadius * 2);
    
    // Color the ball based on velocity (dark blue when moving fast, lighter when slow)
    let brightness = map(b.vx + b.vy, -5, 5, 100, 255);
    fill(brightness < 30 ? color(20, 20, 40) : color(180, 180, 200));
    
    // Draw a highlight to give the ball depth
    fill(255, brightness / 60);
    ellipse(x, y - 1, ballRadius * 1.6 + 2);
  }

  // --- Collision Detection Logic ---
  
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      let b1 = balls[i];
      let b2 = balls[j];

      // Calculate distance between the centers of two balls
      let dx = b1.x - b2.x;
      let dy = b1.y - b2.y;
      
      // Distance squared to avoid square root (slightly more efficient)
      let distSq = dx * dx + dy * dy;

      // If the distance is less than the sum of their radii, a collision occurred
      if (distSq < (ballRadius * 2 * ballRadius)) {
        
        // Calculate velocities and normal vector of collision
        // We assume elastic collision where objects bounce off each other.
        // v' = v - 2 * dot(v_obj, n) * n
        
        let nx = dx / sqrt(distSq);
        let ny = dy / sqrt(distSq);

        // Dot product for normal velocity
        let dpX = b1.vx * nx + b1.vy * ny;
        let dpY = b2.vx * nx + b2.vy * ny;

        // Relative velocity (velocity before collision)
        let dvx = b1.vx - b2.vx;
        let dvy = b1.vy - b2.vy;

        // Dot product for tangent component (parallel to normal, no change in impulse usually)
        let dpTanX = 0.5 * (dvx * nx + dvy * ny); 
        let dpTanY = 0.5 * (dvy * nx + dvx * ny);

        // Update velocities to simulate bounce
        
        // Apply the relative velocity change along the normal direction
        let newV1X = dpX - 2 * dpTanX;
        let newV1Y = dpY - 2 * dpTanY;
        
        let newV2X = dpTanX + dpTanX;
        let newV2Y = dpTanY + dpTanY;

        // Apply the updated velocities to each ball's current state
        
        b1.vx = nx * newV1X + ny * newV1Y;
        b1.vy = ny * newV1X + nx * newV1Y;
        
        b2.vx = nx * newV2X + ny * newV2Y;
        b2.vy = ny * newV2X + nx * newV2Y;

      }
    }
  }
}

function createBall() {
  let x = random(width);
  let y = random(height);
  
  // Randomize velocity
  let vx = random(-5, 5);
  let vy = random(-5, 5);
  
  balls.push({x: x, y: y, vx: vx, vy: vy});
}

function getMousePos() {
  let pos = createVector(mouseX - width/2, mouseY - height/2);
  return pos;
}