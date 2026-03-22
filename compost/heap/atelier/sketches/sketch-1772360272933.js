function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(10, 5, 20);
  noStroke();
  
  // Stars
  for (let i = 0; i < 200; i++) {
    fill(255, 255, 200);
    const size = Math.random() * 2 + 0.5;
    ellipse(
      Math.random() * 800,
      Math.random() * 600,
      size,
      size
    );
  }
  
  // Nebulae
  for (let i = 0; i < 5; i++) {
    const hue = (i * 360 / 5) % 360;
    colorMode(HSB);
    fill(hue, 50, 50, 0.1);
    
    const x = Math.random() * 800;
    const y = Math.random() * 600;
    const size = Math.random() * 80 + 20;
    
    ellipse(x, y, size, size);
  }
  
  colorMode(RGB);
}