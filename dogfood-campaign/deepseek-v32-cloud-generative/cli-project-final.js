```javascript
let time = 0;
let lines = [];
let gradientColors = [];

function setup() {
  createCanvas(800, 800);
  colorMode(HSB, 360, 100, 100, 1);
  noFill();
  
  // Initialize gradient colors
  gradientColors = [
    color(200, 80, 100),  // Soft pink
    color(280, 80, 100),  // Lavender
    color(160, 80, 100),  // Mint green
    color(40