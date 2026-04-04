import * as p5 from 'p5';

// Define the main function for setup() and draw()
function setup() {
  // Set the canvas size to fill the window
  let width = window.innerWidth;
  let height = window.innerHeight;
  
  createCanvas(width, height);
  // Enable smoothing for smoother curves in noise calculations
  noSmooth(); 
}

// Define the main function for draw()
function draw() {
  background(240); // Set initial background color to a soft gray
  
  let width = window.innerWidth;
  let height = window.innerHeight;
  
  // Create an array of random numbers between -1 and 1
  let noiseArray = createNoiseGrid(8, 3);

  // Iterate through each pixel in the canvas (or grid)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      
      // Get noise values from the array based on current coordinates
      let n1 = noiseArray.noise(x / width, y / height, 2);
      let n2 = noiseArray.noise((x + 1) / width, y / height, 2);
      let n3 = noiseArray.noise(x / width, (y + 1) / height, 2);

      // Calculate the distance between these points to determine color intensity
      let dist = abs(n1 - n2); 

      // Create a hue based on the coordinates and distance
      let hue = map(dist * 360, 0, 180, 0, 360);

      // Set the pixel's RGB values based on the calculated color
      setPixelColor(x, y, hue, dist * 255, 0); 
    }
  }
}