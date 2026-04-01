let width, height;
let plasmaImg;
let time = 0;
const cols = 16;
const rows = 9;

function setup() {
  createCanvas(800, 450);
  colorMode(HSB, 360, 100, 100);
  plasmaImg = get();
}

function draw() {
  background(20);
  
  time += 0.05;
  
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = map(i, 0, cols - 1, 0, width);
      let y = map(j, 0, rows - 1, 0, height);
      
      // Create wave interference pattern based on sine/cosine and time
      let angle = map(mouseX, 0, width, 0, TWO_PI) + noise(x/50 + time*2);
      let r = sin(angle * 3);
      
      let hue = (i * 25 + j * 36 + time * 80 + r * 40) % 360;
      let sat = map(sin(y/10 + time), -1, 1, 50, 100);
      let val = map(cos(x/20 + y/15 + time*2), -1, 1, 40, 90);
      
      stroke(hue, sat, val);
      strokeWeight(8);
      line(x, y, x+10, y+10); // Draw diagonal lines for plasma feel
      
      // Fill the grid cells with interpolated colors
      fill(hue + sin(y/20)*20, 50, 60);
      rect(x - width/(cols*2), y - height/(rows*2), width/(cols*2)+10, height/(rows*2)+10);
    }
  }
}