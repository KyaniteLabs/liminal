let particles = [];
let stars = [];

function setup() {
  createCanvas(800, 600);
  pixelDensity(1);
  
  // Create a field of static background stars using noise for organic positioning
  let starCount = 300;
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 2)
    });
  }
}

function draw() {
  // Create the fading trail effect by drawing a semi-transparent background over the previous frame
  noStroke();
  fill(0, 5); 
  rect(0, 0, width, height);

  // Update and display stars
  for (let star of stars) {
    drawStar(star.x, star.y, star.size);
  }

  // Launch fireworks at irregular intervals
  if (frameCount % 15 === 0) {
    launchFirework();
  }

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    
    // Apply physics: gravity and friction
    p.vy += 0.08; 
    p.vx *= 0.95;
    p.vy *= 0.95;
    
    p.x += p.vx;
    p.y += p.vy;
    
    // Fade out the particle
    p.alpha -= 0.02;
    
    drawParticle(p);
    
    // Remove dead particles
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function launchFirework() {
  let startX = random(width * 0.2, width * 0.8);
  let startY = height;
  
  // Random explosion type based on noise seed for variety
  let type = noise(frameCount * 0.1) > 0.5 ? 'burst' : 'ring';
  
  particles.push({
    x: startX,
    y: startY,
    vx: random(-2, 2), // Slight initial horizontal spread before explosion
    vy: -random(8, 15), // Upward velocity
    alpha: 0.6,
    type: 'rocket'
  });
}

function drawStar(x, y, size) {
  fill(255);
  strokeWeight(0);
  point(x, y);
}

function drawParticle(p) {
  let r = noise(frameCount * 0.1 + p.x * 0.01) * 150;
  let g = noise(frameCount * 0.2 - p.y * 0.01) * 150;
  let b = noise(p.x * 0.05, frameCount * 0.3) * 150;
  
  noStroke();
  fill(r, g, b, p.alpha);
  
  if (p.type === 'rocket') {
    // Draw the rocket ascending
    ellipse(p.x, p.y, size(4));
  } else if (p.type === 'burst') {
    // Explosion particles
    let px = random(-20, 20);
    let py = random(-20, 20);
    
    noiseSeed(p.x * 100 + frameCount);
    
    for (let i = 0; i < 8; i++) {
      push();
      translate(p.x, p.y);
      
      // Use polar coordinates for explosion spread based on noise angle
      let angle = map(i, 0, 7, 0, TWO_PI * 4) + (frameCount * 0.1);
      let dist = random(5, 25);
      
      rotate(angle);
      translate(dist, 0);
      
      let colorHue = noise(p.x * 0.05 + i) * HUE;
      fill(colorHue, saturation(sat), brightness(bri), p.alpha);
      ellipse(0, 0, size(3));
      
      pop();
    }
    
    // Reset noise seed for next iteration
    noiseSeed(random() * 10000);
  } else {
    // Ring particles
    let angle = frameCount * 0.2;
    push();
    translate(p.x, p.y);
    rotate(angle);
    
    stroke(r, g, b, p.alpha * 50);
    strokeWeight(1 + random());
    line(-30, 0, 30, 0);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}