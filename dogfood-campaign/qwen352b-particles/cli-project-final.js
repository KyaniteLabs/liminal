// Create a canvas element for our drawing area
let particles = [];
function setup() {
  // Set up our width and height of the canvas equal to the size of the window
  createCanvas(windowWidth, windowHeight);
  
  // Initialize gravity constant (0.5)
  const gravity = 0.5;

  // Create an array to hold particle objects
}

function draw() {
  background(218, 46, 39); // Set the color of the canvas to a dark brown

  // Set up particles loop
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];

    // Apply gravity
    p.y += p.vy + gravity * particles[i].vx;
    
    // Update the y position of each particle
    if (p.y >= windowHeight) {
      // If it hits the bottom, remove it from the array and reset velocity to zero
      particles.splice(i, 1);
      i--;
      continue;
    }

    // Calculate x position based on mouse movement or random value
    let mouseX = p.x;
    if (mouseX !== null) {
      // Randomize particle color between 20 and 350
      let hue = map(mouseY, 0, height, 180, 360);
      
      // Determine the size of each spark based on mouse proximity
      let size = p.size;
      if (size < 5) {
        size = random(2, 6);
      }

      // Create a new particle object with properties for gravity and fade-out
      particles.push({
        x: mouseX,
        y: mouseY - p.y, // Start at the mouse position
        vx: random(-1, 1), // Velocity vector x component
        vy: random(-3, -6), // Initial velocity y component (upward)
        size: size,
        hue: hue,
        alpha: random(0.5, 1.0),
        fadeTime: millis() + random(1000, 2000) // Randomize the time when to fade out
      });
    }

    // Update particle properties each frame
    particles[i].alpha -= 0.01; // Fade effect
    particles[i].hue += 0.2; // Slight color shift over time
    particles[i].size *= 0.95; // Shrink slightly over time
    
    // Move the particle downwards (gravity)
    particles[i].vy += gravity;
    
    // Update position based on velocity and current size
    particles[i].x += particles[i].vx;
    particles[i].y -= particles[i].size + particles[i].vy;

    // Draw each spark
    noStroke();
    fill(hue * 2, 0.5); // Set color to a bright shade of the hue we chose
    rect(particles[i].x, particles[i].y, particles[i].size, particles[i].size);
    
    // Check if particle has faded out or fallen off screen
    if (particles[i].alpha <= 0 || particles[i].y > windowHeight) {
      particles.splice(i, 1);
      i--;
    }
  }

  // Set the mouse cursor position to where it was last clicked
  createMouse(mouseX, mouseY - height);
}