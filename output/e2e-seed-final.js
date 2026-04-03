let angle = 0;
let radius = 100;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(220);
}

function draw() {
  background(30, 30, 50); // Darker background for contrast
  
  let centerX = width / 2;
  let centerY = height / 2;
  
  // Animate the circle size and position
  let x = centerX + cos(angle) * radius;
  let y = centerY + sin(angle) * radius;
  let d = map(sin(frameCount * 0.1), -1, 1, 30, 80);
  
  // Draw a trail effect
  fill(255, 30);
  noStroke();
  rect(0, 0, width, height);
  
  // Draw the main animated circle
  noStroke();
  let red = map(sin(frameCount * 0.05), -1, 1, 100, 255);
  let green = map(cos(frameCount * 0.03), -1, 1, 100, 255);
  let blue = map(sin(frameCount * 0.07), -1, 1, 100, 255);
  fill(red, green, blue);
  
  circle(x, y, d);
  
  // Draw a connecting line to center
  stroke(200, 50);
  strokeWeight(2);
  line(centerX, centerY, x, y);
  
  angle += 0.03;
}