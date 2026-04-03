let particles = [];
let letters = "";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letterCount = 30;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  
  // Seed the noise for consistent organic patterns
  noiseSeed(12345);
  
  for (let i = 0; i < letterCount; i++) {
    letters += alphabet.charAt(floor(random(alphabet.length)));
  }
}

function draw() {
  background(10, 10, 20);
  pixelDensity(1); // Optimize for performance
  
  // Update and move particles using Perlin noise
  updateParticles();
  
  // Draw text with smooth color gradients based on position and time
  push();
  fill(rainbow Hue(map(mouseX, 0, width, 280, 420)));
  translate(width / 2 - letters.length * fontSize / 2, height / 2 + 50);
  text(letters, 0, 0);
  pop();
  
  // Draw the circle based on noise values
  drawCircle();
}

function updateParticles() {
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    
    // Smooth movement using Perlin noise
    p.x += map(noise(p.x * 0.01, frameCount * 0.01), 0, 1) * 2 - 1;
    p.y += map(noise(p.z + 0.5, frameCount * 0.01), 0, 1) * 2 - 1;
    p.z = (p.z + 0.02) % 1; // Loop the noise input
    
    p.x = floor(p.x);
    p.y = floor(p.y);
    
    // Draw particle as a soft circle
    noStroke();
    fill(255, 50);
    ellipse(p.x * width + mouseX, p.y * height + mouseY, map(noise(i), 0, 1) * 20 + 4, map(noise(i + 100), 0, 1) * 20 + 4);
  }
}

function drawCircle() {
  let cx = width / 2;
  let cy = height / 2;
  
  // Radius grows with noise over time
  let radius = map(noise(frameCount * 0.01), 0, 1, 50, 300);
  
  push();
  stroke(255);
  strokeWeight(map(noise(frameCount * 0.03), 0, 1) * 4 + 1);
  noFill();
  
  // Draw the circle outline with varying opacity based on noise
  let alpha = map(noise(frameCount * 0.05), 0, 1, 20, 255);
  stroke(alpha);
  
  line(cx - radius, cy, cx + radius, cy);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}